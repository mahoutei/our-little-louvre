export class WingFullError extends Error {
  constructor(maxAlleys: number) {
    super(`The New Wing has reached its ${maxAlleys}-alley limit.`);
    this.name = 'WingFullError';
  }
}

export type OccupiedSlot = { alleyIndex: number | null; slotIndex: number | null };
export type TargetSlot = { alleyIndex: number; slotIndex: number; newAlley: boolean };

const key = (alleyIndex: number, slotIndex: number) => `${alleyIndex}:${slotIndex}`;

export function occupiedSet(exhibits: readonly OccupiedSlot[]): Set<string> {
  const occupied = new Set<string>();
  for (const exhibit of exhibits) {
    if (exhibit.alleyIndex === null || exhibit.slotIndex === null) continue;
    occupied.add(key(exhibit.alleyIndex, exhibit.slotIndex));
  }
  return occupied;
}

export function highestAlley(exhibits: readonly OccupiedSlot[]): number {
  let highest = -1;
  for (const exhibit of exhibits) {
    if (exhibit.alleyIndex === null) continue;
    highest = Math.max(highest, exhibit.alleyIndex);
  }
  return highest;
}

export type WingRow = { alleyIndex: number | null; slotIndex: number | null };
export type WingGroup<T extends WingRow> = { index: number; rows: T[]; remaining: number };

/**
 * Groups every wing row, including hidden ones, so the museum can show the
 * real number of free frames without receiving a hidden photograph's details.
 */
export function groupWingRows<T extends WingRow>(rows: readonly T[], capacity: number): WingGroup<T>[] {
  const groups = new Map<number, WingGroup<T>>();
  for (const row of rows) {
    const index = row.alleyIndex ?? 0;
    let group = groups.get(index);
    if (!group) {
      group = { index, rows: [], remaining: capacity };
      groups.set(index, group);
    }
    group.rows.push(row);
    if (row.slotIndex !== null && row.slotIndex >= 0 && row.slotIndex < capacity) {
      group.remaining = Math.max(0, group.remaining - 1);
    }
  }
  return [...groups.values()].sort((a, b) => a.index - b.index);
}

/**
 * Picks the first empty frame in hanging order. Gaps left by deleted photographs
 * are filled first; when every existing frame is taken, the next alley opens.
 */
export function nextWingSlot(exhibits: readonly OccupiedSlot[], capacity: number, maxAlleys: number): TargetSlot {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Alley capacity must be a positive integer.');
  if (!Number.isInteger(maxAlleys) || maxAlleys < 1) throw new Error('Maximum alley count must be a positive integer.');
  const occupied = occupiedSet(exhibits);
  const highest = highestAlley(exhibits);
  const lastNewAlley = Math.min(highest + 1, maxAlleys - 1);
  // Existing alleys stay usable even if the growth limit was lowered later.
  const lastSearchedAlley = Math.max(highest, lastNewAlley);

  for (let alleyIndex = 0; alleyIndex <= lastSearchedAlley; alleyIndex++) {
    for (let slotIndex = 0; slotIndex < capacity; slotIndex++) {
      if (occupied.has(key(alleyIndex, slotIndex))) continue;
      return { alleyIndex, slotIndex, newAlley: alleyIndex > highest };
    }
  }
  throw new WingFullError(maxAlleys);
}
