import { PropBet } from './scraper';

export interface ParlayEVResult {
    ev: number;
    probabilityToWin: number;
    parlayDecimalOdds: number;
    fairParlayOdds: number;
    recommendation: string;
}

export function calculateParlayEV(prop1: PropBet, prop2: PropBet): ParlayEVResult {
    // EV calculation logic here...
}

export function analyzeParlays(props: PropBet[]): Array<{
    player1: string;
    prop1: string;
    pick1: 'OVER' | 'UNDER';
    player2: string;
    prop2: string;
    pick2: 'OVER' | 'UNDER';
    analysis: ParlayEVResult;
}> {
    // Parlay analysis logic here...
   }