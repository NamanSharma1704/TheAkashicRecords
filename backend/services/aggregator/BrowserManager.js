const { chromium } = require('playwright-chromium');

/**
 * BrowserManager
 *
 * Singleton utility to manage a shared Playwright instance for headless extraction.
 * Reduces resource overhead by reusing the browser while providing isolated pages.
 */
class BrowserManager {
    constructor() {
        this.browser = null;
        this.context = null;
        this.isLaunched = false;
    }

    async getBrowser() {
        if (!this.isLaunched || !this.browser) {
            console.log('[BrowserManager] Checking environment...');
            if (process.env.VERCEL || process.env.VERCEL_ENV) {
                console.log('[BrowserManager] Serverless environment detected. Cannot launch full Chromium.');
                return null; // Return null if Vercel serverless environment
            }

            console.log('[BrowserManager] Launching isolated Chromium instance...');
            try {
                this.browser = await chromium.launch({
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu',
                        '--disable-blink-features=AutomationControlled'
                    ]
                });
                this.context = await this.browser.newContext({
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                    viewport: { width: 1280, height: 720 },
                    locale: 'en-US'
                });
                this.isLaunched = true;
            } catch (error) {
                console.error('[BrowserManager] Failed to launch Chromium:', error.message);
                return null; // Return null on launch failure
            }
        }
        return this.browser;
    }

    /**
     * Executes a callback within a temporary isolated page.
     * Automatically handles page lifecycle and error cleanup.
     */
    async withPage(callback) {
        const browser = await this.getBrowser();
        if (!browser) {
            throw new Error('SERVERLESS_UNSUPPORTED');
        }

        const page = await this.context.newPage();

        // Speed up execution by bypassing stealth overhead on static sites, but keeping it
        // Increase max timeout to allow Javascript Anti-Bot checks to pass (e.g. CloudFlare Turnstile)
        page.setDefaultNavigationTimeout(25000);
        page.setDefaultTimeout(25000);

        // Stealth Overrides
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        try {
            return await callback(page);
        } finally {
            await page.close();
        }
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.isLaunched = false;
        }
    }
}

module.exports = new BrowserManager();
