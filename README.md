# corn-utopia

A silly, kid-friendly bullet heaven game where you play as a corn cob collecting kernels.
Web-based and installable as a PWA, built touch-first for iPad and iPhone.

See the [Game Design Document](docs/game-design.md).

**Play it:** https://cornutopia.timtsu.com/ (every PR also gets a preview at
`https://cornutopia.timtsu.com/pr/pr-<N>/`; see [docs/deploy.md](docs/deploy.md)).

## M1 vertical slice

The current build is the **M1 vertical slice** from the roadmap (GDD §16). It keeps the M0 rules
and adds the first art pass, Sunny Farm, Power Pockets, Ear Up perks, and music.

What's new:

- **Cutout cobs.** Player and enemies are hand-drawn-style corn cobs (thick ink, flat color, bob
  and tilt). Kernel faces, Soggy drips, Stony cracks, and power flair (frost, popcorn)
  so a cob's look tells you which power to use. Green cobs look nervous. A resisted hit looks smug.
  Frosty adds an icy crystal and little icicles.
- **Sunny Farm.** Grass, dirt, and flowers are scenery. Hay is stacked in clumps of similar-sized
  bales that block shots. Mud slows you down.
- **Power Pockets.** Three buttons to start, a fourth at size tier 3, a fifth at tier 5 (max 5).
  Zinger, Spicy, Popper, and Frosty each keep one fixed button. With three pockets, the fourth
  power sits dimmed on its own button until you tap it or press its number. Keys 1–4 always match
  those four.
- **Ear Up!** Growing a size tier pauses the run and offers 3 cob perks (one re-roll per run).
  Every perk stacks. Boomerang and Thick Husk each add 20% (another 1 of every 5). Butter Roll makes
  the dash 25% further. Lucky Ear makes rare kernels 25% more common. Extra Pocket never passes 5 buttons.
- **Juice and music.** Shots pop off, landings squash, chomps shake the screen, tier-ups twirl,
  and All Popped Out tucks the cob into its husk. A little synthesized tune starts when you play
  and stops for the nap jingle.

## M0 gray-box prototype

M0 was the "find the fun" prototype: the rules below, originally drawn as circles and squares.

What's in it:

- **Play!** starts the real game as a plain Sunny cob with no powers; the first little cobs each
  carry a power kernel, so chomping them is how you arm up. **Playtest mix** starts with the
  mixed loadout set in the Tuning panel (Zinger, Spicy, Popper, and some Sunny by default).

- Floating touch joystick (left half). **Dash** is the big button under the right thumb, and you have it
  from the start. Power buttons arc around it and fire on touch-down. Two thumbs work at the same time:
  steer with one, dash or shoot with the other. Keyboard: WASD/arrows, `1`–`4` to fire, Space or Shift to
  dash, `Tab` to switch target, `Esc` to pause.
- Auto-target is a dashed circle on the aimed cob (nearest red cob, favoring ones in front of you) and tap-a-cob-to-lock. Green and red outlines follow the cob.
- Chomp rule with green/red outlines, a chomp meter under the target, Chomp Bonus and Chomp Streak.
- Fired kernels fly, land as pickups with a sparkle ring, and get pulled in by your magnet.
  Enemies grab ground kernels too, except kernels you just knocked off a cob: those are yours
  alone for 10 s, so a pack can't instantly re-grab them. Heart Kernel minimum: the last kernel
  can never be fired.
- 3 plain kernels (Sunny, Soggy = fireproof, Stony = bonk-proof / weak to Pop) and 3 power kernels
  (Zinger = Bonk, Spicy = Fire + burn patch, Popper = lobbed Pop blast). Resisted hits go *tink!*.
- 3 enemy types (Baby Cob, Soggy Cob, Rocky Cob), a spawn director with chomp bands and calm/rush
  waves, and an endless field. Chompable cobs get nervous and back away.
- 10 size tiers from 12 up to 1,250 kernels (they only go up), camera zoom-out as you grow, and a
  top tier where extra kernels become Seeds. Shot range, blast radius, speed, magnet, and kernels
  knocked off per hit all scale with your size. Last Chance and the All Popped Out results screen.
- It gets harder as you grow: armored **hunter cobs** (pulsing red ring) chase you, enemies speed up,
  and bumps cost a share of your cob. All of it is in the Tuning panel under *Challenge*.
- **Tuning panel** (Title, Pause, or Results screen → *Tuning*) with live sliders for every number
  M0 is meant to tune: recharge times, damage, range, magnet, Chomp Bonus, director bands, and more.
  Settings are saved on the device and can be copied/pasted between devices.
- **Playtest log**: every run's metrics from GDD §17 (chomps/min, shots per chomp, % of shots
  scooped back, tinks, presses-after-tink before switching powers, fps) are saved locally and
  shown in the Tuning panel. Add `?debug` to the URL for an fps/entity overlay (press `G` during
  a run to add 100 Sunny kernels and check how big cobs look).
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
`BOT_LOADOUT=playtest` uses the Playtest mix, `BOT_MODE=idle` never shoots, `BOT_START_SIZE=500`
starts runs already big, and `BOT_TRACE=1` shows where the kernels came from. The report ends with a
per-tier table (time spent, bumps per minute, % of your cob lost per minute, red cobs nearby). The bot is much better at chasing than a kid, so treat its times as a
lower bound.

### Testing on a real iPad / iPhone

Service workers and install need HTTPS (or `localhost`). Options:

- **GitHub Pages:** `main` deploys to https://cornutopia.timtsu.com/ and each PR gets a
  preview link (one-time Pages setup in [docs/deploy.md](docs/deploy.md)). Open the production
  URL in Safari → Share → Add to Home Screen.
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
- `src/render.ts` PixiJS (WebGL) gray-box renderer, interpolated between sim ticks
- `src/input.ts` multi-touch joystick + taps + keyboard → one command per tick
- `src/audio.ts` synthesized sound effects (no audio files)
- `src/ui/` power buttons and the tuning panel
- `src/main.ts` game loop, screens, HUD, PWA wiring
