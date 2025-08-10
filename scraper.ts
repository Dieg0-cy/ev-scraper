import { Browser } from 'playwright';
import { waitForPageLoad } from './browser';

export type PropBet = {
    player: string;
    stat: string;
    line: number;
    type: 'OVER' | 'UNDER';
    odds: number;
    oppOdds: number;
    market: 'MLB';
    site: 'Pinnacle';
    timestamp: string;
};

export async function scrapePinnacleProps(browser: Browser): Promise<PropBet[]> {
    console.log('Starting MLB props scraping...');
    return scrapePinnacleLeagueProps(browser, 'MLB');
}

async function scrapePinnacleLeagueProps(browser: Browser, league: 'MLB'): Promise<PropBet[]> {
    const page = await browser.newPage();
    const leagueUrl = 'https://www.pinnacle.com/en/baseball/mlb/matchups';

    console.log(`Navigating to Pinnacle MLB...`);

    try {
        await page.goto(leagueUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        await waitForPageLoad(page);
        console.log('Main page loaded');

        // Collect all game URLs at the start
        await page.waitForSelector('a.btn-A8l3Dghoy5', { timeout: 30000 });
        const gameLinks = await page.$$eval('a.btn-A8l3Dghoy5', links =>
            links.map(link => (link as HTMLAnchorElement).getAttribute('href')).filter(Boolean)
        );
        console.log(`Found ${gameLinks.length} games`);

        let allProps: PropBet[] = [];
        let gameCount = 0;

        for (const href of gameLinks) {
            gameCount++;
            if (!href) {
                console.log('No href found for game button, skipping...');
                continue;
            }

            const propsUrl = `https://www.pinnacle.com${href}#player-props`;
            console.log(`\nProcessing game ${gameCount} of ${gameLinks.length}`);
            console.log(`Navigating to: ${propsUrl}`);

            try {
                await page.goto(propsUrl, { waitUntil: 'networkidle', timeout: 60000 });
                await waitForPageLoad(page);

                // Wait for prop elements with timeout
                const hasProps = await page.waitForSelector('div[data-test-id^="Event.Row"]', {
                    timeout: 30000
                }).then(() => true).catch(() => false);

                if (!hasProps) {
                    console.log('No prop elements found for this game, skipping...');
                    // Navigate back to the games page before continuing
                    await page.goto(leagueUrl, { waitUntil: 'networkidle', timeout: 60000 });
                    await waitForPageLoad(page);
                    continue;
                }

                console.log('Found prop elements, proceeding with extraction...');

                // Expand all collapsed prop rows
                await page.evaluate(() => {
                    const propRows = document.querySelectorAll('div[data-test-id^="Event.Row"]');
                    propRows.forEach(row => {
                        if (row.getAttribute('data-collapsed') === 'true') {
                            const titleDiv = row.querySelector('.title-BzVHkr9xRI');
                            if (titleDiv) {
                                (titleDiv as HTMLElement).click();
                            }
                        }
                    });
                });

                await page.waitForTimeout(2000);

                // Now extract the props
                const gameProps = await page.evaluate((leagueParam) => {
                    const props: any[] = [];
                    const propRows = document.querySelectorAll('div[data-test-id^="Event.Row"]:not([data-collapsed="true"])');
                    propRows.forEach(row => {
                        try {
                            const titleSpan = row.querySelector('.titleText-BgvECQYfHf');
                            const titleText = titleSpan?.textContent?.trim() || '';
                            let player, statType;
                            const bracketMatch = titleText.match(/(.*?)\s*\((.*?)\)/);
                            if (bracketMatch) {
                                const [fullMatch, matchedPlayer, matchedStat] = bracketMatch;
                                player = matchedPlayer;
                                statType = matchedStat;
                            } else {
                                const totalMatch = titleText.match(/(.*?)\s+Total\s+(.*)/i);
                                if (totalMatch) {
                                    const [fullMatch, matchedPlayer, matchedStat] = totalMatch;
                                    player = matchedPlayer;
                                    statType = matchedStat;
                                } else {
                                    return;
                                }
                            }
                            const buttons = row.querySelectorAll('button.market-btn');
                            const overButton = buttons[0];
                            const underButton = buttons[1];
                            if (overButton && underButton) {
                                const marketText = overButton.querySelector('.label-GT4CkXEOFj')?.textContent || '';
                                const overLine = marketText.match(/Over\s+(\d+\.?\d*)/)?.[1] || '0';
                                const overOddsElem = overButton.querySelector('.price-r5BU0ynJha');
                                const underOddsElem = underButton.querySelector('.price-r5BU0ynJha');
                                const overOddsText = overOddsElem?.textContent?.trim() || '0';
                                const underOddsText = underOddsElem?.textContent?.trim() || '0';
                                const overOdds = parseFloat(parseFloat(overOddsText).toFixed(3));
                                const underOdds = parseFloat(parseFloat(underOddsText).toFixed(3));
                                if (!player || player === "Team" || statType.match(/Inning|Half|Game/i)) return;
                                let normalizedStat = statType.replace(/^Total\s+/i, '').trim();
                                if (normalizedStat.toLowerCase().includes('strikeout')) normalizedStat = 'Strikeouts';
                                if (normalizedStat.toLowerCase().includes('hit')) normalizedStat = 'Hits';
                                if (normalizedStat.toLowerCase().includes('run')) normalizedStat = 'Runs';
                                if (normalizedStat.toLowerCase().includes('base')) normalizedStat = 'Bases';
                                props.push({
                                    player: player.trim(),
                                    stat: normalizedStat,
                                    line: parseFloat(overLine),
                                    overOdds: overOdds,
                                    underOdds: underOdds,
                                    market: leagueParam,
                                    site: 'Pinnacle',
                                    timestamp: new Date().toISOString()
                                });
                            }
                        } catch (err) {}
                    });
                    return props;
                }, league);

                const processedProps = gameProps.flatMap(prop => [
                    {
                        player: prop.player,
                        stat: prop.stat,
                        line: prop.line,
                        type: 'OVER' as const,
                        odds: prop.overOdds,
                        oppOdds: prop.underOdds,
                        market: prop.market,
                        site: 'Pinnacle' as const,
                        timestamp: prop.timestamp
                    },
                    {
                        player: prop.player,
                        stat: prop.stat,
                        line: prop.line,
                        type: 'UNDER' as const,
                        odds: prop.underOdds,
                        oppOdds: prop.overOdds,
                        market: prop.market,
                        site: 'Pinnacle' as const,
                        timestamp: prop.timestamp
                    }
                ]);

                allProps = [...allProps, ...processedProps];
                console.log(`Found ${processedProps.length} props in current game`);

                // Navigate back to the games page before next iteration
                await page.goto(leagueUrl, { waitUntil: 'networkidle', timeout: 60000 });
                await waitForPageLoad(page);

                console.log(`Successfully processed game ${gameCount}`);

            } catch (e) {
                console.error(`Error processing game ${gameCount}:`, e);
                // Try to recover by going back to the games page
                await page.goto(leagueUrl, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
                await waitForPageLoad(page).catch(() => {});
                await page.waitForTimeout(2000);
            }
        }

        console.log('\nScraping complete!');
        console.log(`Total props found across all games: ${allProps.length}`);

        return allProps;

    } catch (error) {
        console.error(`Fatal scraping error for ${league}:`, error);
        return [];
    } finally {
        await page.close().catch(() => {});
    }
}

