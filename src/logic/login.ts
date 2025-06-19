import { Page } from 'puppeteer';

interface LoginCredentials {
  username: string;
  password: string;
}

export class LoginService {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async login(credentials: LoginCredentials, loginUrl: string): Promise<boolean> {
    try {
      await this.page.goto(loginUrl);
      
      // Wait for login form to load
      await this.page.waitForSelector('input[type="email"], input[name="username"], input[name="email"]');
      
      // Fill in credentials
      await this.page.type('input[type="email"], input[name="username"], input[name="email"]', credentials.username);
      await this.page.type('input[type="password"], input[name="password"]', credentials.password);
      
      // Submit form
      await this.page.click('button[type="submit"], input[type="submit"]');
      
      // Wait for navigation or success indicator
      await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
      
      return true;
    } catch (error: unknown) {
      console.error('Login failed:', error);
      return false;
    }
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      // Check for common indicators of being logged in
      const logoutButton = await this.page.$('a[href*="logout"], button[data-action="logout"]');
      const userProfile = await this.page.$('.user-profile, .profile, [data-testid="user-menu"]');
      
      return !!(logoutButton || userProfile);
    } catch (error: unknown) {
      console.error('Error checking login status:', error);
      return false;
    }
  }
}
