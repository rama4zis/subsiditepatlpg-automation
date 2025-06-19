import puppeteer, { Browser, Page } from 'puppeteer';

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
    await page.goto('https://google.com');
    
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
