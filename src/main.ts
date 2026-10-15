import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { Sfx } from './audio';
import { Input } from './input';
import { appendLog, clearLog, formatLog, formatTime, loadLog, summarize } from './playtestLog';
import { Renderer } from './render';
import { loadSettings, saveSettings, type Difficulty } from './settings';
import { total } from './sim/cob';
import { perkDef } from './sim/perks';
import { DT, EMPTY_COMMAND, createWorld, debugGrow, step, tierName, type Loadout, type SimEvent, type World } from './sim/world';
import { PowerButtons } from './ui/powerButtons';
import { TuningPanel, loadTuning } from './ui/tuningPanel';

type Mode = 'title' | 'playing' | 'paused' | 'earup' | 'deal' | 'over';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('game');
const hud = $('hud');
const screens = {
  title: $('screen-title'),
  paused: $('screen-pause'),
  earup: $('screen-earup'),
  deal: $('screen-deal'),
  over: $('screen-over'),
};
const tierFill = $('tier-fill');
const tierLabel = $('tier-label');
const chipTime = $('chip-time');
const chipChomps = $('chip-chomps');
const chipSeeds = $('chip-seeds');
const debugInfo = $('debug-info');

const tuning = loadTuning();
const settings = loadSettings();
const tuningPanel = new TuningPanel($('tuning'), tuning);
const sfx = new Sfx();
const renderer = await Renderer.create(canvas);
const input = new Input(canvas, () => togglePause());
const powerButtons = new PowerButtons(
  $('powers'),
  (kind) => {
    sfx.unlock();
    input.queueFire(kind);
  },
  () => {
    sfx.unlock();
    input.queueDash();
  },
  () => {
    sfx.unlock();
    input.queueSmart();
  },
  (kind, clientX, clientY) => {
    sfx.unlock();
    const rect = canvas.getBoundingClientRect();
    input.queueAim(kind, clientX - rect.left, clientY - rect.top);
  },
);

let mode: Mode = 'title';
let world: World = createWorld(newSeed(), tuning, 'game', { difficulty: settings.difficulty });
let accumulator = 0;
let lastFrame = performance.now();
let fpsSamples = 0;
let fpsTotal = 0;
let fpsDisplay = 0;
let showDebug = new URLSearchParams(location.search).has('debug');
let wakeLock: { release(): Promise<void> } | null = null;

function newSeed(): number {
  return (crypto.getRandomValues(new Uint32Array(1))[0] ^ Date.now()) >>> 0;
}

function setMode(next: Mode): void {
  mode = next;
  screens.title.hidden = next !== 'title';
  screens.paused.hidden = next !== 'paused';
  screens.earup.hidden = next !== 'earup';
  screens.deal.hidden = next !== 'deal';
  screens.over.hidden = next !== 'over';
  hud.hidden = next === 'title' || next === 'earup' || next === 'deal';
  input.enabled = next === 'playing';
  if (next !== 'playing') input.reset();
  if (next === 'playing') void requestWakeLock();
  else void releaseWakeLock();
}

let loadout: Loadout = 'game';

function startRun(): void {
  sfx.unlock();
  sfx.startMusic();
  $('settings').hidden = true;
  world = createWorld(newSeed(), tuning, loadout, { difficulty: settings.difficulty });
  accumulator = 0;
  fpsSamples = 0;
  fpsTotal = 0;
  renderer.snapCamera(world);
  setMode('playing');
}

function togglePause(): void {
  if (mode === 'playing') setMode('paused');
  else if (mode === 'paused' && !tuningPanel.isOpen) setMode('playing');
}

async function requestWakeLock(): Promise<void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    if (nav.wakeLock && !wakeLock) wakeLock = await nav.wakeLock.request('screen');
  } catch {
    wakeLock = null;
  }
}

async function releaseWakeLock(): Promise<void> {
  const lock = wakeLock;
  wakeLock = null;
  try {
    await lock?.release();
  } catch {
    // already released
  }
}

