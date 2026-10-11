// Pure 8-player knockout: two semi tables of four, top two of each reach the final of four.
export type TableId = "semi1" | "semi2" | "final";

export interface TournamentTable {
  id: TableId;
  /** Player indices (into Tournament.names) seated at this table, in seat order. */
  seats: number[];
  /** Player indices in finishing order (1st first), or null until played. */
  result: number[] | null;
}

export interface Tournament {
  names: string[];
  tables: TournamentTable[];
}

export class TournamentError extends Error {}

export const TOURNAMENT_SIZE = 8;

export function createTournament(names: string[]): Tournament {
  if (names.length !== TOURNAMENT_SIZE) throw new TournamentError(`A tournament needs ${TOURNAMENT_SIZE} players`);
  const pick = (parity: number) => names.map((_, i) => i).filter((i) => i % 2 === parity);
  return {
    names: [...names],
    tables: [
      { id: "semi1", seats: pick(0), result: null },
      { id: "semi2", seats: pick(1), result: null },
      { id: "final", seats: [], result: null },
    ],
  };
}

/** The first two finishers of a played table. */
export function advancers(table: TournamentTable): number[] {
  return table.result ? table.result.slice(0, 2) : [];
}

export function recordResult(t: Tournament, id: TableId, order: number[]): Tournament {
  const table = t.tables.find((x) => x.id === id);
  if (!table) throw new TournamentError(`Unknown table ${id}`);
  if (table.result) throw new TournamentError(`Table ${id} is already played`);
  if (id === "final" && table.seats.length === 0) throw new TournamentError("The final is not set yet");
  if (order.length !== table.seats.length || new Set(order).size !== order.length || !order.every((p) => table.seats.includes(p))) {
    throw new TournamentError("Result must rank every player at the table once");
  }
  const tables = t.tables.map((x) => (x.id === id ? { ...x, result: [...order] } : x));
  const [s1, s2] = tables;
  const final = tables[2];
  if (s1.result && s2.result && final.seats.length === 0) final.seats = [...advancers(s1), ...advancers(s2)];
  return { names: t.names, tables };
}

/** The next table to play, or null once the final is done. */
export function currentTable(t: Tournament): TournamentTable | null {
  return t.tables.find((x) => !x.result && x.seats.length > 0) ?? null;
}

export function champion(t: Tournament): number | null {
  return t.tables[2].result?.[0] ?? null;
}
