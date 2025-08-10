import { chromium, Browser, Page } from 'playwright';

export async function createBrowser(): Promise<Browser> {
    return chromium.launch({ headless: false });
}

export async function waitForPageLoad(page: Page) {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(6000);
   }