function playEvents(events: SimEvent[]): void {
  for (const e of events) {
    switch (e.type) {
      case 'fire':
        sfx.fire(e.kind);
        break;
      case 'tink':
        sfx.tink();
        break;
      case 'hit':
        if (e.onPlayer) sfx.ouch();
        else sfx.pop(e.weak);
        break;
      case 'explode':
        sfx.explode();
        break;
      case 'poof':
        sfx.poof();
        break;
      case 'pickup':
        sfx.pickup(e.streak);
        break;
      case 'chomp':
        sfx.chomp(e.streak);
        break;
      case 'bump':
        sfx.bump();
        break;
      case 'turnGreen':
        sfx.ding();
        break;
      case 'tierUp':
        sfx.tierUp();
        break;
      case 'heartLock':
        sfx.heartLock();
        break;
      case 'bare':
        sfx.uhOh();
        break;
      case 'saved':
        sfx.saved();
        break;
      case 'poppedOut':
        sfx.stopMusic();
        sfx.poppedOut();
        break;
      case 'perk':
        sfx.perk();
        break;
      case 'block':
        sfx.tink();
        break;
      case 'dash':
        sfx.whoosh();
        break;
      case 'victory':
        sfx.tierUp();
        break;
      case 'combo':
      case 'milestone':
      case 'harvest':
      case 'coat':
      case 'trade':
        sfx.perk();
        break;
    }
  }
}

