import puppeteer, { Browser, Page } from 'puppeteer';
import { LoginService } from './logic/login';
import * as dotenv from 'dotenv';
import { InputDataService } from './logic/input-data';

// Load environment variables
dotenv.config();

async function runAutomation(): Promise<void> {
  const browser: Browser = await puppeteer.launch({
    headless: false,
    executablePath: '/usr/bin/google-chrome', // or '/usr/bin/chromium-browser'
    args: [
      // '--no-sandbox',
      // '--disable-setuid-sandbox',
      // '--disable-dev-shm-usage',
      // '--disable-accelerated-2d-canvas',
      // '--no-first-run',
      // '--no-zygote',
      // '--single-process',
      // '--disable-gpu'
    ]
  });

  try {
    const page: Page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    // await page.goto('https://google.com');
    const loginService = new LoginService(page);
    const loginUrl: string = 'https://subsiditepatlpg.mypertamina.id/merchant-login'; // Replace with your login URL
    const credentials = {
      username: process.env.EMAIL || '',
      password: process.env.PASSWORD || ''
    };

    // Validate environment variables
    if (!process.env.EMAIL || !process.env.PASSWORD) {
      console.error('Missing environment variables. Please check your .env file.');
      console.error('EMAIL:', process.env.EMAIL ? '✓ Set' : '✗ Missing');
      console.error('PASSWORD:', process.env.PASSWORD ? '✓ Set' : '✗ Missing');
      return;
    }

    const isLoggedIn: boolean = await loginService.login(credentials, loginUrl);
    if (isLoggedIn) {
      console.log('Login successful');
    } else {
      console.log('Login failed');
      return;
    }

    // input data
    const inputDataService = new InputDataService(page);
    const nik: string = '3215251109860001'; // Replace with the NIK you want to input
    await inputDataService.inputData(nik);
    
    
    const title: string = await page.title();
    console.log('Page title:', title);
    
    // Your automation logic goes here
    
  } catch (error: unknown) {
    console.error('Error:', error);
  } finally {
    // await browser.close();
  }
}

runAutomation().catch(console.error);
