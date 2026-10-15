import type { PowerKind } from './kernels';

/** 0, or the milestone you have reached: 5, 10, or 20. */
export type Milestone = 0 | 5 | 10 | 20;

export function milestoneOf(count: number): Milestone {
  if (count >= 20) return 20;
  if (count >= 10) return 10;
  if (count >= 5) return 5;
  return 0;
}

/**
 * What each copy-count does. Spicy is the one the design doc spells out.
 * The others follow the same shape: a bigger version, then a stronger one,
 * then a named trick at 20.
 */
export function milestoneName(kind: PowerKind, level: Milestone): string | null {
  if (level === 0) return null;
  const names: Record<PowerKind, [string, string, string]> = {
    zinger: ['Zippy', 'Hard Bonk', 'Volley'],
    spicy: ['Big Fireball', 'Split', 'Flamethrower'],
    popper: ['Big Pop', 'Heavy Pop', 'Popcorn Rain'],
    frosty: ['Long Chill', 'Quick Freeze', 'Blizzard'],
    boing: ['Extra Bounces', 'Hard Boing', 'Pinball'],
    zappy: ['Long Chain', 'Longer Chain', 'Storm'],
    caramel: ['Sticky', 'Wide Puddle', 'Taffy'],
    sprout: ['Long Garden', 'Fast Seeds', 'Garden'],
    gem: ['Triple', 'Double Cast', 'Prism'],
  };
  const row = names[kind];
  if (level === 5) return row[0];
  if (level === 10) return row[1];
  return row[2];
}
