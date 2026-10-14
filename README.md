# corn-utopia

A silly, kid-friendly bullet heaven game where you play as a corn cob collecting kernels.
Web-based and installable as a PWA, built touch-first for iPad and iPhone.

See the [Game Design Document](docs/game-design.md).

## M0 gray-box prototype

The current build is the **M0 "find the fun" prototype** from the roadmap (GDD §16): circles and
squares only, built to test whether "wear it down, then chomp" is fun on a touch screen.

What's in it:

- Floating touch joystick (left half), one power button per power (right thumb arc), fires on touch-down.
  Two thumbs work at the same time. Keyboard also works: WASD/arrows, `1` `2` `3` to fire, `Tab` to
  switch target, `Esc` to pause.
- Auto-target ring (nearest red cob, favoring ones in front of you) and tap-a-cob-to-lock.
- Chomp rule with green/red outlines, a chomp meter under the target, Chomp Bonus and Chomp Streak.
- Fired kernels fly, land as pickups with a sparkle ring, and get pulled in by your magnet.
  Enemies grab ground kernels too. Heart Kernel minimum: the last kernel can never be fired.
- 3 plain kernels (Sunny, Soggy = fireproof, Stony = bonk-proof / weak to Pop) and 3 power kernels
  (Zinger = Bonk, Spicy = Fire + burn patch, Popper = lobbed Pop blast). Resisted hits go *tink!*.
- 3 enemy types (Baby Cob, Soggy Cob, Rocky Cob), a spawn director with chomp bands and calm/rush
  waves, and an endless field. Chompable cobs get nervous and back away.
- Size tiers that only go up, camera zoom-out as you grow, a top tier where extra kernels become
  Seeds, Last Chance, and the All Popped Out results screen.
- **Tuning panel** (Title, Pause, or Results screen → *Tuning*) with live sliders for every number
  M0 is meant to tune: recharge times, damage, range, magnet, Chomp Bonus, director bands, and more.
  Settings are saved on the device and can be copied/pasted between devices.
- **Playtest log**: every run's metrics from GDD §17 (chomps/min, shots per chomp, % of shots
  scooped back, tinks, presses-after-tink before switching powers, fps) are saved locally and
  shown in the Tuning panel. Add `?debug` to the URL for an fps/entity overlay.
- PWA shell: manifest, icons, offline service worker, iOS home-screen meta tags, safe areas,
  wake lock, pause on app switch, and a "New corn is ready!" update prompt that never interrupts a run.

## Development

Requires Node 22+.

```bash
npm install
npm run dev        # dev server (also on your LAN, for testing on a phone/iPad)
npm test           # unit tests for the game rules
npm run typecheck
npm run build      # production build + service worker into dist/
npm run preview    # serve the production build
npm run bot        # headless balance report (a bot plays seeded runs)
npm run icons      # regenerate the placeholder PWA icons
```

`npm run bot` accepts overrides, e.g. `BOT_TUNING='{"snackSize":0.4}' BOT_SEEDS=10 npm run bot`.
The bot is much better at chasing than a kid, so treat its times as a lower bound.

### Testing on a real iPad / iPhone

Service workers and install need HTTPS (or `localhost`). Options:

- **GitHub Pages:** enable Pages with *Source: GitHub Actions*, then run the
  *Deploy to GitHub Pages* workflow. Open the URL in Safari → Share → Add to Home Screen.
- **Local network:** `npm run dev` and open the printed LAN URL. The game is playable, but iOS
  won't install it as an app or run it offline without HTTPS.

## Code layout

- `src/sim/` — the game rules as plain, deterministic TypeScript (fixed 60 Hz timestep, seeded RNG,
  changes only through input commands). No DOM or rendering, so it's unit-testable and
  ready for a future engine swap or online play.
  - `kernels.ts` kernel types, damage types, resistances
  - `cob.ts` the shared "cob = kernel counts" model: hits, resistances, chomp rule
  - `tuning.ts` every tunable number with its slider range
  - `world.ts` player, shots, enemies, ground kernels, director, events
- `src/render.ts` Canvas 2D gray-box renderer (interpolated between sim ticks)
- `src/input.ts` multi-touch joystick + taps + keyboard → one command per tick
- `src/audio.ts` synthesized sound effects (no audio files)
- `src/ui/` power buttons and the tuning panel
- `src/main.ts` game loop, screens, HUD, PWA wiring
