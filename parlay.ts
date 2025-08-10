import { PropBet } from './scraper';

export interface ParlayEVResult {
    ev: number;
    probabilityToWin: number;
    parlayDecimalOdds: number;
    fairParlayOdds: number;
    recommendation: string;
}

export function calculateParlayEV(prop1: PropBet, prop2: PropBet): ParlayEVResult {
    // Implied probabilities for each leg
    const impliedProb1 = 1 / prop1.odds;
    const impliedProbOpp1 = 1 / prop1.oppOdds;
    const totalProb1 = impliedProb1 + impliedProbOpp1;
    const trueProb1 = impliedProb1 / totalProb1;

    const impliedProb2 = 1 / prop2.odds;
    const impliedProbOpp2 = 1 / prop2.oppOdds;
    const totalProb2 = impliedProb2 + impliedProbOpp2;
    const trueProb2 = impliedProb2 / totalProb2;

    // Parlay probability
    const trueParlayProb = trueProb1 * trueProb2;

    // Offered parlay odds (product of both legs)
    const parlayDecimalOdds = prop1.odds * prop2.odds;
    const fairParlayOdds = trueParlayProb > 0 ? 1 / trueParlayProb : 0;

    // EV calculation (assuming $100 stake)
    const stake = 100;
    const toWin = 200; //PrizePicks typically pays out 2x the stake for a parlay win
    const ev = (trueParlayProb * toWin) - ((1 - trueParlayProb) * stake);

    let recommendation = 'PASS';
    if (ev > 5) recommendation = 'STRONG +EV';
    else if (ev > 0) recommendation = '+EV';

    return {
        ev,
        probabilityToWin: trueParlayProb,
        parlayDecimalOdds,
        fairParlayOdds,
        recommendation
    };
}

export function analyzeParlays(props: PropBet[]): Array<{
    player1: string;
    stat1: string;
    pick1: 'OVER' | 'UNDER';
    player2: string;
    stat2: string;
    pick2: 'OVER' | 'UNDER';
    analysis: ParlayEVResult;
}> {
    const results: Array<{
        player1: string;
        stat1: string;
        pick1: 'OVER' | 'UNDER';
        player2: string;
        stat2: string;
        pick2: 'OVER' | 'UNDER';
        analysis: ParlayEVResult;
    }> = [];

    for (let i = 0; i < props.length; i++) {
        for (let j = i + 1; j < props.length; j++) {
            const propA = props[i];
            const propB = props[j];

            // Helper function to swap odds for UNDER picks
            const adjustProp = (prop: PropBet, isUnder: boolean): PropBet => ({
                ...prop,
                odds: isUnder ? prop.oppOdds : prop.odds,
                oppOdds: isUnder ? prop.odds : prop.oppOdds
            });

            // Generate all combinations
            const combinations: Array<[boolean, boolean]> = [
                [false, false], // OVER/OVER
                [false, true],  // OVER/UNDER
                [true, false],  // UNDER/OVER
                [true, true]    // UNDER/UNDER
            ];

            for (const [isUnderA, isUnderB] of combinations) {
                const adjustedPropA = adjustProp(propA, isUnderA);
                const adjustedPropB = adjustProp(propB, isUnderB);

                results.push({
                    player1: propA.player,
                    stat1: propA.stat,
                    pick1: isUnderA ? 'UNDER' : 'OVER',
                    player2: propB.player,
                    stat2: propB.stat,
                    pick2: isUnderB ? 'UNDER' : 'OVER',
                    analysis: calculateParlayEV(adjustedPropA, adjustedPropB)
                });
            }
        }
    }

    results.sort((a, b) => b.analysis.ev - a.analysis.ev);
    return results;
}