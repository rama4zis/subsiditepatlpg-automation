import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import puppeteer, { Browser, Page } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { LoginService } from './logic/login';
import { InputDataService } from './logic/input-data';
import { ExcelExportService } from './logic/excel-export';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app: express.Application = express();
const port = 3000;

// Progress tracking
interface ProcessingProgress {
    sessionId: string;
    total: number;
    processed: number;
    current: string;
    status: 'starting' | 'processing' | 'completed' | 'error';
    startTime: Date;
    estimatedEndTime: Date;
    reportBuffer?: any;
    filename?: string;
    filePath?: string;
    data?: any[];
    limit?: number;
    successfulProcessed?: number;
    username?: string;
}

// Store multiple user sessions
const activeSessions = new Map<string, ProcessingProgress>();

// Backward compatibility - keep for existing logic that might reference it
let currentProgress: ProcessingProgress | null = null;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Serve HTML form
app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API endpoint to process NIK data
app.post('/api/process-nik', async (req: Request, res: Response) => {
    try {
        const { nikData, limiter, username, password } = req.body;

        if (!nikData) {
            res.status(400).json({ error: 'NIK data is required' });
            return;
        }

        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        // Parse NIK data - split by various delimiters
        const nikNumbers = parseNikData(nikData);

        if (nikNumbers.length === 0) {
            res.status(400).json({ error: 'No valid NIK numbers found' });
            return;
        }

        // Parse limiter
        const processLimit = limiter && parseInt(limiter) > 0 ? parseInt(limiter) : nikNumbers.length;

        // Generate unique session ID
        const sessionId = uuidv4();

        // Send immediate response that processing has started
        const startTime = new Date();
        const estimatedEndTime = new Date(startTime.getTime() + (Math.min(processLimit, nikNumbers.length) * 5000)); // 5 seconds per NIK

        const sessionProgress: ProcessingProgress = {
            sessionId: sessionId,
            total: nikNumbers.length,
            processed: 0,
            current: '',
            status: 'starting',
            startTime: startTime,
            estimatedEndTime: estimatedEndTime,
            limit: processLimit,
            successfulProcessed: 0,
            username: username
        };

        // Store session in the map
        activeSessions.set(sessionId, sessionProgress);
        
        // Keep backward compatibility for any legacy code
        currentProgress = sessionProgress;

        res.json({
            sessionId: sessionId, // Return session ID to client
            message: 'Processing started',
            nikCount: nikNumbers.length,
            nikNumbers: nikNumbers.slice(0, 5), // Show first 5 for preview
            totalCount: nikNumbers.length,
            limit: processLimit,
            estimatedTimeMinutes: Math.ceil(Math.min(processLimit, nikNumbers.length) * 5 / 60)
        });

        // Start automation in background with session ID
        processAutomation(nikNumbers, processLimit, { username, password }, sessionId).catch(console.error);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint to check automation status - Support both session-based and legacy
app.get('/api/status/:sessionId', (req: Request, res: Response) => {
    const sessionId = req.params.sessionId;
    let progress: ProcessingProgress | null = null;

    progress = activeSessions.get(sessionId) || null;
    if (!progress) {
        res.json({ status: 'Session not found or expired' });
        return;
    }

    const now = new Date();
    const elapsedMs = now.getTime() - progress.startTime.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);

    let remainingTime = '';
    if (progress.status === 'processing') {
        const remainingNiks = (progress.limit || progress.total) - (progress.successfulProcessed || 0);
        const remainingMs = remainingNiks * 5000; // 5 seconds per NIK
        const remainingMinutes = Math.floor(remainingMs / 60000);
        const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
        remainingTime = `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    res.json({
        sessionId: progress.sessionId,
        total: progress.total,
        processed: progress.processed,
        current: progress.current,
        status: progress.status,
        elapsedTime: `${elapsedMinutes}:${elapsedSeconds.toString().padStart(2, '0')}`,
        remainingTime: remainingTime,
        progress: Math.round((progress.processed / progress.total) * 100),
        hasReport: !!(progress.reportBuffer || progress.data),
        limit: progress.limit,
        successfulProcessed: progress.successfulProcessed || 0,
        username: progress.username
    });
});

// Legacy API endpoint to check automation status
app.get('/api/status', (req: Request, res: Response) => {
    if (!currentProgress) {
        res.json({ status: 'No active processing' });
        return;
    }

    const now = new Date();
    const elapsedMs = now.getTime() - currentProgress.startTime.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);

    let remainingTime = '';
    if (currentProgress.status === 'processing') {
        const remainingNiks = (currentProgress.limit || currentProgress.total) - (currentProgress.successfulProcessed || 0);
        const remainingMs = remainingNiks * 5000; // 5 seconds per NIK
        const remainingMinutes = Math.floor(remainingMs / 60000);
        const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
        remainingTime = `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    res.json({
        sessionId: currentProgress.sessionId,
        total: currentProgress.total,
        processed: currentProgress.processed,
        current: currentProgress.current,
        status: currentProgress.status,
        elapsedTime: `${elapsedMinutes}:${elapsedSeconds.toString().padStart(2, '0')}`,
        remainingTime: remainingTime,
        progress: Math.round((currentProgress.processed / currentProgress.total) * 100),
        hasReport: !!(currentProgress.reportBuffer || currentProgress.data),
        limit: currentProgress.limit,
        successfulProcessed: currentProgress.successfulProcessed || 0,
        username: currentProgress.username
    });
});

// API endpoint to download the generated report - Session-based
app.get('/api/download-report/:sessionId', async (req: Request, res: Response) => {
    console.log('📥 Download report requested...');

    const sessionId = req.params.sessionId;
    const progress = activeSessions.get(sessionId) || null;
    
    if (!progress) {
        console.log('❌ Session not found or expired');
        res.status(404).json({ error: 'Session not found or expired' });
        return;
    }

    console.log('📊 Current progress status:', progress.status);
    console.log('📊 Has report buffer:', !!progress.reportBuffer);
    console.log('📊 Has data:', !!progress.data);
    console.log('📊 File path:', progress.filePath);

    try {
        let buffer: any;
        let filename: string;
        let filePath: string | null = null;

        if (progress.reportBuffer) {
            buffer = progress.reportBuffer;
            filename = progress.filename || 'subsidite-pat-lpg-report.xlsx';
            filePath = progress.filePath || null;
            console.log('✅ Using existing buffer for download');
        } else if (progress.data) {
            // Generate Excel on-the-fly if we have data but no buffer
            console.log('🔄 Generating Excel from data...');
            const excelExporter = new ExcelExportService();
            buffer = await excelExporter.exportToExcel(progress.data, undefined, true);
            filename = `subsidite-pat-lpg-report-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.xlsx`;
            console.log('✅ Excel generated from data');
        } else {
            console.log('❌ No report data available');
            res.status(404).json({ error: 'No report data available' });
            return;
        }

        console.log(`📥 Sending Excel download: ${filename}, buffer size: ${buffer?.length || 0} bytes`);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);

        // Clean up the physical file after successful download
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`🗑️  Deleted temporary file: ${filePath}`);
            } catch (deleteError) {
                console.error(`⚠️  Failed to delete temporary file ${filePath}:`, deleteError);
            }
        }

        console.log(`✅ Excel file downloaded successfully: ${filename}`);
    } catch (error) {
        console.error('❌ Error generating download:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Legacy API endpoint to download the generated report
app.get('/api/download-report', async (req: Request, res: Response) => {
    console.log('📥 Legacy download report requested...');

    if (!currentProgress) {
        console.log('❌ No current progress found');
        res.status(404).json({ error: 'No report available' });
        return;
    }

    console.log('📊 Current progress status:', currentProgress.status);
    console.log('📊 Has report buffer:', !!currentProgress.reportBuffer);
    console.log('📊 Has data:', !!currentProgress.data);
    console.log('📊 File path:', currentProgress.filePath);

    try {
        let buffer: any;
        let filename: string;
        let filePath: string | null = null;

        if (currentProgress.reportBuffer) {
            buffer = currentProgress.reportBuffer;
            filename = currentProgress.filename || 'subsidite-pat-lpg-report.xlsx';
            filePath = currentProgress.filePath || null;
            console.log('✅ Using existing buffer for download');
        } else if (currentProgress.data) {
            // Generate Excel on-the-fly if we have data but no buffer
            console.log('🔄 Generating Excel from data...');
            const excelExporter = new ExcelExportService();
            buffer = await excelExporter.exportToExcel(currentProgress.data, undefined, true);
            filename = `subsidite-pat-lpg-report-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.xlsx`;
            console.log('✅ Excel generated from data');
        } else {
            console.log('❌ No report data available');
            res.status(404).json({ error: 'No report data available' });
            return;
        }

        console.log(`📥 Sending Excel download: ${filename}, buffer size: ${buffer?.length || 0} bytes`);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);

        // Clean up the physical file after successful download
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`🗑️  Deleted temporary file: ${filePath}`);
            } catch (deleteError) {
                console.error(`⚠️  Failed to delete temporary file ${filePath}:`, deleteError);
            }
        }

        console.log(`✅ Excel file downloaded successfully: ${filename}`);
    } catch (error) {
        console.error('❌ Error generating download:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// API endpoint to reset automation state - Session-based
app.post('/api/reset/:sessionId', (req: Request, res: Response) => {
    const sessionId = req.params.sessionId;
    const sessionProgress = activeSessions.get(sessionId);
    
    if (sessionProgress) {
        // Clean up current file if exists
        if (sessionProgress.filePath && fs.existsSync(sessionProgress.filePath)) {
            try {
                fs.unlinkSync(sessionProgress.filePath);
                console.log(`🗑️  Cleaned up file on session reset: ${sessionProgress.filePath}`);
            } catch (error) {
                console.error(`⚠️  Error cleaning up file on session reset:`, error);
            }
        }
        activeSessions.delete(sessionId);
        console.log(`🔄 Session ${sessionId} reset successfully`);
        res.json({ success: true, message: `Session ${sessionId} reset successfully` });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

// Legacy API endpoint to reset automation state
app.post('/api/reset', (req: Request, res: Response) => {
    // Reset all sessions (legacy behavior)
    for (const [id, progress] of activeSessions.entries()) {
        if (progress.filePath && fs.existsSync(progress.filePath)) {
            try {
                fs.unlinkSync(progress.filePath);
                console.log(`🗑️  Cleaned up file on reset: ${progress.filePath}`);
            } catch (error) {
                console.error(`⚠️  Error cleaning up file on reset:`, error);
            }
        }
    }
    activeSessions.clear();
    currentProgress = null;
    console.log('🔄 All sessions reset successfully');
    res.json({ success: true, message: 'All sessions reset successfully' });
});

// API endpoint to list all active sessions
app.get('/api/sessions', (req: Request, res: Response) => {
    const sessions = Array.from(activeSessions.entries()).map(([sessionId, progress]) => ({
        sessionId,
        username: progress.username,
        status: progress.status,
        progress: Math.round((progress.processed / progress.total) * 100),
        startTime: progress.startTime,
        total: progress.total,
        processed: progress.processed
    }));

    res.json({
        totalSessions: sessions.length,
        sessions: sessions
    });
});

// Function to clean up old temporary files
function cleanupOldFiles(): void {
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) return;

    try {
        const files = fs.readdirSync(reportsDir);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        files.forEach(file => {
            const filePath = path.join(reportsDir, file);
            try {
                const stats = fs.statSync(filePath);
                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️  Cleaned up old file: ${file}`);
                }
            } catch (error) {
                console.error(`⚠️  Error checking file ${file}:`, error);
            }
        });
    } catch (error) {
        console.error('⚠️  Error during cleanup:', error);
    }
}

// Clean up old files on startup and every hour
cleanupOldFiles();
setInterval(cleanupOldFiles, 60 * 60 * 1000); // Run every hour

// Function to parse NIK data with multiple delimiters
function parseNikData(nikData: string): string[] {
    // Split by enter, comma, space, and semicolon
    const delimiters = /[\n\r,;\s]+/;

    return nikData
        .split(delimiters)
        .map(nik => nik.trim())
        .filter(nik => nik.length > 0)
        .filter(nik => /^\d{16}$/.test(nik)); // Validate NIK format (16 digits)
}

// Function to run automation
async function processAutomation(nikNumbers: string[], limit?: number, credentials?: { username: string; password: string }, sessionId?: string): Promise<void> {
    console.log(`🚀 Starting automation for ${nikNumbers.length} NIK numbers with limit: ${limit || 'unlimited'} (Session: ${sessionId || 'legacy'})...`);

    const sessionProgress = sessionId ? activeSessions.get(sessionId) : null;

    if (sessionProgress) {
        sessionProgress.status = 'processing';
    }
    
    // Also update currentProgress for backward compatibility
    if (currentProgress) {
        currentProgress.status = 'processing';
    }

    const browser: Browser = await puppeteer.launch({
        headless: true, // Use headless mode in Docker
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--disable-extensions',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
    });

    try {
        const page: Page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        const loginService = new LoginService(page);
        const loginUrl: string = 'https://subsiditepatlpg.mypertamina.id/merchant-login';
        
        // Use provided credentials or fall back to environment variables
        const loginCredentials = credentials || {
            username: process.env.EMAIL || '',
            password: process.env.PASSWORD || ''
        };

        console.log(`🔐 Attempting login for session ${sessionId || 'legacy'}...`);
        const isLoggedIn: boolean = await loginService.login(loginCredentials, loginUrl);

        if (isLoggedIn) {
            console.log(`✅ Login successful for ${loginCredentials.username} (Session: ${sessionId || 'legacy'})`);

            const inputDataService = new InputDataService(page);
            const result = await inputDataService.inputData(nikNumbers, (processed: number, current: string) => {
                // Update session-specific progress
                if (sessionProgress) {
                    sessionProgress.processed = processed;
                    sessionProgress.current = current;
                    console.log(`📊 Session ${sessionId} Progress: ${processed}/${sessionProgress.total} - Processing: ${current}`);
                }
                
                // Also update currentProgress for backward compatibility
                if (currentProgress && (!sessionId || currentProgress.sessionId === sessionId)) {
                    currentProgress.processed = processed;
                    currentProgress.current = current;
                }
            }, limit);

            // Update session status to completed
            if (sessionProgress) {
                sessionProgress.status = 'completed';

                console.log(`🎯 Session ${sessionId} - Automation result type: ${typeof result}`);
                console.log(`🎯 Session ${sessionId} - Automation result: ${result}`);

                // If result is a file path, read it and create buffer for web download
                if (typeof result === 'string') {
                    try {
                        if (fs.existsSync(result)) {
                            const fileBuffer = fs.readFileSync(result);
                            sessionProgress.reportBuffer = fileBuffer;
                            sessionProgress.filename = path.basename(result);
                            sessionProgress.filePath = result; // Store file path for cleanup
                            console.log(`📊 Session ${sessionId} - File read for web download: ${path.basename(result)}, size: ${fileBuffer.length} bytes`);
                        } else {
                            console.log(`❌ Session ${sessionId} - File not found: ${result}`);
                        }
                    } catch (error) {
                        console.error(`❌ Session ${sessionId} - Error reading file for web download:`, error);
                    }
                } else {
                    console.log(`⚠️  Session ${sessionId} - No file path returned from automation`);
                }
            }

            // Also update currentProgress for backward compatibility
            if (currentProgress && (!sessionId || currentProgress.sessionId === sessionId)) {
                currentProgress.status = 'completed';

                if (typeof result === 'string') {
                    try {
                        if (fs.existsSync(result)) {
                            const fileBuffer = fs.readFileSync(result);
                            currentProgress.reportBuffer = fileBuffer;
                            currentProgress.filename = path.basename(result);
                            currentProgress.filePath = result;
                        }
                    } catch (error) {
                        console.error('Error reading file for legacy web download:', error);
                    }
                }
            }

            console.log(`🎉 Session ${sessionId || 'legacy'} - Automation completed successfully!`);
        } else {
            console.log(`❌ Session ${sessionId || 'legacy'} - Login failed`);
            if (sessionProgress) {
                sessionProgress.status = 'error';
            }
            if (currentProgress && (!sessionId || currentProgress.sessionId === sessionId)) {
                currentProgress.status = 'error';
            }
        }

    } catch (error: unknown) {
        console.error(`❌ Session ${sessionId || 'legacy'} - Automation error:`, error);
        if (sessionProgress) {
            sessionProgress.status = 'error';
        }
        if (currentProgress && (!sessionId || currentProgress.sessionId === sessionId)) {
            currentProgress.status = 'error';
        }
    } finally {
        await browser.close();
        
        // Auto-cleanup session after completion (optional - you can adjust timing)
        if (sessionId && sessionProgress) {
            setTimeout(() => {
                console.log(`🗑️  Auto-cleaning session ${sessionId} after 5 minutes`);
                activeSessions.delete(sessionId);
            }, 300000); // 5 minutes
        }
    }
}

// Start server
const host = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces
app.listen(port, host, () => {
    console.log(`🌐 Web server running at:`);
    console.log(`   Local:   http://localhost:${port}`);
    console.log(`   Network: http://${host}:${port}`);
    console.log(`📝 Open any of these URLs to input NIK data through web interface`);

    // Try to get the actual network IP
    const networkInterfaces = os.networkInterfaces();

    console.log(`\n🌍 Available network addresses:`);
    Object.keys(networkInterfaces).forEach(interfaceName => {
        const interfaces = networkInterfaces[interfaceName];
        interfaces?.forEach((iface) => {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`   ${interfaceName}: http://${iface.address}:${port}`);
            }
        });
    });
});

export default app;
