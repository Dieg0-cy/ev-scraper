import { createBrowser } from './browser';
import { scrapePinnacleProps } from './scraper';
import { analyzeParlays, displayTopParlays } from './parlay';
import * as fs from 'fs';

async function main() {
    console.log('Starting MLB props scraper...');
    const browser = await createBrowser();

    try {
        console.log('Browser created, starting prop scraping...');
        const props = await scrapePinnacleProps(browser);

        console.log('\nAnalyzing MLB Parlays...');
        const parlayAnalysis = analyzeParlays(props);

        // Display results
        console.log('\n=== MLB RESULTS ===');
        displayTopParlays(parlayAnalysis, 5);

        // Prepare output structure
        const finalOutput = {
            timestamp: new Date().toISOString(),
            mlb: {
                props: props,
                parlayAnalysis: {
                    count: parlayAnalysis.length,
                    topParlays: parlayAnalysis.slice(0, 10)
                }
            }
        };

        // Save to file
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        fs.writeFileSync(
            `props_${timestamp}.json`, 
            JSON.stringify(finalOutput, null, 2)
        );

        // Display summary
        console.log('\nSummary:');
        console.log(`MLB Props: ${props.length}`);
        console.log(`MLB +EV Parlays: ${parlayAnalysis.length}`);

    } catch (err) {
        console.error('Fatal error in main:', err);
    } finally {
        console.log('Closing browser...');
        await browser.close();
        console.log('Browser closed. Script complete.');
    }
}

main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});