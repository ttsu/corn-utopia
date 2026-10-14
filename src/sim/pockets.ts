import { POWER_KINDS, type PowerKind } from './kernels';

function byKind(a: PowerKind, b: PowerKind): number {
  return POWER_KINDS.indexOf(a) - POWER_KINDS.indexOf(b);
}

/**
 * Decides which powers are armed. A power stays on its own button: running out
 * does not hand that button to something else, and a new power never slides
 * into another power's place. Extras wait, dimmed, on their own button.
 * Growing the pocket count arms the next waiting power in button order.
 */
export function layoutPockets(
  counts: Partial<Record<PowerKind, number>>,
  slots: number,
  pockets: readonly PowerKind[],
  waiting: readonly PowerKind[],
): { pockets: PowerKind[]; waiting: PowerKind[] } {
  const owned = (k: PowerKind) => (counts[k] ?? 0) > 0;
  const nextPockets = [...pockets];
  const nextWaiting = waiting.filter((k) => !nextPockets.includes(k));
  const seen = new Set<PowerKind>([...nextPockets, ...nextWaiting]);
  for (const k of POWER_KINDS) {
    if (!owned(k) || seen.has(k)) continue;
    seen.add(k);
    if (nextPockets.length < slots) nextPockets.push(k);
    else nextWaiting.push(k);
  }
  nextWaiting.sort(byKind);
  while (nextPockets.length < slots && nextWaiting.length > 0) nextPockets.push(nextWaiting.shift()!);
  while (nextPockets.length > slots) {
    let drop = 0;
    for (let i = 1; i < nextPockets.length; i++) {
      if (POWER_KINDS.indexOf(nextPockets[i]) >= POWER_KINDS.indexOf(nextPockets[drop])) drop = i;
    }
    nextWaiting.unshift(nextPockets.splice(drop, 1)[0]);
  }
  nextPockets.sort(byKind);
  nextWaiting.sort(byKind);
  return { pockets: nextPockets, waiting: nextWaiting };
}

/**
 * Arms a waiting power. If every pocket is full, it trades with an empty armed
 * power, or else the armed power latest in button order. Provisional until the
 * swap gesture is playtested. Buttons do not move either way.
 */
export function armPower(
  pockets: PowerKind[],
  waiting: PowerKind[],
  kind: PowerKind,
  counts: Partial<Record<PowerKind, number>>,
): boolean {
  const j = waiting.indexOf(kind);
  if (j < 0 || (counts[kind] ?? 0) <= 0 || pockets.length === 0) return false;
  let drop = -1;
  for (let i = 0; i < pockets.length; i++) {
    if ((counts[pockets[i]] ?? 0) > 0) continue;
    if (drop < 0 || POWER_KINDS.indexOf(pockets[i]) > POWER_KINDS.indexOf(pockets[drop])) drop = i;
  }
  if (drop < 0) {
    drop = 0;
    for (let i = 1; i < pockets.length; i++) {
      if (POWER_KINDS.indexOf(pockets[i]) > POWER_KINDS.indexOf(pockets[drop])) drop = i;
    }
  }
  const displaced = pockets[drop];
  pockets[drop] = kind;
  waiting[j] = displaced;
  pockets.sort(byKind);
  waiting.sort(byKind);
  return true;
}
