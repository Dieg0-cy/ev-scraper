"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
async function createBrowser() {
    return playwright_1.chromium.launch({
        headless: false,
    });
}
async function waitForPageLoad(page) {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
}
async function scrapePrizePicks(browser) {
    const page = await browser.newPage();
    console.log('Navigating to PrizePicks...');
    try {
        await page.goto('https://app.prizepicks.com/', {
            waitUntil: 'networkidle',
            timeout: 60000
        });
        await waitForPageLoad(page);
        // Wait for and click on NFL category if it exists
        try {
            const nflButton = await page.waitForSelector('text="NFL"', { timeout: 5000 });
            await nflButton?.click();
            await waitForPageLoad(page);
        }
        catch (e) {
            console.log('NFL category not found, using default view');
        }
        console.log('Scraping PrizePicks props...');
        const props = await page.$$eval('.projection-card', (cards) => {
            return cards.map((card) => {
                const playerName = card.querySelector('.name')?.textContent?.trim() || '';
                const statElement = card.querySelector('.text-stats')?.textContent?.trim() || '';
                const lineElement = card.querySelector('.score')?.textContent?.trim() || '0';
                const marketElement = card.querySelector('.league')?.textContent?.trim() || '';
                return {
                    player: playerName,
                    stat: statElement,
                    line: parseFloat(lineElement),
                    type: 'OVER', // Will create duplicate entries for UNDER
                    market: marketElement,
                    site: 'PrizePicks',
                    timestamp: new Date().toISOString()
                };
            });
        });
        // Create duplicate entries with UNDER type
        const propsWithBothTypes = props.flatMap(prop => [
            prop,
            { ...prop, type: 'UNDER' }
        ]);
        return propsWithBothTypes;
    }
    catch (error) {
        console.error('PrizePicks scraping error:', error);
        return [];
    }
}
async function scrapeFanDuelProps(browser) {
    const page = await browser.newPage();
    console.log('Navigating to FanDuel...');
    try {
        await page.goto('https://sportsbook.fanduel.com/navigation/nfl', {
            waitUntil: 'networkidle',
            timeout: 60000
        });
        await waitForPageLoad(page);
        // Click on "Player Props" tab if it exists
        try {
            const propsTab = await page.waitForSelector('text="Player Props"', { timeout: 5000 });
            await propsTab?.click();
            await waitForPageLoad(page);
        }
        catch (e) {
            console.log('Player Props tab not found');
        }
        console.log('Scraping FanDuel props...');
        const props = await page.$$eval('[data-testid="prop-cell"]', (cells) => {
            return cells.map((cell) => {
                const playerName = cell.querySelector('[data-testid="player-name"]')?.textContent?.trim() || '';
                const statType = cell.querySelector('[data-testid="prop-type"]')?.textContent?.trim() || '';
                const line = cell.querySelector('[data-testid="prop-line"]')?.textContent?.trim() || '0';
                return {
                    player: playerName,
                    stat: statType,
                    line: parseFloat(line),
                    type: 'OVER',
                    market: 'NFL',
                    site: 'FanDuel',
                    timestamp: new Date().toISOString()
                };
            });
        });
        // Create duplicate entries with UNDER type
        const propsWithBothTypes = props.flatMap(prop => [
            prop,
            { ...prop, type: 'UNDER' }
        ]);
        return propsWithBothTypes;
    }
    catch (error) {
        console.error('FanDuel scraping error:', error);
        return [];
    }
}
async function main() {
    console.log('Starting browser...');
    const browser = await createBrowser();
    try {
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            geolocation: { latitude: 34.0522, longitude: -118.2437 }, // Los Angeles coordinates
            permissions: ['geolocation']
        });
        const prizePicks = await scrapePrizePicks(browser);
        console.log('PrizePicks results:', prizePicks);
        const fanDuelProps = await scrapeFanDuelProps(browser);
        console.log('FanDuel props results:', fanDuelProps);
        // Combine and save results
        const allProps = [...prizePicks, ...fanDuelProps];
        console.log(`Total props found: ${allProps.length}`);
        // Save to file with timestamp
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const fs = require('fs');
        fs.writeFileSync(`props_${timestamp}.json`, JSON.stringify(allProps, null, 2));
    }
    catch (err) {
        console.error('Error in main:', err);
    }
    finally {
        await browser.close();
        console.log('Browser closed');
    }
}
main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
