import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import puppeteer, { Browser, Page } from 'puppeteer';
import { LoginService } from './logic/login';
import { InputDataService } from './logic/input-data';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app: express.Application = express();
const port = 3000;

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
        const { nikData } = req.body;
        
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

        // Send immediate response that processing has started
        res.json({ 
            message: 'Processing started', 
            nikCount: nikNumbers.length,
            nikNumbers: nikNumbers.slice(0, 5), // Show first 5 for preview
            totalCount: nikNumbers.length
        });

        // Start automation in background
        processAutomation(nikNumbers).catch(console.error);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint to check automation status
app.get('/api/status', (req: Request, res: Response) => {
    // This could be enhanced with a database or Redis to store actual status
    res.json({ status: 'Check console for automation progress' });
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
async function processAutomation(nikNumbers: string[]): Promise<void> {
    console.log(`🚀 Starting automation for ${nikNumbers.length} NIK numbers...`);
    
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
            '--single-process',
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
            await inputDataService.inputData(nikNumbers);
            
            console.log('🎉 Automation completed successfully!');
        } else {
            console.log('❌ Login failed');
        }
        
    } catch (error: unknown) {
        console.error('❌ Automation error:', error);
    } finally {
        // await browser.close();
    }
}

// Start server
app.listen(port, () => {
    console.log(`🌐 Web server running at http://localhost:${port}`);
    console.log(`📝 Open the URL to input NIK data through web interface`);
});

export default app;
