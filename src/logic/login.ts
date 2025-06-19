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
            await this.page.waitForSelector('input[id="mantine-r0"]', { timeout: 5000 });

            if(await this.page.$('input[id="mantine-r0"]') === null) {
                console.error('Login form not found. Please check the login URL or selector.');
                return false;
            } else {
                console.log('Login form found, proceeding with login.');
            }

            // Fill in credentials
            await this.page.type('input[id="mantine-r0"]', credentials.username, { delay: 200 });
            await this.page.type('input[id="mantine-r1"]', credentials.password, { delay: 200 });

            // Submit form
            await this.page.click('button[type="submit"], input[type="submit"]');

            // Wait for navigation or success indicator
            await this.page.waitForNavigation({ waitUntil: 'load' });

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