function renderEarUp(): void {
  const offer = world.earUps[0];
  const sub = document.querySelector('#screen-earup .sub');
  if (sub) sub.textContent = world.earUps.length > 1 ? `Pick one · ${world.earUps.length} size-ups` : 'Pick one';
  const cards = $('earup-cards');
  cards.replaceChildren();
  if (!offer) return;
  offer.choices.forEach((id, index) => {
    const def = perkDef(id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ear-card';
    btn.innerHTML = `<span class="ear-icon">${def.icon}</span><span class="ear-name">${def.name}</span><span class="ear-blurb">${def.blurb}</span>`;
    btn.addEventListener('click', () => {
      sfx.unlock();
      step(world, { ...EMPTY_COMMAND, pickPerk: index });
      renderer.handleEvents(world.events);
      playEvents(world.events);
      if (world.earUps.length > 0) renderEarUp();
      else setMode('playing');
    });
    cards.append(btn);
  });
  const reroll = $<HTMLButtonElement>('earup-reroll');
  reroll.disabled = world.player.rerolls <= 0;
  reroll.textContent = world.player.rerolls > 0 ? 'Re-roll' : 'No re-rolls left';
}

function renderDeal(): void {
  const deal = world.deals[0];
  const title = $('deal-title');
  const cards = $('deal-cards');
  cards.replaceChildren();
  if (!deal) return;
  title.textContent = deal.title;
  deal.choices.forEach((choice, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ear-card';
    btn.innerHTML = `<span class="ear-icon">${choice.icon}</span><span class="ear-name">${choice.name}</span><span class="ear-blurb">${choice.blurb}</span>`;
    btn.addEventListener('click', () => {
      sfx.unlock();
      step(world, { ...EMPTY_COMMAND, pickDeal: index });
      renderer.handleEvents(world.events);
      playEvents(world.events);
      if (world.deals.length > 0) renderDeal();
      else setMode('playing');
    });
    cards.append(btn);
  });
}

function endRun(): void {
  const title = $('over-title');
  const sub = $('over-sub');
  if (world.won) {
    title.textContent = 'Harvest Moon!';
    sub.textContent = 'You chomped King Cob.';
  } else {
    title.textContent = 'All Popped Out!';
    sub.textContent = 'Zzz... your cob is taking a nap.';
  }
  const avgFps = fpsSamples > 0 ? fpsTotal / fpsSamples : 0;
  const run = summarize(world, avgFps);
  appendLog(run);
  const rows: [string, string][] = [
    ['Rolled for', formatTime(run.seconds)],
    ['Biggest cob', `${run.maxKernels} kernel${run.maxKernels === 1 ? '' : 's'}`],
    ['Cobs chomped', String(run.chomps)],
    ['Best chomp streak', String(run.bestStreak)],
    ['Shots fired', String(Object.values(run.shots).reduce((a, n) => a + n, 0))],
    ['Shots scooped back', `${run.firedRecoveredPct}%`],
    ['Tinks', String(run.tinks)],
    ['Seeds', String(world.stats.seeds)],
  ];
  $('results').innerHTML = rows.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  renderLog();
  setMode('over');
}

function renderLog(): void {
  $('playtest-log').textContent = formatLog(loadLog());
}

const chipMoon = $('moon');

function applySettings(): void {
  input.followFinger = settings.followFinger;
  input.leftHanded = settings.leftHanded;
  powerButtons.smart = settings.smartFire;
  powerButtons.dragAim = settings.dragAim;
  powerButtons.leftHanded = settings.leftHanded;
  renderer.reduceShake = settings.reduceShake;
  renderer.reduceFlash = settings.reduceFlashing;
}

function updateHud(): void {
  const p = world.player;
  const n = total(p.kernels);
  tierFill.style.width = `${Math.min(100, (n / p.sockets) * 100)}%`;
  tierLabel.textContent = `${tierName(p.tier)} · ${n}/${p.sockets}${p.tier >= tuning.maxTier ? ' MAX' : ''}`;
  chipTime.textContent = formatTime(world.tick * DT);
  chipChomps.textContent = `😋 ${world.stats.chomps}`;
  chipSeeds.hidden = world.stats.seeds === 0;
  chipSeeds.textContent = `🌱 ${world.stats.seeds}`;
  if (world.harvestSeconds <= 0) chipMoon.hidden = true;
  else {
    chipMoon.hidden = false;
    const left = Math.max(0, world.harvestSeconds - world.tick * DT);
    chipMoon.textContent = world.won ? '👑 Chomped!' : world.kingSpawned ? '🌙 Harvest Moon' : `🌙 ${formatTime(left)}`;
  }
  powerButtons.update(world);
  debugInfo.hidden = !showDebug;
  if (showDebug) {
    debugInfo.textContent =
      `fps ${fpsDisplay.toFixed(0)}  seed ${world.seed}\n` +
      `enemies ${world.enemies.length}  shots ${world.shots.length}  ground ${world.ground.length}\n` +
      `power ${world.director.smoothedPower.toFixed(1)}  budget ${world.director.budget.toFixed(2)}`;
  }
}

function frame(now: number): void {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (dt > 0.002) {
    fpsDisplay = fpsDisplay * 0.95 + (1 / dt) * 0.05;
    if (mode === 'playing') {
      fpsSamples++;
      fpsTotal += 1 / dt;
    }
  }

  applySettings();

  if (mode === 'playing' && world.earUps.length > 0) {
    renderEarUp();
    setMode('earup');
  } else if (mode === 'playing' && world.deals.length > 0) {
    renderDeal();
    setMode('deal');
  }

  if (mode === 'playing') {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= DT && steps < 6) {
      step(world, input.sample(renderer.cam));
      renderer.handleEvents(world.events);
      playEvents(world.events);
      accumulator -= DT;
      steps++;
      if (world.over || world.earUps.length > 0 || world.deals.length > 0) break;
    }
    if (steps === 6) accumulator = 0;
    if (world.over) endRun();
    else if (world.earUps.length > 0) {
      renderEarUp();
      setMode('earup');
    } else if (world.deals.length > 0) {
      renderDeal();
      setMode('deal');
    }
  }

  const alpha = mode === 'playing' ? Math.min(1, accumulator / DT) : 1;
  renderer.draw(world, alpha, input, mode === 'playing' ? dt : 0, now / 1000);
  if (mode !== 'title') updateHud();
  requestAnimationFrame(frame);
}

// Wiring ------------------------------------------------------------------

function resize(): void {
  renderer.resize();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();
renderer.snapCamera(world);
// Let the title screen show a living field behind it.
for (let i = 0; i < 30; i++) step(world, EMPTY_COMMAND);

$('play-btn').addEventListener('click', () => {
  loadout = 'game';
  startRun();
});
$('playtest-btn').addEventListener('click', () => {
  loadout = 'playtest';
  startRun();
});
$('again-btn').addEventListener('click', startRun);
$('restart-btn').addEventListener('click', startRun);
$('resume-btn').addEventListener('click', () => {
  if (world.earUps.length > 0) setMode('earup');
  else if (world.deals.length > 0) {
    renderDeal();
    setMode('deal');
  } else setMode('playing');
});
$('earup-reroll').addEventListener('click', () => {
  if (world.player.rerolls <= 0) return;
  sfx.unlock();
  step(world, { ...EMPTY_COMMAND, reroll: true });
  renderer.handleEvents(world.events);
  playEvents(world.events);
  renderEarUp();
});
$('pause-btn').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  togglePause();
});
$('sound-btn').addEventListener('click', () => {
  sfx.muted = !sfx.muted;
  $('sound-btn').textContent = `Sound: ${sfx.muted ? 'off' : 'on'}`;
});
for (const id of ['title-tuning-btn', 'pause-tuning-btn', 'over-tuning-btn']) {
  $(id).addEventListener('click', () => {
    renderLog();
    tuningPanel.open();
  });
}
$('tuning-close').addEventListener('click', () => tuningPanel.close());

