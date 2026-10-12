// Week-scoped leaderboard. Pure state so it can be tested; the Durable Object only persists it.
import { cleanName } from "../../src/engine/protocol";
import { nextRung, rewardsEarned } from "../../src/engine/tournament";

export interface BoardEntry {
  name: string;
  wins: number;
  /** When the latest win landed; earlier wins rank higher on a tie. */
  last: number;
}

export interface BoardData {
  week: string;
  players: Record<string, BoardEntry>;
}

export const MAX_BOARD_PLAYERS = 2000;
export const PLAYER_ID = /^[A-Za-z0-9_-]{4,64}$/;

export class WeekBoard {
  constructor(
    week: string,
    public data: BoardData = { week, players: {} },
  ) {}

  recordWin(id: string, name: string, now: number): void {
    if (!PLAYER_ID.test(id)) return;
    const e = this.data.players[id];
    if (e) {
      e.wins += 1;
      e.last = now;
      e.name = cleanName(name, e.name);
    } else if (Object.keys(this.data.players).length < MAX_BOARD_PLAYERS) {
      this.data.players[id] = { name: cleanName(name), wins: 1, last: now };
    }
  }

  top(n: number): { name: string; wins: number }[] {
    return Object.values(this.data.players)
      .sort((a, b) => b.wins - a.wins || a.last - b.last)
      .slice(0, n)
      .map(({ name, wins }) => ({ name, wins }));
  }

  /** One player's place on the ladder this week. */
  view(id: string | null) {
    const wins = (id && this.data.players[id]?.wins) || 0;
    return { wins, rewards: rewardsEarned(wins).map((r) => r.reward), next: nextRung(wins) };
  }
}
