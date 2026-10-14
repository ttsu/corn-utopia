import type { World } from './sim/world';
import { DT } from './sim/world';
import { storageKey } from './storageKey';

const STORAGE_KEY = storageKey('corn-utopia.playtest.v1');
const MAX_RUNS = 30;

/** One finished run, matching the metrics in the playtest plan (GDD §17). */
export interface RunSummary {
  at: string;
  seed: number;
  loadout?: string;
  seconds: number;
  maxKernels: number;
  maxTier: number;
  chomps: number;
  bestStreak: number;
  chompsPerMinute: number;
  shots: Record<string, number>;
  shotsPerChomp: number;
  firedRecoveredPct: number;
  tinks: number;
  avgPressesAfterTink: number | null;
  bumps: number;
  avgFps: number;
}

export function summarize(w: World, avgFps: number): RunSummary {
  const s = w.stats;
  const seconds = s.ticks * DT;
  const switches = s.switchesAfterTink;
  return {
    at: new Date().toISOString(),
    seed: w.seed,
    loadout: w.loadout,
    seconds: Math.round(seconds),
    maxKernels: s.maxKernels,
    maxTier: s.maxTier,
    chomps: s.chomps,
    bestStreak: s.bestStreak,
    chompsPerMinute: Math.round((s.chomps / Math.max(seconds / 60, 1 / 60)) * 10) / 10,
    shots: { ...s.shots },
    shotsPerChomp: Math.round((s.firedTotal / Math.max(1, s.chomps)) * 10) / 10,
    firedRecoveredPct: s.firedTotal > 0 ? Math.round((Math.min(s.firedRecovered, s.firedTotal) / s.firedTotal) * 100) : 0,
    tinks: s.tinks,
    avgPressesAfterTink: switches.length > 0 ? Math.round((switches.reduce((a, b) => a + b, 0) / switches.length) * 10) / 10 : null,
    bumps: s.bumps,
    avgFps: Math.round(avgFps),
  };
}

export function loadLog(): RunSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RunSummary[]) : [];
  } catch {
    return [];
  }
}

export function appendLog(run: RunSummary): void {
  const log = loadLog();
  log.unshift(run);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log.slice(0, MAX_RUNS)));
  } catch {
    // Ignore storage failures; the results screen still shows this run.
  }
}

export function clearLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatLog(log: RunSummary[]): string {
  if (log.length === 0) return 'No runs yet.';
  return log
    .map(
      (r) =>
        `${r.at.slice(0, 16).replace('T', ' ')}  ${r.loadout === 'playtest' ? 'mix ' : ''}${formatTime(r.seconds)}  max ${r.maxKernels}  chomps ${r.chomps} ` +
        `(${r.chompsPerMinute}/min)  shots/chomp ${r.shotsPerChomp}  scooped ${r.firedRecoveredPct}%  ` +
        `tinks ${r.tinks}  presses-after-tink ${r.avgPressesAfterTink ?? '-'}  fps ${r.avgFps}`,
    )
    .join('\n');
}
