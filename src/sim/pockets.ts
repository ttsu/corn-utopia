import { POWER_KINDS, type PowerKind } from './kernels';

/**
 * Fills power pockets from the powers you're actually holding.
 * Existing pocket order is kept. Newly gained powers take an empty pocket, or
 * wait in line when every pocket is full. Empty powers drop out, and the next
 * waiting power moves in on its own.
 */
export function layoutPockets(
  counts: Partial<Record<PowerKind, number>>,
  slots: number,
  pockets: readonly PowerKind[],
  waiting: readonly PowerKind[],
): { pockets: PowerKind[]; waiting: PowerKind[] } {
  const owned = (k: PowerKind) => (counts[k] ?? 0) > 0;
  const nextPockets = pockets.filter(owned);
  const seen = new Set(nextPockets);
  const nextWaiting = waiting.filter((k) => owned(k) && !seen.has(k));
  for (const k of nextWaiting) seen.add(k);
  for (const k of POWER_KINDS) {
    if (!owned(k) || seen.has(k)) continue;
    seen.add(k);
    if (nextPockets.length < slots) nextPockets.push(k);
    else nextWaiting.push(k);
  }
  while (nextPockets.length < slots && nextWaiting.length > 0) nextPockets.push(nextWaiting.shift()!);
  while (nextPockets.length > slots) nextWaiting.unshift(nextPockets.pop()!);
  return { pockets: nextPockets, waiting: nextWaiting };
}

/** Trades one pocketed power for one waiting power. Returns false if either isn't where it should be. */
export function swapPocket(pockets: PowerKind[], waiting: PowerKind[], pocket: PowerKind, withKind: PowerKind): boolean {
  const i = pockets.indexOf(pocket);
  const j = waiting.indexOf(withKind);
  if (i < 0 || j < 0 || pocket === withKind) return false;
  pockets[i] = withKind;
  waiting[j] = pocket;
  return true;
}
