# Corn Utopia — Game Design Document

> Working title: **Corn Utopia**. Alternatives: *Pop Cob*, *Cob Mob*, *Kernel Krunch*, *A-Maize-ing*.
>
> Status: brainstorm draft. Anything marked **[Decision]** is a recommendation to confirm; anything in
> [Open Questions](#15-open-questions) still needs an answer.

---

## 1. Elevator Pitch

You are a happy little corn cob rolling around a huge, never-ending world of farms, picnics, and
kitchens. Every kernel on your cob is **both your health and your ammo**. Your cob automatically
**fires its own kernels** at nearby enemy cobs, and every kernel you fire lands on the ground for
you to scoop back up. When you hit an enemy cob, its kernels pop off and scatter too. Roll over
kernels and they *boop* onto your cob, so you get bigger and stronger and pick up whatever power
that kernel has. Run into a cob with fewer kernels than you and you can **chomp** it whole. Get
hit and your kernels fall off, but they stay on the ground until someone picks them up. Get hit
when you're down to your very last kernel and you're **All Popped Out!**

**Kernel rule:** kernels on the ground never fade away on a timer. They just move around between
cobs, crows, and the ground until somebody scoops them up.

**Genre:** Bullet heaven / "survivors-like" (auto-attack, move-only, a growing horde) mixed with
agar.io-style "eat smaller things, run from bigger things" growth.

**Audience:** Elementary age (about 6–11), plus parents and siblings playing along.

**Platform:** Web game, installable as a PWA. iPad is the main target and controls are touch-first.
It also has to be playable on iPhone. Desktop and keyboard work as a bonus.

**Session length:** 8–12 minute runs, with an Endless mode for longer play.

---

## 2. Design Pillars

1. **Your body is your build.** You can always see your power by looking at your cob. More kernels
   means bigger, stronger, and more colorful. Nothing important is hidden in menus.
2. **Fire, dodge, scoop.** Shooting spends your body. Dodging and scooping your kernels back up is
   the core skill. The best feeling in the game is a cob bursting into a shower of kernels that you
   then vacuum up. Spend most of the polish budget on that moment.
3. **Easy to learn, hard to stop.** One thumb to move. Shooting is automatic. Kids can play with no
   reading at all.
4. **Silly, never scary.** Nobody gets hurt. Cobs get dizzy, go *boing*, and poof into husks.
   Faces, googly eyes, and kazoo sounds.
5. **Forgiving, not punishing.** Losing kernels hurts, but you can always grab them back. Comebacks
   should happen often.

---

## 3. Core Loop

```
 Move ─▶ Fire your kernels ─▶ They land + enemy kernels pop off ─▶ Scoop them all up ─▶ Grow + gain powers
   ▲                                                                                        │
   └──────────────────── Enemies scale to your power ◀── Explore further ◀─────────────────┘
```

**Moment to moment (seconds):** steer, dodge, scoop up your fired kernels and the enemy's kernels,
chomp cobs with fewer kernels, avoid bigger ones.

**Run (minutes):** grow through size tiers, build kernel combos, beat mini-bosses, survive to the
Harvest Moon boss or push your Endless high score.

**Meta (days/weeks):** earn Seeds, unlock new starting kernels, hats and skins, new biomes, and
fill in the Kernelpedia collection book.

---

## 4. The Player Cob

### 4.1 Kernels = Health + Ammo

**Firing spends your own kernels.** Your cob auto-fires kernels off its body at nearby enemies.
Each fired kernel flies out, does its type's effect (fireball, freeze, ricochet...), then **drops
onto the ground** where it hit or where it ran out of range. Roll over it and it pops back onto
your cob.

That makes the core loop **fire → dodge → scoop**. Every shot moves a piece of your health out
into the world, so you're always deciding whether to push forward and collect, or hang back and dodge.

**The Heart Kernel (minimum of 1):**
- Your cob can **never fire its last kernel**. When you're down to 1, auto-fire stops.
- That last kernel is your **Heart Kernel**. It glows and has a little worried face, so kids can see
  "I'm out of ammo, go grab kernels!"
- Shooting alone can never make you lose. Only getting hit while you're down to your Heart Kernel
  can (§4.3).

**Fire order:**
- The cob fires kernel types **in rotation**, so every power you've collected gets used and seen.
  Each type has its own fire rate (Sunny is fast, Popper and Sprout are slow).
- **Armor** kernels are never fired. They only protect you (§5.1).
- **[Decision] Low-kernel slow-down:** when your cob is under about 25% full, the fire rate eases
  down so you don't empty yourself by accident. This is a tuning knob to test with kids.

**Your fired kernels on the ground:**
- They have a soft **sparkle ring in your color** for a few seconds so you can see which kernels you
  just shot, then they look like any other ground kernel.
- They're pulled toward you by your **pickup magnet**, so the Big Magnet perk and Goldie kernels
  become very valuable.

**Pop Blast (special button):** fire **half your kernels at once** in a big ring burst (it still keeps
your Heart Kernel). Huge damage and a huge pile of kernels to scoop back up. It's a risky
"panic button" that rewards good play. It recharges over about 20 seconds.

### 4.2 Taking Damage

- Each hit knocks **1 kernel** off (big attacks knock off more). The kernel bounces out onto the ground.
- **Which kernel?** Picked at random, but weighted heavily toward plain **Yellow** filler kernels,
  so rare kernels feel safe-ish. Rare kernels can still pop off on big hits, which makes them
  exciting to chase back.
- **Knocked-off kernels never disappear.** They stay on the ground until someone picks them up:
  you, an enemy cob, or a crow (§6.1). Getting hit is a setback you can always undo by scooping.
- **Mercy invulnerability:** about 0.75 s after each hit, with the cob flashing and wobbling.

### 4.3 All Popped Out (Losing)

- If you get hit while you only have your **Heart Kernel**, it pops off and you become a
  **Bare Cob**: a pale, wobbly cob with a surprised face.
- **Last Chance (3 s):** if you grab any kernel during this time, you're back in it. There are
  usually kernels lying nearby, so this makes for great comeback moments.
- If not: **"All Popped Out!"** The cob gives a big yawn, curls up in its husk like a sleeping bag,
  and takes a nap (with little "Zzz"s). The results screen shows your biggest size, cobs chomped,
  kernels collected, and Seeds earned, with a big **"Wake Up & Play Again!"** button.
- Language is always gentle: the cob is tired or sleepy, never hurt or beaten.

### 4.4 Growth and Size Tiers

Your cob has a set number of **kernel sockets**. When the sockets fill up, the cob grows to the next tier.

Because firing constantly moves kernels off your cob and back on, size works like this:

- **[Decision] Size tiers only go up during a run, never down.** If firing or hits empty your
  sockets, you see **empty sockets** (little "hungry" holes) instead of shrinking. Empty sockets
  are your "missing health" and show you how much there is to scoop back up.
- This keeps the camera zoom and your hitbox steady, so the screen doesn't jump around while you fire.

| Tier | Name        | Sockets | Visual                      | Unlock moment             |
|------|-------------|------:|-------------------------------|---------------------------|
| 1    | Baby Cob    |    12 | Tiny, chubby, big eyes        | Start                     |
| 2    | Snack Cob   |    24 | Longer, little leaf hair      | First Ear Up! choice      |
| 3    | Picnic Cob  |    40 | Husk "cape" appears           | Ear Up! choice            |
| 4    | Big Cob     |    60 | Thicker, eyebrows             | Ear Up! choice            |
| 5    | Mega Cob    |    90 | Sparkles, tassel crown        | Ear Up! choice + mini-boss|
| 6    | Cob-zilla   |   130 | Huge, ground shakes on move   | Ear Up! choice            |
| 7+   | Golden Ear  |  +40/tier | Gold trim, keeps scaling  | Prestige tiers            |

- **Camera zooms out as you grow** (like agar.io), so your cob takes up about the same amount of
  screen and the world feels like it's shrinking around you. This is very important for readability
  on iPhone.
- **Trade-offs of size:** a bigger hitbox, slightly slower turning, and a much bigger pickup magnet
  plus more sockets, which means more ammo and more health.

### 4.5 Ear Up! (Level-Up Choice)

Bullet heavens need that "pick 1 of 3" dopamine moment. Kernels are already the main upgrade system,
so Ear Up! choices are **passive cob perks**, picked from big picture cards (icon first, 1–3 words):

- **Big Magnet:** pickup radius +30%
- **Zoomies:** move speed +10%
- **Popper:** all kernels fire 10% faster
- **Long Shot:** fired kernels fly 20% further
- **Boomerang:** 1 in 5 fired kernels flies back to your cob by itself
- **Thick Husk:** every 5th hit is blocked
- **Sticky Cob:** kernels you pick up come back 2 at a time sometimes
- **Butter Roll:** a short dash on double-tap (gives you a dash for the run)
- **Lucky Ear:** rare kernels show up more often

Ear Up! pauses the game (important for kids). Tap a card to choose. You can **re-roll** once per run.

### 4.6 Chomping (Eating)

- Touch an enemy cob that has **fewer kernels than you have on your cob right now** to **CHOMP** it.
  You get all of its kernels at once, plus a big crunchy sound and screen bounce.
- Touch an enemy with **the same number of kernels or more** and you both bounce apart, and you
  lose a few kernels onto the ground. Enemies never chomp the player.
- The comparison uses **kernel count, not size**. That creates strategy:
  - Shooting thins out big enemies until they're chompable, which gives "shoot, then eat" a natural rhythm.
  - Firing a lot (or a Pop Blast) lowers *your* count, so a cob you could chomp a second ago might
    not be chompable anymore. Scoop up your kernels first, then go for the chomp.
- **Readability:** cobs you can chomp get a **green wiggle outline and a "yum" mouth**. Dangerous
  cobs get a **red outline and angry eyebrows**. The outlines update live as counts change. Never
  make players compare kernel counts by eye.

---

## 5. Kernels

Kernels are the heart of the game. Every kernel type needs:

- A **unique color AND a unique shape or pattern/icon** (for colorblind players and readability)
- A **tiny face** with its own expression
- A distinct **firing sound** and **pickup sound**
- A behavior that kids can recognize just by watching it

### 5.1 Kernel Roster (Launch Set: 12)

Every kernel below is fired as a projectile and then lands on the ground to be picked up again.

| Kernel             | Look                       | When fired                                                 | Rarity     |
|--------------------|----------------------------|------------------------------------------------------------|------------|
| **Sunny** (Yellow) | Classic yellow, smile      | Fast basic shot at the nearest enemy                       | Common     |
| **Sweetie** (White)| Pearly, heart pattern      | Weak shot. While on your cob, slowly grows a brand-new Sunny kernel | Common |
| **Spicy** (Red)    | Red, flame tuft            | Fireball that leaves a short burning patch                 | Uncommon   |
| **Frosty** (Blue)  | Icy blue, snowflake        | Slows enemies; a few hits freeze them                      | Uncommon   |
| **Boing** (Purple) | Purple, spring stripes     | Ricochets between enemies, then lands near the last one    | Uncommon   |
| **Popper**         | Puffy popcorn              | Lobbed shot that pops into a small explosion               | Uncommon   |
| **Sprout** (Green) | Green, little leaf         | Lands and grows into a tiny stalk turret for about 6 s, then turns back into a kernel | Rare |
| **Caramel**        | Glossy brown, drip         | Sticky glob makes a slow zone on the ground                | Rare       |
| **Armor** (Black)  | Dark with a shine/shield   | Never fired. Takes 3 hits before it pops off               | Rare       |
| **Zappy** (Candy Corn)| Tri-color triangle      | Chain lightning between nearby enemies                     | Rare       |
| **Goldie** (Gold)  | Gold, sparkles             | Weak shot. While on your cob, boosts magnet range + Seeds earned | Epic  |
| **Gem** (Glass Gem)| Rainbow glass              | Uses a random other kernel's attack each time              | Legendary  |

### 5.2 Stacking and Milestones

- The power of each type grows with **how many you have** (count-based, so position on the cob
  doesn't matter, which keeps things simple for kids).
- **Fired kernels still count for about 5 seconds** after they leave your cob, so milestones and
  combos don't flicker on and off every time you shoot. A milestone only switches off if you stay
  below it for longer than that.
- **Milestones at 5 / 10 / 20 of a type** give a visible upgrade:
  - 5 Spicy: fireballs get bigger
  - 10 Spicy: fireballs split into 3
  - 20 Spicy: **Flamethrower Mode** (rows of red kernels glow and breathe fire)
- A milestone triggers a **little celebration** (the kernels on that row dance and a badge pops up).

### 5.3 Combos (Kernel Evolutions)

Holding enough of two types unlocks a combo, which is the equivalent of evolutions in other survivors games:

| Combo            | Requires              | Effect                                              |
|------------------|-----------------------|-----------------------------------------------------|
| **Steam Cloud**  | 5 Spicy + 5 Frosty    | Clouds of steam that hurt and push enemies back     |
| **Pinball**      | 5 Boing + 5 Popper    | Bouncing shots explode on every bounce              |
| **Corn Maze**    | 5 Sprout + 5 Caramel  | Grows a ring of stalk walls around you briefly      |
| **Kettle Corn**  | 5 Sweetie + 5 Popper  | Explosions drop healing Sunny kernels               |
| **Disco Cob**    | 3 Gem + 3 Zappy       | Rainbow lasers spin around your cob                 |
| **Golden Shield**| 5 Goldie + 5 Armor    | Armor kernels reflect shots                         |

Combos show up in the Kernelpedia as **silhouettes** until you find them, which drives curiosity and replay.

### 5.4 How Kernels Look on the Cob

- Kernels sit in **rows** around the cob. The game shows the front face and adds a gentle "rotation"
  wobble so you can see the variety.
- **[Decision] The game arranges kernels automatically**, grouping same types into rows. No inventory
  management. A row lighting up is how you see a milestone.
- **Later idea (not for launch):** an optional "Cob Garden" screen between runs where older kids can
  arrange kernels for small adjacency bonuses.

### 5.5 Kernel Cap and Overflow

When you're at the top tier and every socket is full:

- A new kernel **replaces the weakest kernel** (usually a Sunny), so you're always upgrading.
  The swapped-out kernel turns into **Seeds** (meta currency) instead of dropping, so pickups never
  feel wasted and full cobs don't spray clutter onto the ground.

---

## 6. Enemies

### 6.1 Enemy Rules

- **Most enemies are cobs made of kernels**, and **they drop what they're made of**. A red-tinted cob
  drops Spicy kernels. Kids learn to hunt the colors they want, which gives your choices meaning in a
  genre where you're mostly just steering.
- Enemy cobs **pick up kernels on the ground** too, including ones you fired or dropped, and grow if
  they do. That creates "race them to the loot" moments and gives you a reason to scoop quickly. The
  kernels aren't lost: pop that enemy and you get them back.
- **Enemies follow the same rules you do.** Shooter cobs fire their own kernels, which land on the
  ground as free pickups for you. A Shooter cob that fires too much gets small enough to chomp.
- Every enemy needs a clear **silhouette + color + movement pattern** so it reads instantly.

### 6.2 Enemy Roster (Launch)

| Enemy              | Behavior                                                       | Drops                 |
|--------------------|----------------------------------------------------------------|-----------------------|
| **Nibblers**       | Tiny loose kernels with legs, swarm in packs, easy to chomp    | 1 kernel each         |
| **Baby Cobs**      | Wander toward you slowly, basic fodder                         | 3–6 Sunny             |
| **Zoomer Cobs**    | Fast, run straight lines, bonk and bounce off                  | Boing / Sunny         |
| **Shooter Cobs**   | Keep their distance, fire slow, clearly visible kernel shots that land as pickups | Their kernel type |
| **Husky**          | Wears a husk shield; shoot the husk off first                  | Armor + lots of Sunny |
| **Popcorn Bomber** | Waddles up, swells up, pops (with a clear 1 s warning)         | Popper                |
| **Crows**          | Not corn! Fly in and **steal kernels from the ground**, carry them off; shoot them to make them drop the loot | Whatever they stole |
| **Corn Cousins**   | Rival cobs with mixed kernels that hunt *you*, agar.io style   | Mixed, often rare     |
| **Kernel Swarm**   | A huge wave event, 100+ Nibblers at once (big power fantasy)   | Tons of kernels       |

### 6.3 Mini-Bosses and Bosses

All silly, nothing scary:

- **Scarecrow Steve** (mini-boss): flaps his arms to make a wind gust that pushes you; calls crows.
- **The Butter Knight** (mini-boss): a stick of butter in armor; leaves slippery butter trails.
- **King Cob** (boss): a giant crowned cob with every kernel type that fires patterns in phases.
  Drops a guaranteed Legendary.
- **Harvey the Harvester** (Harvest Moon boss): a goofy cartoon combine with a big smile; spinning
  reel pulls you in. You beat him by shooting his "corn hoppers" so he spits out mountains of kernels.
  *Keep him toy-like: rounded, pastel, with googly eyes. Nothing sharp or grinding on screen.*

### 6.4 Enemy Projectiles

- Enemy shots are **slow, big, and round with dark outlines**. Player shots are **smaller, softer, and
  partly see-through**. Players must never lose track of what can hit them.
- Cap on-screen enemy projectiles so the screen stays readable (see §11.4).

---

## 7. Scaling and Difficulty

### 7.1 Power Score

Enemies scale to your **current power**, so the game always feels like a fair fight.

```
power = Σ (kernel.weight)  +  perkCount × 2  +  comboCount × 10
```

Example weights: Sunny 1, Sweetie 1.5, Uncommon 3, Rare 5, Epic 8, Legendary 12.

The sum counts the kernels on your cob **plus the ones you fired in the last ~5 seconds**, so firing
doesn't make your power score jump around.

### 7.2 Spawn Director

A "director" spends a **spawn budget** each second:

```
budget/sec  = base + a × smoothedPower + b × minutesElapsed + c × distanceFromStart
```

- **smoothedPower** follows your actual power **slowly** (~10 s lag). When you lose a lot of kernels,
  enemies ease off, which gives you a gentle built-in comeback. When you grow, the challenge ramps up a beat later
  so you get to feel strong first.
- Each enemy type has a cost and a minimum power tier. The director mixes **fodder (lots of cheap
  enemies)** with **threats (fewer expensive ones)**.
- **Power bands:** at least 70% of spawns should be chompable or easy so the screen stays full of
  "yum" targets. That's the bullet heaven fantasy.
- **Pacing waves:** about 45 s calm → 20 s rush → calm, with a scripted event every 2–3 minutes
  (Kernel Swarm, Crow Raid, mini-boss).

### 7.3 Difficulty Settings

| Setting        | Who it's for                    | Changes                                                       |
|----------------|---------------------------------|---------------------------------------------------------------|
| **Easy Peasy** | Youngest kids (5–7)             | Slower enemies, much bigger pickup magnet, enemies don't grab your fired kernels, Last Chance 6 s, no Crows |
| **Just Right** | Default                         | As designed                                                    |
| **Spicy**      | Older kids / parents            | Faster director ramp, more threats, enemies grab ground kernels faster, smaller magnet |

---

## 8. The World

### 8.1 Infinite Map

- **Chunk-based procedural generation**, seeded per run (so you can share a "seed code" with a friend).
- Chunks are about 1 screen wide at the starting zoom. Load nearby chunks and unload far ones.
- **Distance from the start** sets the biome and nudges difficulty up, so exploring is a choice
  ("go further = more danger, better loot").

### 8.2 Biomes

Biomes sit in rings or regions moving outward from the start:

| Biome              | Vibe                          | Unique feature                                      |
|--------------------|-------------------------------|-----------------------------------------------------|
| **Sunny Farm**     | Starting field, tractors, hay | Hay bales block shots; mud puddles slow you down    |
| **Picnic Park**    | Checkered blankets, ants      | Ants carry kernels away (like Crows)                |
| **Kitchen Counter**| Giant cutting board, pots     | Butter puddles = speed boost; salt shaker shrine    |
| **Movie Theater**  | Dark carpet, popcorn buckets  | Popcorn rain event; lots of Popper kernels          |
| **County Fair**    | Rides, balloons, lights       | Bumper cars bounce everything; prize booths         |
| **Taco Night**     | Tortillas, salsa rivers       | Spicy-heavy biome; salsa river slows                |

### 8.3 Points of Interest

These give players places to steer toward on an infinite map:

- **Kernel Piñatas:** shoot them open for a burst of kernels
- **Sprinklers:** stand under one to slowly regrow kernels
- **Shrines (Salt Shaker, Butter Dish):** pick 1 of 2 trades (e.g. "lose 10 Sunny, gain 1 Epic")
- **Rescue Kernels:** a trapped kernel family in a cage. Free them and they join you.
- **Golden Corn Stalk:** a rare landmark that gives a Legendary

### 8.4 Navigation

- **Edge arrows / compass** point to the nearest point of interest and active events.
- **No full minimap on iPhone** (too small). An optional small one on iPad.

---

## 9. Run Structure and Modes

### 9.1 Harvest Run (Main Mode)

- **10 minutes.** At 10:00 the **Harvest Moon** rises and the boss arrives.
- Beat the boss to **win the run** (fireworks, popcorn rain, big Seed reward). After that you can
  keep going in **Overtime** for bonus Seeds.
- Clear structure for kids: "survive until the moon comes."

### 9.2 Endless

- No boss timer. The director keeps ramping. Go for a high score: biggest cob, time survived.

### 9.3 Later Modes (Post-Launch Ideas)

- **Daily Seed:** everyone gets the same map and the same starting kernel.
- **Couch Co-op (2 cobs, one iPad):** split controls, two thumbs each side. Hard to build, but very
  fun for siblings. **Design for it now** (don't assume a single player in the code) even if it ships later.

---

## 10. Meta Progression

### 10.1 Seeds (Currency)

Earned from every run based on time, size, chomps, and Goldie kernels. **No real-money purchases.**

### 10.2 The Farm (Hub Screen)

- A cozy farm where you spend Seeds:
  - **Seed Bank:** unlock new **starting kernels** (start a run with 3 Spicy instead of 3 Sunny)
  - **Cob Closet:** hats, glasses, mustaches, husk colors (cosmetic only)
  - **Field Upgrades:** small permanent boosts (+5% magnet, +1 starting kernel, +1 re-roll), with a cap
- **Unlock biomes** by reaching them for the first time.

### 10.3 Kernelpedia

- A collection book of every kernel, combo, enemy, and boss. Locked ones are shown as silhouettes.
- Each entry has a silly one-line joke ("Frosty kernels are the coolest kernels. Literally.").
- Optional **read-aloud** button for pre-readers.

### 10.4 Achievements / Stickers

- Stickers instead of "achievements": a sticker book with tasks like "Chomp 100 cobs," "Find a Gem kernel,"
  "Beat King Cob on Spicy."

---

## 11. Controls and UX (Touch-First)

### 11.1 Core Controls

| Input           | Action                                                              |
|-----------------|---------------------------------------------------------------------|
| **Drag anywhere** | **Floating joystick** shows up where your thumb lands; drag to steer |
| **Lift finger** | Cob slowly coasts to a stop (doesn't stop instantly; feels smoother) |
| **Pop button**  | Pop Blast special (bottom-right corner, big)                        |
| **Double-tap**  | Butter Roll dash (only if you picked that perk)                     |
| **Pause**       | Top corner, inside the safe area                                    |

- **Shooting is always automatic**, aimed at the nearest or best target. No aiming needed.
- **[Decision] Alternate control: "Follow My Finger."** The cob rolls toward where you're touching.
  It's easier for very young kids and works well on iPad. Players can switch in Settings.
- Keyboard (WASD/arrows + Space) and gamepad (Gamepad API) work on desktop and on iPads with a
  controller.

### 11.2 Layout

- **iPad (landscape and portrait):** joystick on the left half, Pop on the right. HUD along the top.
- **iPhone landscape (recommended):** same layout, smaller HUD, camera zoomed out a bit more.
- **iPhone portrait:** supported. Joystick in the bottom half, Pop in the bottom-right, HUD on top.
  Zoom out further, since the view is narrow.
- iOS doesn't honor the manifest's `orientation` lock reliably, so **every screen must work in both
  orientations** and re-layout live when the device rotates.

### 11.3 Touch Rules

- Tap targets **at least 44×44 pt** (bigger for kids: aim for 60+ pt on menu buttons).
- Keep controls **away from the bottom edge** (the iOS home-indicator swipe) and the top-left/right
  corners (system gestures). Use `env(safe-area-inset-*)`.
- No hover-only anything. No long-press-only actions. No pinch gestures in gameplay.
- Prevent page zoom, scroll, bounce, text selection, and the long-press callout inside the game.

### 11.4 Readability (Bullet Heaven Clutter)

- **Layer order (bottom → top):** ground → ground kernels → player shots → enemies → enemy shots → player cob → HUD.
- Player effects **fade as more stack up** (auto-dim when there are a lot of particles).
- Settings: **Reduce Flashing** and **Reduce Screen Shake** toggles.
- Ground kernels get a **gentle pulsing glow** so they read even in busy moments.
- **Flying kernels and ground kernels must look different at a glance.** Flying ones get a motion
  trail and no glow. Landed ones squash, bounce once, and start glowing. Kids need to know "that one
  is a shot" vs. "that one is a pickup."
- With every shot turning into a pickup, the ground gets busy. Kernel merging (§14.3) and the
  pickup magnet keep it tidy.

### 11.5 HUD (Minimal, Icon-First)

- **Top:** run timer / moon progress bar, Seeds counter, pause.
- **Size tier bar:** a "cob fill" meter showing progress to the next tier.
- **Heart Kernel warning:** when you're down to your Heart Kernel, the cob's glow pulses and arrows
  point toward the nearest kernels on the ground.
- **Kernel strip:** small icons with counts for each kernel type you have (tap to see what it does
  while paused).
- **No numbers for health** — your cob *is* your health bar.

### 11.6 Onboarding (No Reading Needed)

1. A first-run "playground" with a big hand-drawn **thumb icon** that shows how to drag.
2. A single Baby Cob wanders in. Your cob fires kernels at it, the cob gets popped, and **your fired
   kernels plus its kernels** land on the ground glowing. A hand icon shows you to roll over them.
   Your cob visibly fills back up.
3. A smaller cob with a green "yum" outline: arrow + chomp animation shows you can eat it.
4. A big red cob appears: the hand icon shows you to steer away.
5. Done in under 60 seconds, then straight into the first real run.

---

## 12. Art Direction

### 12.1 Style

- **Chunky, rounded, cartoon shapes** with **thick dark outlines** (they read well on small screens).
- **Big googly eyes and expressive faces** on cobs *and* kernels.
- **Squash and stretch** on everything: cobs squish when they turn, kernels boing when they land.
- **Bright, saturated, friendly palette** with soft shadows. Each biome has its own palette but
  kernel colors stay consistent everywhere.
- Inspiration: *Pikmin*, *Kirby*, *Untitled Goose Game*'s simplicity, *VeggieTales*, and the
  readability of *Vampire Survivors* and *Brotato*.

### 12.2 Tone Rules (Kid-Appropriate)

- **No blood, no gore, no fear.** "Defeated" cobs get dizzy stars, spin, and **poof into a husk** and
  a puff of corn silk.
- Chomping is cartoony: a big "NOM!" text pop, crumbs, a happy cob face. The eaten cob gives a
  surprised "oop!" and disappears in a sparkle. It shouldn't look like it's being hurt.
- Harvester and crow designs stay **toy-like and goofy**.
- Words used: "pop," "boop," "popped out," "nap time," "chomp," "yum" — never "kill," "die,"
  "shucked," or anything that sounds like getting hurt or beaten.

### 12.3 Juice Checklist

- [ ] Kernel fire: the kernel pops off the cob with a little "pthoo!" and leaves an empty socket
- [ ] Kernel lands: squash, one bounce, glow turns on
- [ ] Kernel pop: burst particles + a little "pop!" text
- [ ] Kernel pickup: magnet whoosh → snap onto the cob with a squash + rising pitch sound for each kernel picked up in a row
- [ ] Chomp: screen bounce, crunch, a crumb burst
- [ ] Tier up: cob grows with a "ta-da!" spin, camera zooms out smoothly
- [ ] Hit taken: cob flinches, quick white flash, kernel spins off
- [ ] All Popped Out: big yawn, cob tucks into its husk sleeping bag, "Zzz" bubbles, a sleepy lullaby jingle

### 12.4 Asset Pipeline

- **Vector source art** (SVG / Figma / Affinity) exported to **sprite atlases** at 1× and 2×.
- Kernel types can share one base sprite plus **tint + overlay icon** to save memory and art time.
- Animations: a sprite-sheet for faces/expressions; squash, stretch, and wobble done in code (cheap and juicy).

---

## 13. Audio

- **Music:** bouncy, cheerful — banjo, marimba, kazoo, hand claps, toy piano. Each biome gets a theme.
  The music layers up as action builds up (adaptive stems), and the Harvest Moon boss gets a "big
  silly hoedown" track.
- **SFX:** each kernel type has its own firing sound. Pickup pitch rises with each kernel in a quick
  streak (very satisfying). Chomp = crunch. All Popped Out = yawn + a sleepy music-box jingle.
- **Voice:** optional cute vocal barks ("Yum!", "Whee!", "Uh-oh!"), plus a read-aloud narrator for
  menus and the Kernelpedia.
- **iOS note:** web audio has to be "unlocked" by the first tap. Start audio from the title screen's
  "Play" tap.

---

## 14. Technical Design

### 14.1 Recommended Stack

| Area            | Choice                                         | Why                                                           |
|-----------------|------------------------------------------------|---------------------------------------------------------------|
| Language        | **TypeScript**                                 | Safety for a data-heavy game                                  |
| Build           | **Vite**                                       | Fast dev server, simple PWA plugin                            |
| Rendering       | **PixiJS v8** (WebGL, with WebGPU when available) | Very fast 2D sprite batching for thousands of entities     |
| Game logic      | **Small ECS** (e.g. bitECS) or hand-rolled systems | Cache-friendly, scales to many entities                   |
| Audio           | **Howler.js** or a thin Web Audio wrapper      | Handles the iOS unlock and sound sprites                      |
| UI / menus      | DOM/HTML overlay (Preact or plain) **or** Pixi UI | DOM is easier for accessible menus and safe areas          |
| PWA             | **vite-plugin-pwa** (Workbox)                  | Precaching, offline, update flow                              |
| Storage         | **IndexedDB** (via idb-keyval) + `navigator.storage.persist()` | Saves and settings, no account needed          |
| Testing         | Vitest (logic), Playwright (smoke tests on WebKit) | WebKit testing catches Safari issues early                |

**Alternative:** **Phaser 3** has more built in (scenes, input, audio, physics) and can be faster to
prototype with. Choose Phaser if speed of early prototyping matters more than squeezing out
performance at very high entity counts. Either way, write game rules as plain TypeScript separate
from rendering so you could swap engines later.

### 14.2 Architecture

- **Fixed-timestep simulation** (60 Hz) with interpolated rendering. Same results on 60 Hz iPhones
  and 120 Hz ProMotion iPads.
- **Seeded RNG** for world generation and spawns (so seeds can be shared, and runs replayed for debugging).
- **Spatial hash grid** for collisions (shots vs. cobs, pickups vs. player). No physics engine needed;
  everything is circles.
- **Object pooling** for projectiles, particles, and kernels (no garbage-collection hitches).
- **Data-driven content:** kernels, enemies, combos, biomes, and director curves live in JSON/TS
  config files so they can be balanced without code changes. Add a debug panel to tweak them live.
- **Floating origin:** every so often, shift the world back toward 0,0 so positions don't lose
  precision far from the start on the infinite map.
- **Input layer** turns touch, mouse, keyboard, and gamepad into one "move vector + buttons" object,
  with multiple players in mind for later co-op.

### 14.3 Performance Budget

- **Targets:** 60 fps on **iPad (9th gen)** and **iPhone 12**. 120 fps where available is a bonus.
- **Entity caps (starting point, tune with profiling):** ~300 enemies, ~800 projectiles,
  ~2,000 ground kernels on screen, ~1,000 particles.
- **Ground kernels are the biggest load.** Every shot becomes a ground kernel, and they never time out.
  - **Kernel merging:** when the ground gets crowded, nearby kernels **of the same type** merge into
    one bigger "bundle" kernel worth several (keeps entity counts down and reads well).
  - **Off-screen storage:** kernels in chunks far from the player are saved as compact chunk data
    (type + count + position) instead of live entities, and come back when the chunk loads again.
  - Enemies far away grabbing kernels can be simulated cheaply at the chunk level.
- **Render resolution:** cap device pixel ratio at 2. Add a dynamic quality setting that lowers
  particles and resolution if frame time goes over budget.
- **Memory:** keep texture atlases at 2048×2048 or smaller; iOS Safari kills tabs that use too much memory.
- **Pause** on `visibilitychange` (switching apps), and save progress at the same time.

### 14.4 PWA and iOS Specifics

This is where web games on iPad usually run into trouble, so plan for it from day one:

**Install**
- `manifest.webmanifest` with `name`, `short_name`, `icons` (192, 512, maskable), `display: "standalone"`
  (iOS doesn't support `fullscreen`), `background_color`, `theme_color`, `start_url`, `scope`.
- iOS also needs `<link rel="apple-touch-icon">` (180×180), `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, and `apple-mobile-web-app-title`.
- **iOS has no install prompt.** Show a friendly custom **"Add to Home Screen"** helper (picture of
  the Share button → "Add to Home Screen") when the game runs in Safari and isn't installed.
  Detect "installed" with `navigator.standalone` / `display-mode: standalone`.
- Splash: iOS uses `apple-touch-startup-image` per device size, or fall back to a simple
  background color plus a fast-loading title screen.

**Offline**
- Service worker **precaches all game assets** so it works fully offline (car trips!).
- **Update flow:** download a new version in the background. Show "New corn is ready!" on the title
  screen and switch on the next launch — **never in the middle of a run**.
- Keep the total download small (target **under 25 MB**) so it installs quickly over cellular.

**Viewport and gestures**
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">`
- CSS: `touch-action: none` on the game canvas, `overscroll-behavior: none`, `user-select: none`,
  `-webkit-user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`.
- Use `100dvh` (not `100vh`) and `env(safe-area-inset-*)` padding.
- Use **Pointer Events** and track multiple pointers (joystick + Pop button at the same time).

**Platform limits to design around**
- **No Vibration API on iOS.** Haptics aren't possible on the web there, so put the "feel" into
  visuals and sound instead.
- **No Fullscreen API on iPhone.** Installed PWA mode is how you get a full-screen experience.
- **Screen Wake Lock API** (iOS 16.4+) keeps the screen on during a run; release it on pause.
- **Storage:** iOS can clear website data that hasn't been used in a while. Installed PWAs are
  treated better, but request `navigator.storage.persist()` and consider a "save code" export for backups.
- **Audio:** test with the iPhone's silent switch on and off — behavior differs between Web Audio and
  HTML audio. Resume the audio context after interruptions (phone calls, switching apps).

### 14.5 Privacy and Kid Safety

- **No accounts, no ads, no in-app purchases, no chat, no tracking.** Everything is saved on the device.
- Design to **COPPA**-friendly standards. Analytics, if any, are anonymous and opt-in through a
  parent setting.
- Any outside link (website, credits) sits behind a simple **parent gate** (e.g. "hold for 3 seconds"
  or a simple math question).

---

## 15. Open Questions

These would change the design, so they need answers before or during prototyping:

Decided so far:

- **Firing spends your own kernels**, which land on the ground to be picked up again. Shooting can
  never fire your last (Heart) kernel. (§4.1)
- **Kernels knocked off by hits never disappear**; they stay on the ground until picked up. (§4.2)
- **You can chomp any cob with fewer kernels than you.** (§4.6)
- **Losing is "All Popped Out!"** with a gentle nap animation; no "shucked." (§4.3)
- **Color-coded loot** (enemies drop what they're made of) and **green/red chomp outlines** stay.

Still open:

1. **Hold-fire button?** Auto-fire only, or a toggle to stop shooting so you can hoard kernels? Auto
   only is simpler for young kids. A toggle adds strategy for older kids.
2. **Can enemies pick up kernels you fired?** Recommended yes on normal difficulty (adds a race), no
   on Easy Peasy.
3. **Size tiers only go up during a run** (recommended), or should the cob shrink when it's mostly empty?
4. **Age focus:** closer to 6 or closer to 10? That changes how complex combos and the Ear Up!
   choices should be.
5. **Kernel arrangement:** automatic (recommended) or an optional manual "Cob Garden" for older kids?
6. **Run length:** is 10 minutes right for the target age? (Consider 6-minute "Snack Runs.")
7. **Co-op:** is two players on one iPad a launch goal? It affects input and camera design early.
8. **Narration:** voice-over budget for read-aloud menus?
9. **Monetization:** free? A one-time paid version? (Strongly recommend no ads/IAP for this audience.)
10. **Story wrapper:** is there a reason the cobs are fighting? (e.g. "The Great Harvest is coming and
    only the biggest cob gets to be Corn King of Corn Utopia.")
11. **Name:** keep *Corn Utopia*, or something punnier?

---

## 16. Development Roadmap (Milestones)

Each milestone has a clear "done when" check. Scope grows only after the previous milestone is fun.

### M0 — Gray-Box Prototype (Find the Fun)
- Circles and squares only. Touch joystick, auto-fire that spends kernels, Heart Kernel minimum,
  fired kernels landing as pickups, kernels as health, chomp rule.
- This is where to tune the most important numbers: fire rate, shot range, magnet radius, and how
  far fired kernels land. Those decide whether fire → dodge → scoop feels fun or frustrating.
- 3 kernel types (Sunny, Spicy, Frosty), 2 enemy types, a simple director, an infinite plain field.
- PWA shell installed on a real iPad and iPhone from the very first build.
- **Done when:** a kid plays 3 runs in a row without being asked to.

### M1 — Vertical Slice
- First real art pass on the player cob, Sunny kernels, Baby Cobs, Sunny Farm biome.
- Full juice on pop/scoop/chomp. Size tiers + camera zoom. Ear Up! choices. All Popped Out + Last Chance.
- Audio unlock, music, core SFX. Offline play works.
- **Done when:** a 3-minute run on an iPhone 12 holds 60 fps and *feels* finished.

### M2 — Content Alpha
- All 12 kernels, milestones, 6 combos. Full enemy roster, 2 mini-bosses, King Cob.
- 3 biomes, points of interest, events. Harvest Run 10-minute structure with Harvey.
- Settings: difficulty, controls, reduce flashing/shake.
- **Done when:** a full run is winnable and the director feels balanced across power levels.

### M3 — Meta + Beta
- The Farm hub, Seeds, unlocks, Kernelpedia, stickers, cosmetics.
- Onboarding, Add to Home Screen helper, update flow, save persistence.
- Remaining biomes, Endless mode, accessibility pass, performance tuning on older devices.
- **Done when:** playtesting with kids of the target age shows people coming back for more runs.

### M4 — Launch and Beyond
- Polish, bug-fixing, store-like landing page.
- Post-launch: Daily Seed, couch co-op, new biomes and kernels, seasonal events (Halloween candy corn!).

---

## 17. Playtesting Plan

- **Test with real kids early** (from M0). Watch, don't explain. Note where they get confused, where
  they laugh, and when they put the device down.
- Track locally (debug builds only): run length, what caused each All Popped Out, kernels collected
  per minute, share of fired kernels picked back up, how often Pop Blast is used, Ear Up! picks,
  average fps.
- Key questions:
  - Do kids understand that shooting uses their kernels, and that they should go pick them back up?
  - Does auto-fire feel like it's "wasting" kernels, or does the scoop-up feel rewarding?
  - Can a 6-year-old tell chompable cobs from dangerous ones without help?
  - Do players actually go after specific kernel colors?
  - Does losing kernels feel fair, and do comebacks happen?
  - Is the screen readable during a Kernel Swarm on an iPhone?

---

## 18. Risks and Mitigations

| Risk                                                | Mitigation                                                                 |
|-----------------------------------------------------|----------------------------------------------------------------------------|
| **Death spiral** (fewer kernels → weaker → more hits) | Kernels never disappear, Heart Kernel minimum, low-kernel fire slow-down, smoothed-power director, Last Chance |
| **Auto-fire feels like losing health** for young kids | Clear "your kernels" sparkle, strong magnet, satisfying scoop sounds, Boomerang/Long Shot perks, playtest early |
| **Visual clutter** on small screens (shots + piles of ground kernels) | Camera zoom-out, layer rules, flying vs. landed looks, same-type merging, auto-dim effects, projectile caps |
| **Performance** on older iPhones (many ground kernels) | ECS + pooling, kernel merging, off-screen chunk storage, entity caps, dynamic quality |
| **iOS PWA quirks** (audio, storage, install)        | Test on real devices from M0, Add to Home Screen helper, save export      |
| **Too complex** for young kids                      | Auto-arrange kernels, icon-first UI, Easy Peasy mode, no reading required |
| **Scope creep** (infinite map, many kernels)        | Data-driven content, milestone gates, launch with 12 kernels / 3–6 biomes |
| **Same-y runs**                                     | Kernel combos, biomes, events, points of interest, starting kernel choices |

---

## 19. Glossary

- **Kernel:** a piece on your cob. Health + ammo + ability.
- **Cob:** you, or an enemy made of kernels.
- **Socket:** a spot on your cob that holds one kernel. Empty sockets show missing health.
- **Heart Kernel:** your last kernel, which can never be fired.
- **Chomp:** eating a cob that has fewer kernels than you.
- **Pop Blast:** the special move that fires half your kernels at once.
- **Ear Up!:** the level-up choice when you grow a size tier.
- **All Popped Out:** game over (hit while down to your Heart Kernel, and no kernel grabbed during Last Chance).
- **Bare Cob / Last Chance:** the short grace period after losing your Heart Kernel.
- **Director:** the system that decides what enemies spawn.
- **Seeds:** the meta currency spent at the Farm.
- **Kernelpedia:** the in-game collection book.
