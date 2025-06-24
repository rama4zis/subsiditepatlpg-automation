import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import puppeteer, { Browser, Page } from 'puppeteer';
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
    total: number;
    processed: number;
    current: string;
    status: 'starting' | 'processing' | 'completed' | 'error';
    startTime: Date;
    estimatedEndTime: Date;
    reportBuffer?: any;
    filename?: string;
    data?: any[];
    limit?: number;
    successfulProcessed?: number;
}

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
        const { nikData, limiter } = req.body;
        
        if (!nikData) {
            res.status(400).json({ error: 'NIK data is required' });
            return;
        }

        // Parse NIK data - split by various delimiters
        const nikNumbers = parseNikData(nikData);
        
        if (nikNumbers.length === 0) {
            res.status(400).json({ error: 'No valid NIK numbers found' });
            return;
        }

        // Validate environment variables
        if (!process.env.EMAIL || !process.env.PASSWORD) {
            res.status(500).json({ 
                error: 'Missing environment variables. Please check your .env file.' 
            });
            return;
        }

        // Parse limiter
        const processLimit = limiter && parseInt(limiter) > 0 ? parseInt(limiter) : nikNumbers.length;

        // Send immediate response that processing has started
        const startTime = new Date();
        const estimatedEndTime = new Date(startTime.getTime() + (Math.min(processLimit, nikNumbers.length) * 5000)); // 5 seconds per NIK
        
        currentProgress = {
            total: nikNumbers.length,
            processed: 0,
            current: '',
            status: 'starting',
            startTime: startTime,
            estimatedEndTime: estimatedEndTime,
            limit: processLimit,
            successfulProcessed: 0
        };

        res.json({ 
            message: 'Processing started', 
            nikCount: nikNumbers.length,
            nikNumbers: nikNumbers.slice(0, 5), // Show first 5 for preview
            totalCount: nikNumbers.length,
            limit: processLimit,
            estimatedTimeMinutes: Math.ceil(Math.min(processLimit, nikNumbers.length) * 5 / 60)
        });

        // Start automation in background
        processAutomation(nikNumbers, processLimit).catch(console.error);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint to check automation status
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
        total: currentProgress.total,
        processed: currentProgress.processed,
        current: currentProgress.current,
        status: currentProgress.status,
        elapsedTime: `${elapsedMinutes}:${elapsedSeconds.toString().padStart(2, '0')}`,
        remainingTime: remainingTime,
        progress: Math.round((currentProgress.processed / currentProgress.total) * 100),
        hasReport: !!(currentProgress.reportBuffer || currentProgress.data),
        limit: currentProgress.limit,
        successfulProcessed: currentProgress.successfulProcessed || 0
    });
});

// API endpoint to download the generated report
app.get('/api/download-report', async (req: Request, res: Response) => {
    if (!currentProgress) {
        res.status(404).json({ error: 'No report available' });
        return;
    }
    
    try {
        let buffer: any;
        let filename: string;
        
        if (currentProgress.reportBuffer) {
            buffer = currentProgress.reportBuffer;
            filename = currentProgress.filename || 'subsidite-pat-lpg-report.xlsx';
        } else if (currentProgress.data) {
            // Generate Excel on-the-fly if we have data but no buffer
            const excelExporter = new ExcelExportService();
            buffer = await excelExporter.exportToExcel(currentProgress.data, undefined, true);
            filename = `subsidite-pat-lpg-report-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.xlsx`;
        } else {
            res.status(404).json({ error: 'No report data available' });
            return;
        }
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('Error generating download:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

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
async function processAutomation(nikNumbers: string[], limit?: number): Promise<void> {
    console.log(`🚀 Starting automation for ${nikNumbers.length} NIK numbers with limit: ${limit || 'unlimited'}...`);
    
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
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            // '--single-process',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ]
    });

    try {
        const page: Page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        const loginService = new LoginService(page);
        const loginUrl: string = 'https://subsiditepatlpg.mypertamina.id/merchant-login';
        const credentials = {
            username: process.env.EMAIL || '',
            password: process.env.PASSWORD || ''
        };

        console.log('🔐 Attempting login...');
        const isLoggedIn: boolean = await loginService.login(credentials, loginUrl);
        
        if (isLoggedIn) {
            console.log('✅ Login successful');
            
            const inputDataService = new InputDataService(page);
            const result = await inputDataService.inputData(nikNumbers, (processed: number, current: string) => {
                if (currentProgress) {
                    currentProgress.processed = processed;
                    currentProgress.current = current;
                    console.log(`📊 Progress: ${processed}/${currentProgress.total} - Processing: ${current}`);
                }
            }, limit);
            
            if (currentProgress) {
                currentProgress.status = 'completed';
                
                // If result is a file path, read it and create buffer for web download
                if (typeof result === 'string') {
                    try {
                        const fileBuffer = fs.readFileSync(result);
                        currentProgress.reportBuffer = fileBuffer;
                        currentProgress.filename = path.basename(result);
                    } catch (error) {
                        console.error('Error reading file for web download:', error);
                    }
                }
            }
            
            console.log('🎉 Automation completed successfully!');
        } else {
            console.log('❌ Login failed');
            if (currentProgress) {
                currentProgress.status = 'error';
            }
        }
        
    } catch (error: unknown) {
        console.error('❌ Automation error:', error);
        if (currentProgress) {
            currentProgress.status = 'error';
        }
    } finally {
        await browser.close();
    }
}

// Start server
app.listen(port, () => {
    console.log(`🌐 Web server running at http://localhost:${port}`);
    console.log(`📝 Open the URL to input NIK data through web interface`);
});

export default app;