const settingsPanel = $('settings');
const diffButtons = [...settingsPanel.querySelectorAll<HTMLButtonElement>('[data-diff]')];
const setSmart = $<HTMLInputElement>('set-smart');
const setFollow = $<HTMLInputElement>('set-follow');
const setDrag = $<HTMLInputElement>('set-drag');
const setLeft = $<HTMLInputElement>('set-left');
const setFlash = $<HTMLInputElement>('set-flash');
const setShake = $<HTMLInputElement>('set-shake');

function syncSettingsPanel(): void {
  for (const btn of diffButtons) btn.classList.toggle('on', btn.dataset.diff === settings.difficulty);
  setSmart.checked = settings.smartFire;
  setFollow.checked = settings.followFinger;
  setDrag.checked = settings.dragAim;
  setLeft.checked = settings.leftHanded;
  setFlash.checked = settings.reduceFlashing;
  setShake.checked = settings.reduceShake;
}

function commitSettings(): void {
  saveSettings(settings);
  syncSettingsPanel();
  applySettings();
}

function openSettings(): void {
  syncSettingsPanel();
  settingsPanel.hidden = false;
}

for (const btn of diffButtons) {
  btn.addEventListener('click', () => {
    const next = btn.dataset.diff;
    if (next !== 'easy' && next !== 'normal' && next !== 'spicy') return;
    settings.difficulty = next satisfies Difficulty;
    if (next === 'easy') settings.smartFire = true;
    commitSettings();
  });
}
setSmart.addEventListener('change', () => {
  settings.smartFire = setSmart.checked;
  commitSettings();
});
setFollow.addEventListener('change', () => {
  settings.followFinger = setFollow.checked;
  commitSettings();
});
setDrag.addEventListener('change', () => {
  settings.dragAim = setDrag.checked;
  commitSettings();
});
setLeft.addEventListener('change', () => {
  settings.leftHanded = setLeft.checked;
  commitSettings();
});
setFlash.addEventListener('change', () => {
  settings.reduceFlashing = setFlash.checked;
  commitSettings();
});
setShake.addEventListener('change', () => {
  settings.reduceShake = setShake.checked;
  commitSettings();
});
$('settings-close').addEventListener('click', () => {
  settingsPanel.hidden = true;
});
for (const id of ['title-settings-btn', 'pause-settings-btn']) {
  $(id).addEventListener('click', openSettings);
}
const debugToggle = $<HTMLInputElement>('debug-toggle');
debugToggle.checked = showDebug;
debugToggle.addEventListener('change', () => (showDebug = debugToggle.checked));
$('log-copy').addEventListener('click', () => void navigator.clipboard?.writeText(JSON.stringify(loadLog(), null, 2)));
$('log-clear').addEventListener('click', () => {
  clearLog();
  renderLog();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'playing') setMode('paused');
  if (!document.hidden && wakeLock === null && mode === 'playing') void requestWakeLock();
});
window.addEventListener('keydown', (e) => {
  if (showDebug && mode === 'playing' && e.code === 'KeyG') debugGrow(world, 100);
});
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

const standalone =
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
$('install-hint').hidden = !(isIos && !standalone);

// Updates download in the background and only apply from the title screen, never mid-run.
const updateSW = registerSW({
  onNeedRefresh() {
    const btn = $('update-btn');
    btn.hidden = false;
    btn.onclick = () => void updateSW(true);
  },
});

setMode('title');
requestAnimationFrame(frame);
