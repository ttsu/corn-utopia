# Corn Utopia — Game Design Document

> Game title: **Corn Utopia**. A free game for iPad and iPhone (web/PWA).
>
> Status: design draft, with the core decisions made. Anything marked **[Decision]** is settled unless
> playtesting says otherwise. [Decisions and Open Questions](#15-decisions-and-open-questions) lists
> everything decided so far and what's left to tune.

---

## 1. Elevator Pitch

You are a happy little corn cob rolling around a huge, never-ending world of farms, picnics, and
kitchens. **You grow by chomping other cobs and scooping up kernels.** You can chomp any cob that
has fewer kernels than you. Bigger cobs are too much to eat, so you **wear them down** first.

Your cob is made of two kinds of kernels:

- **Plain kernels** are your body. They're your health and your size, and they can't be fired.
  Some are extra tough or shrug off certain kinds of attacks.
- **Power kernels** are your special shots. Each power type gets its own button. **You choose when to
  fire** — nothing shoots automatically. Fire, freeze, zap, and popcorn blasts knock kernels off a
  big cob until it's small enough to chomp.

Every kernel you fire lands on the ground for you to pick up again. Get hit and your kernels fall off,
but they stay on the ground until someone picks them up. Get hit when you're down to your very last
kernel and you're **All Popped Out!**

**Kernel rule:** kernels on the ground never fade away on a timer. They just move around between
cobs, crows, and the ground until somebody scoops them up.

**Genre:** Bullet heaven / "survivors-like" (a growing horde, an endless map, constant power growth),
with **hand-fired powers instead of auto-attack**, mixed with agar.io-style "eat smaller things,
wear down bigger things" growth.

**Audience:** Designed around **10-year-olds** (core range about 8–11). Younger siblings can still
play on Easy Peasy, and parents can play along.

**Platform:** Web game, installable as a PWA. iPad is the main target and controls are touch-first.
It also has to be playable on iPhone. Desktop and keyboard work as a bonus.

**Session length:** 8–12 minute runs, with an Endless mode for longer play.

---

## 2. Design Pillars

1. **Your body is your build.** Your cob's whole look comes from the kernels it's holding, so you can
   always see your power by looking at it, and you can read any enemy the same way. Nothing important
   is hidden in menus.
2. **Chomp to grow.** Chomping is the main way to get bigger. Shooting is how you set up the chomp:
   wear a big cob down, watch its outline turn green, then gobble it up.
3. **Pick the right power.** Some cobs are fireproof, some are freeze-proof, some are rock-hard. Choosing
   which power button to press is the main strategy decision.
4. **Easy to learn, fun to master.** Left thumb moves, right thumb presses power buttons. Kids can
   play without reading much: icons come first, with short labels. The matchups and combos give
   10-year-olds something to master.
5. **Silly, never scary.** Nobody gets hurt. Cobs get dizzy, go *boing*, and poof into husks.
   Faces, googly eyes, and kazoo sounds.
6. **Forgiving, not punishing.** Losing kernels hurts, but you can always grab them back. Comebacks
   should happen often.

---

## 3. Core Loop

```
 Find a cob ─▶ Small? CHOMP it ─────────────────────────────────▶ Grow + gain kernels
     │                                                                   ▲
     └─▶ Big? Pick the right power ─▶ Fire to knock kernels off ─▶ Turns green ─▶ CHOMP
                                          │
                                          └─▶ Scoop up your fired kernels + loose kernels

 Grow ─▶ Enemies scale to your power ─▶ Explore further ─▶ Find bigger cobs
```

**Moment to moment (seconds):** steer, dodge, choose a power, fire, scoop kernels, chomp.

**Run (minutes):** grow through size tiers, learn which powers beat which cobs, set up power combos,
beat mini-bosses, and survive to the Harvest Moon boss or push your Endless high score.

**Meta (days/weeks):** earn Seeds, unlock new starting kernels, hats and skins, new biomes, and
fill in the Kernelpedia collection book.

---

## 4. The Player Cob

### 4.1 Two Kinds of Kernels

| | **Plain kernels** | **Power kernels** |
|---|---|---|
| **Job** | Health and size | Special shots |
| **Can be fired?** | No | Yes, with that power's button |
| **Look** | Rounder, matte, calm faces | Shinier, with a glowing icon and an excited face |
| **Special traits** | Some are extra durable or resist a damage type | Each has a damage type and an effect |
| **Share of a typical cob** | Most of it (about 70–85%) | The rest |

Both kinds count toward your **kernel count** (for chomping), your **health**, and your **size**.

### 4.2 Power Buttons (Manual Firing)

**[Decision] Nothing auto-fires.** Every power type you're holding gets its own button.

- **One button per power type**, on the right side of the screen. Each button shows the power's icon,
  a **count badge** (how many of that kernel you have), and a **recharge ring**.
- **[Decision] One shot per tap.** Each tap fires one kernel of that type. Holding a button does
  nothing extra, so every shot is a choice and every kernel feels precious.
- After a shot, the button's **recharge ring** refills (quick for Zinger, slower for big powers like
  Popper and Sprout). Taps during the recharge are ignored, so mashing doesn't waste kernels.
- **Firing spends that kernel.** It flies out, does its effect, then **drops onto the ground** where it
  hit or where it ran out of range. Roll over it to get it back.
- When you run out of a power type, its button goes gray and empty until you pick up more.

**Power Pockets (how many buttons):**
- You start with **3 Power Pockets** (3 buttons you can fire). You get +1 at size tier 3 and +1 at tier 5,
  up to a maximum of **5** on both iPad and iPhone.
- **[Decision] A power's button never moves.** Each power type has one fixed place on the arc, from the
  thumb outward: Zinger, Spicy, Popper, Frosty, then later powers. Keys 1–5 match that order. Running
  out of a power turns its button gray. It does not get replaced by another power.
- If you pick up a new power type while your pockets are full, it goes onto your cob (it still counts
  as health) and its own button shows up **dimmed**. It does not fire until you arm it. A new pocket
  (from a size tier or Extra Pocket) arms the next dimmed power in button order.
- **[Playtest] How you swap which powers are armed.** For now, tap a dimmed button (or press its number
  key) to arm it. If every pocket is full, it trades with an empty armed power if you have one,
  otherwise with the armed power latest in button order. That gesture is provisional. The buttons
  stay put either way.
- Fewer buttons you can fire keeps the screen simple, especially on iPhone, and makes choosing your
  loadout part of the strategy.

**Aiming:**
- **Auto-target:** a bouncy **dashed white circle** sits on the cob you're most likely trying to wear down
  (by default, the nearest cob with a red outline, favoring ones in front of you). Shots go there.
- **Tap a cob** on the right side of the screen to lock that circle onto it.
- **[Decision] Status outlines follow the cob. The aim marker stays a circle.** Green and red
  outlines trace the husk and the body, drawn tight behind the cob with a thin glow. The dashed
  aim marker is a circle, because a dashed cob shape reads as clutter. The player cob has no
  status outline of its own.
- **[Decision] Auto-target plus tap-to-lock is the default.** No manual aiming is needed.
- **Drag-to-aim (optional, off by default, in Settings):** drag from a power button like a slingshot
  to aim by hand, for players who want more control.

**Heart Kernel (minimum of 1):**
- You can **never fire your last kernel**. If your cob is down to a single kernel, the buttons lock.
- That last kernel is your **Heart Kernel**. It glows and has a little worried face, so kids can see
  "go grab kernels!"
- Shooting alone can never make you lose. Only getting hit while you're down to your Heart Kernel
  can (§4.4).

**Your fired kernels on the ground:**
- They have a soft **sparkle ring in your color** for a few seconds so you can see which kernels you
  just shot, then they look like any other ground kernel.
- Your **pickup magnet** pulls them in, which makes the Big Magnet perk and Goldie kernels valuable.

### 4.3 Taking Damage and Resistances

- Each hit knocks **1 kernel** off (big attacks knock off more). The kernel bounces out onto the ground.
- **Every hit has a damage type** (Bonk, Fire, Freeze, Zap, Pop, or Sticky; see §5.3). A hit only
  knocks off kernels that **don't resist** that type. Resistant kernels go *tink!* and stay on.
- **Which kernel?** Out of the kernels that can be knocked off, the game picks at random, weighted
  heavily toward plain **Sunny** kernels, so rarer kernels feel safe-ish.
- That means your plain kernels are also your **armor**. Collect Soggy kernels and enemy fireballs
  can't knock them off. Tough Nut kernels take 3 hits before popping off.
- **Knocked-off kernels never disappear.** They stay on the ground until someone picks them up:
  you, an enemy cob, or a crow (§6.1). Getting hit is a setback you can always undo by scooping.
- **Mercy invulnerability:** about 0.75 s after each hit, with the cob flashing and wobbling.

### 4.4 All Popped Out (Losing)

- If you get hit while you only have your **Heart Kernel**, it pops off and you become a
  **Bare Cob**: a pale, wobbly cob with a surprised face.
- **Last Chance (3 s):** if you grab any kernel during this time, you're back in it. There are
  usually kernels lying nearby, so this makes for great comeback moments.
- If not: **"All Popped Out!"** The cob gives a big yawn, curls up in its husk like a sleeping bag,
  and takes a nap (with little "Zzz"s). The results screen shows your biggest size, cobs chomped,
  kernels collected, and Seeds earned, with a big **"Wake Up & Play Again!"** button.
- Language is always gentle: the cob is tired or sleepy, never hurt or beaten.

### 4.5 Growth and Size Tiers

Your cob has a set number of **kernel sockets**. When the sockets fill up, the cob grows to the next tier.

- **[Decision] Size tiers only go up during a run, never down.** If firing or hits empty your
  sockets, you see **empty sockets** (little "hungry" holes) instead of shrinking. Empty sockets
  are your "missing health" and show you how much there is to scoop back up.
- This keeps the camera zoom and your hitbox steady, so the screen doesn't jump around while you fire.

| Tier | Name         | Sockets | Power Pockets | Visual                        | Unlock moment             |
|------|--------------|--------:|--------------:|-------------------------------|---------------------------|
| 1    | Baby Cob     |      12 |             3 | Tiny, chubby, big eyes        | Start                     |
| 2    | Snack Cob    |      30 |             3 | Longer, little leaf hair      | First Ear Up! choice      |
| 3    | Picnic Cob   |      60 |             4 | Husk "cape" appears           | Ear Up! choice            |
| 4    | Big Cob      |     120 |             4 | Thicker, eyebrows             | Ear Up! choice            |
| 5    | Mega Cob     |     200 |             5 | Sparkles, tassel crown        | Ear Up! choice + mini-boss|
| 6    | Cob-zilla    |     320 |             5 | Huge, ground shakes on move   | Ear Up! choice            |
| 7    | Corn Castle  |     500 |             5 | Husk banners                  | Ear Up! choice            |
| 8    | Corn Mountain|     750 |             5 | Little clouds float by        | Ear Up! choice            |
| 9    | Golden Ear   |   1,000 |             5 | Gold trim                     | Ear Up! choice            |
| 10   | Corn Utopia  |   1,250 |             5 | Rainbow shimmer               | Top tier (extras → Seeds) |

- **[Decision] A run starts as a plain Sunny cob** (no power kernels). The first snacks on the
  field each carry one power kernel, so your first chomps are what arm you.
- **Bigger cobs hit harder and reach farther.** Shot range, blast radius, move speed and magnet
  scale with your size, and the flat kernels knocked off per hit grow too (sub-linearly). On top
  of that, every hit **shakes loose** a share of the target (§5.3), so a 1,000-kernel cob still
  wears down a big cob in a sensible number of shots.
- **Big cobs get rarer as you grow.** Chomping a cob about your size roughly doubles you, so
  the director spawns fewer easy "wear it down" cobs the bigger you are.
- **[Decision] It gets harder as you get bigger.** A challenge level rises from 0 at tier 1 to 1
  at the top tier and drives:
  - **Hunter cobs:** big (1.5–3× your size), armored (they take half damage), mostly Soggy or
    Rocky so you have to switch powers, and they chase you. Up to 30% of spawns at the top tier,
    none at tier 1. They pulse a second red ring so kids can see them coming. Beating one is the
    big payoff of the late game.
  - **Faster enemies:** up to +30% speed at the top tier (hunters stay slower than you, so you
    can always run).
  - **Harder bumps:** a bump costs a few kernels when you're small, and up to 3% of your cob at
    the top tier.
- M0 tuning, measured with the bot: time per tier rises (about 15 s at tier 4, 30 s at tier 5,
  then 15–50 s per tier from tier 6 to 9). With Shake Loose (§5.3), 9 of 10 bot runs reach the top
  tier, most in 1.5–3 minutes (before it, half did within 8 minutes and the rest stalled at tier 7).
  Growth pacing now needs retuning outside damage (big-cob spawn rate, hunters, snack sizes). A cob that stops playing at size 1,200 loses about a
  third of itself in 4 minutes, versus nothing before.

- **Camera zooms out as you grow** (like agar.io), so your cob takes up about the same amount of
  screen and the world feels like it's shrinking around you. This is very important for readability
  on iPhone.
- **Trade-offs of size:** a bigger hitbox, slightly slower turning, and a much bigger pickup magnet
  plus more sockets, which means more health and more room for power kernels.

### 4.6 Chomping (The Main Way to Grow)

- Touch an enemy cob that has **fewer kernels than you have on your cob right now** to **CHOMP** it.
- Touch an enemy with **the same number of kernels or more** and you both bounce apart, and you
  lose a few kernels onto the ground. Enemies never chomp the player.
- **Chomping is always the best reward:**
  - All of the cob's kernels go **straight onto your cob**. No scattering, no racing crows for them.
  - **Chomp Bonus:** each chomp also grows 1–3 brand-new Sunny kernels on your cob.
  - **Chomp Streak:** chomps within a few seconds of each other build a streak that boosts the bonus
    (with a rising "nom, NOM, NOM!" sound).
- **Shooting a cob down to nothing** is allowed: it poofs and drops all its kernels on the ground,
  but there's **no Chomp Bonus**, and other cobs can grab the loot once it's been lying around
  a while. The smart play is to shoot until it's green, then chomp.
- **Kernels you knock off are yours first:** for **10 s** after a kernel is knocked off a cob, only
  the player can pick it up. Other cobs ignore it, so fighting a pack doesn't just pass the
  kernels from one cob to the next.
- The comparison uses **kernel count, not size**. That creates strategy:
  - Shooting knocks kernels off big cobs until they're chompable.
  - Firing also lowers *your* count, so a cob you could chomp a second ago might not be chompable
    anymore. Scoop up your kernels, then go for the chomp.
- **Readability:** cobs you can chomp get a **green wiggle outline and a "yum" mouth**. Dangerous
  cobs get a **red outline and angry eyebrows**. Both outlines trace the cob (body and husk), not a
  circle around it. They update live as counts change. Never make players compare kernel counts by eye.
  The player cob does not get a colored outline.

### 4.7 Ear Up! (Level-Up Choice)

Every time you grow a size tier you get a "pick 1 of 3" moment. Kernels are already the main
upgrade system, so Ear Up! choices are **cob perks**, picked from big picture cards (icon first,
1–3 words):

- **Big Appetite:** Chomp Bonus +2 kernels
- **Big Magnet:** pickup radius +30%
- **Zoomies:** move speed +10%
- **Quick Hands:** power buttons recharge 15% faster
- **Extra Pocket:** unlock your next power button right away (never more than 5)
- **Long Shot:** fired kernels fly 20% further
- **Boomerang:** 20% of fired kernels fly back to your cob by themselves
- **Thick Husk:** 20% of hits are blocked
- **Butter Roll:** your dash goes 25% further
- **Lucky Ear:** rare kernels show up 25% more often

You **start with a dash**. It is the big button under your right thumb, so one finger can steer
while the other dashes. Butter Roll does not unlock it. Each copy just makes that dash longer.

Ear Up! pauses the game (important for kids). Tap a card to choose. You can **re-roll** once per run.

**[Decision] Stacking.** Every perk can be taken again, and each copy adds its percentage (or its
flat bonus) on top of the last. Extra Pocket never goes past 5 buttons. Boomerang and Thick Husk
each add another 20% (1 more out of every 5) up to all of them. Butter Roll adds another 25% of
dash distance. Lucky Ear makes rare kernels another 25% more common.

---

## 5. Kernels

Kernels are the heart of the game. Every kernel type needs:

- A **unique color AND a unique shape or pattern/icon** (for colorblind players and readability)
- A **tiny face** with its own expression
- A distinct **pickup sound** (and a **firing sound** for power kernels)
- A behavior that kids can recognize just by watching it
- A **look trait** (plain kernels) or **flair** (power kernels) that changes a cob's whole appearance
  when it's carrying a lot of them (§12.2)

### 5.1 Plain Kernels (Body, Can't Be Fired)

| Kernel             | Look                         | Trait                                                        | Rarity    |
|--------------------|------------------------------|--------------------------------------------------------------|-----------|
| **Sunny** (Yellow) | Classic yellow, smile        | Basic kernel. 1 hit pops it off.                             | Common    |
| **Sweetie** (White)| Pearly, heart pattern        | Slowly grows a brand-new Sunny kernel on your cob            | Uncommon  |
| **Tough Nut**      | Dark brown, shiny shield     | Takes **3 hits** of any type before popping off              | Rare      |
| **Soggy**          | Teal, water-drop pattern     | **Immune to Fire.** Weak to Zap (Zap knocks off 2)           | Uncommon  |
| **Toasty**         | Golden-brown, toast marks    | **Immune to Freeze**                                         | Uncommon  |
| **Rubbery**        | Pink, squiggly stripes       | **Immune to Zap.** Bonk shots bounce off it at half strength | Uncommon  |
| **Stony**          | Gray, little cracks          | **Immune to Bonk.** Weak to Pop (explosions crack it)        | Rare      |
| **Leafy**          | Green, wrapped in a tiny leaf| **Immune to Pop** explosions                                 | Uncommon  |
| **Goldie** (Gold)  | Gold, sparkles               | Boosts magnet range and Seeds earned                         | Epic      |

### 5.2 Power Kernels (Fired With Buttons)

| Kernel             | Look                    | Damage type | When fired                                                  | Rarity    |
|--------------------|-------------------------|-------------|-------------------------------------------------------------|-----------|
| **Zinger**         | Orange, arrow icon      | Bonk        | Fast, cheap straight shot. Knocks off 1. Your "basic" power | Common    |
| **Spicy**          | Red, flame tuft         | Fire        | Fireball knocks off 2 and leaves a short burning patch       | Uncommon  |
| **Frosty**         | Icy blue, snowflake     | Freeze      | Knocks off 1 and slows; 3 hits freeze the cob in place       | Uncommon  |
| **Boing**          | Purple, spring stripes  | Bonk        | Ricochets between up to 4 cobs, knocking 1 off each          | Uncommon  |
| **Popper**         | Puffy popcorn           | Pop         | Lobbed shot that explodes, knocking 1 off every cob nearby   | Uncommon  |
| **Zappy**          | Candy-corn triangle     | Zap         | Chain lightning hops to nearby cobs                          | Rare      |
| **Caramel**        | Glossy brown, drip      | Sticky      | Sticky glob: the cob slows way down and can't pick up kernels| Rare      |
| **Sprout**         | Bright green, sprout    | Bonk        | Plants itself where it lands and grows into a little helper plant that shoots seeds at the nearest cob for about 6 s, then turns back into a kernel to pick up | Rare |
| **Gem** (Glass Gem)| Rainbow glass           | Random      | Uses a random power's attack each time, at double strength   | Legendary |

**[Decision] Sprout helper plants** are the one thing in the game that shoots by itself. You still
choose when and where to plant one, so it fits the "you choose when to shoot" rule. The plant is a
cute little stalk with a face that turns to aim, puffs out seed shots, and waves goodbye before it
shrinks back into a Sprout kernel. Planting several near a big cob is a good way to wear it down
while you dodge.

### 5.3 Damage Types and Resistances

Six damage types, each with a clear icon that pops up on every hit:

| Damage type | Icon        | Comes from                         |
|-------------|-------------|------------------------------------|
| **Bonk**    | Star        | Zinger, Boing, Sprout, bumping     |
| **Fire**    | Flame       | Spicy                              |
| **Freeze**  | Snowflake   | Frosty                             |
| **Zap**     | Lightning   | Zappy                              |
| **Pop**     | Burst       | Popper, Popcorn Bombers            |
| **Sticky**  | Drip        | Caramel (slows only, never knocks kernels off) |

**Matchup chart** (what each plain kernel does against each damage type):

| Plain kernel | Bonk  | Fire   | Freeze | Zap    | Pop    |
|--------------|-------|--------|--------|--------|--------|
| Sunny        | ✔     | ✔      | ✔      | ✔      | ✔      |
| Sweetie      | ✔     | ✔      | ✔      | ✔      | ✔      |
| Tough Nut    | 3 hits| 3 hits | 3 hits | 3 hits | 3 hits |
| Soggy        | ✔     | 🛡 immune | ✔   | ⚡ weak (×2) | ✔ |
| Toasty       | ✔     | ✔      | 🛡 immune | ✔   | ✔      |
| Rubbery      | ½     | ✔      | ✔      | 🛡 immune | ✔   |
| Stony        | 🛡 immune | ✔  | ✔      | ✔      | ⚡ weak (×2) |
| Leafy        | ✔     | ✔      | ✔      | ✔      | 🛡 immune |
| Goldie       | ✔     | ✔      | ✔      | ✔      | ✔      |

Power kernels have no resistances; a hit of any type can knock them off.

**How it plays:**
- A shot knocks off kernels it **can** affect. If every kernel left on a cob resists that shot, it goes
  *tink!*, shows a little shield icon, and nothing comes off. That's a clear cue to **switch powers**.
- Mixed cobs wear down in layers. Fire a Soggy-and-Sunny cob with Spicy and the Sunny kernels pop
  off, but the Soggy ones stay. Then finish it with Zinger or Zappy.
- **Resistances protect you too.** The same rules apply to enemy attacks on your cob, so collecting
  Soggy kernels makes you safer against fire-shooting cobs.
- **Readability:** cobs show **small shield badges** above them for any resistance that covers most
  of their kernels. The Kernelpedia teaches matchups with pictures.

**Shake Loose (how power hits scale):** big cobs are packed with kernels, so a good hit rattles a
whole handful loose. Every power hit knocks off its flat amount **plus a share of the target's
kernels that don't resist it** (Zinger 2%, Spicy 3%, Popper 1.5% of each cob caught in the blast,
burn patches 0.5% per tick; all tunable). That keeps "shots until it turns green" about the same
at every size, without kids needing bigger numbers:
- A flat amount alone grows slower than the cobs do, so a late-run project cob would take
  hundreds of taps. The share means a 2,000-kernel cob loses about 40 to a Zinger, a 20-kernel cob
  loses its usual 1.
- **It sharpens the matchup game.** Only kernels that can be knocked off count, so a Zinger on a
  95%-Stony cob only shakes loose from the 5% that's left. As a mixed cob's soft layer runs out,
  each hit shrinks and then *tinks*: the cue to switch powers.
- **Enemies already play by this rule:** bumps cost a share of your cob at the top tier (§4.5).
- Hunter armor still halves the whole hit.

### 5.4 Power Milestones

- Each power gets stronger based on **how many of it you're holding**. Fired kernels still count for
  about 5 seconds, so milestones don't flicker off every time you shoot.
- **Milestones at 5 / 10 / 20** of a power give a visible upgrade:
  - 5 Spicy: fireballs get bigger
  - 10 Spicy: fireballs split into 3
  - 20 Spicy: **Flamethrower** (each tap breathes a short stream of fire instead of one fireball)
- A milestone triggers a **little celebration** (that power's kernels dance, and its button gets a
  shiny new border).

### 5.5 Power Combos (Hit Combos)

Because you fire by hand, combos come from **hitting a cob with one power, then another**. That
rewards thinking about the order you press your buttons:

| Combo           | How                                         | Effect                                                     |
|-----------------|---------------------------------------------|------------------------------------------------------------|
| **Steam Burst** | Spicy on a frozen cob                       | Big puff of steam knocks off 3 extra, **ignores Toasty**   |
| **Splash Zap**  | Zappy on a cob that's mostly Soggy          | Lightning splashes to every nearby cob                     |
| **Shatter**     | Popper on a frozen cob                      | Knocks off 4 extra, **ignores Stony**                      |
| **Kettle Corn** | Popper on a burning cob                     | A popcorn shower drops 5 bonus Sunny kernels               |
| **Caramel Corn**| Spicy on a caramel-stuck cob                | Caramel hardens; the cob is stuck in place for 4 s         |
| **Corn Maze**   | Sprout landing in a caramel puddle          | Grows a ring of stalk walls that traps nearby cobs          |
| **Disco Cob**   | Gem hitting a cob that's zapped             | Rainbow lasers spin out from the target                    |

Combos show up in the Kernelpedia as **silhouettes** until you find them, which drives curiosity and
replay. The first time a combo happens, it gets a big name pop-up and a fanfare.

### 5.6 How Kernels Look on the Cob

- Kernels sit in **rows** around the cob. The game shows the front face and adds a gentle "rotation"
  wobble so you can see the variety.
- **[Decision] The game arranges kernels automatically.** Plain kernels fill the body, and power
  kernels sit in a glowing band near the top so they're easy to spot. No inventory management.
- Every socket shows the real kernel in it, and the cob's overall look changes with its mix of
  kernels (see §12.2).
- **Later idea (not for launch):** an optional "Cob Garden" screen between runs where older kids can
  arrange kernels for small adjacency bonuses.

### 5.7 Kernel Cap and Overflow

When you're at the top tier and every socket is full:

- A new kernel **replaces the weakest kernel** (usually a Sunny), so you're always upgrading.
  The swapped-out kernel turns into **Seeds** (meta currency) instead of dropping, so pickups never
  feel wasted and full cobs don't spray clutter onto the ground.

---

## 6. Enemies

### 6.1 Enemy Rules

- **Most enemies are cobs made of kernels**, and **they're worth what they're made of**. A teal cob
  is full of Soggy kernels. A cob with a red glowing band is carrying Spicy power kernels. Kids learn
  to hunt the colors they want.
- **An enemy's kernels tell you how to beat it.** A teal, drippy Soggy cob laughs off fire, so reach
  for Zappy. A gray, cracked Stony cob shrugs off Zingers, so lob a Popper. Because every cob's look
  is built from its kernels (§12.2), kids can read this at a glance. This is the core strategy of the game.
- Enemy cobs **pick up kernels on the ground** too, including ones you fired or dropped, and grow if
  they do. That creates "race them to the loot" moments and gives you a reason to scoop quickly. The
  kernels aren't lost: chomp that enemy and you get them back.
- **Enemies follow the same rules you do.** Shooter cobs fire their own power kernels, which land on
  the ground as free pickups for you. A Shooter cob that fires too much gets small enough to chomp.
- **Most cobs are a mix of plain kernels.** Early cobs are mostly Sunny. Further out and at higher
  power, cobs carry more resistant kernels, so the matchup choices matter more as the run goes on.
- Every enemy needs a clear **silhouette + color + movement pattern** so it reads instantly.

### 6.2 Enemy Roster (Launch)

| Enemy              | Behavior                                                       | Made of / drops       |
|--------------------|----------------------------------------------------------------|-----------------------|
| **Nibblers**       | Tiny loose kernels with legs, swarm in packs, easy to chomp    | 1 kernel each         |
| **Baby Cobs**      | Wander toward you slowly, basic fodder, usually chompable      | 3–8 Sunny             |
| **Zoomer Cobs**    | Fast, run straight lines, bonk and bounce off                  | Sunny + Boing         |
| **Shooter Cobs**   | Keep their distance, fire slow, clearly visible shots that land as pickups | Their power type |
| **Soggy Cob**      | Slow and drippy; fireproof                                     | Mostly Soggy          |
| **Rocky Cob**      | Slow, heavy, rolls in a straight line; Bonk-proof              | Mostly Stony          |
| **Bouncy Cob**     | Hops around; Zap-proof                                         | Mostly Rubbery        |
| **Husky**          | Wears a husk shield; Pop it off first, then wear it down       | Tough Nut + Sunny     |
| **Popcorn Bomber** | Waddles up, swells up, pops (with a clear 1 s warning)         | Popper                |
| **Crows**          | Not corn! Fly in and **steal kernels from the ground**, carry them off; shoot them to make them drop the loot | Whatever they stole |
| **Corn Cousins**   | Rival cobs with mixed kernels and power kernels that hunt *you*, agar.io style | Mixed, often rare |
| **Kernel Swarm**   | A huge wave event, 100+ Nibblers at once (a chomping frenzy)   | Tons of kernels       |

### 6.3 Mini-Bosses and Bosses

All silly, nothing scary. **Every cob boss is beaten the same way the whole game works: wear it down,
then chomp it.**

- **Scarecrow Steve** (mini-boss): flaps his arms to make a wind gust that pushes you; calls crows.
  Not a cob, so you pop him with shots, and he drops a big pile of power kernels.
- **The Butter Knight** (mini-boss): a stick of butter in armor; leaves slippery butter trails.
  Freeze his butter trail to make it safe.
- **Harvey the Harvester** (event): a goofy cartoon combine with a big smile and googly eyes that
  rolls across the map. Shoot his "corn hoppers" and he spits out mountains of kernels.
  *Keep him toy-like: rounded, pastel, nothing sharp or grinding on screen.*
- **King Cob** (Harvest Moon boss): a giant crowned cob. He changes his kernel coat in phases
  (Soggy coat, then Stony coat, then a mixed coat with Tough Nuts), so you have to switch powers to
  wear him down. When his outline finally turns green, **you chomp the King** to win the run.

### 6.4 Enemy Projectiles

- Enemy shots are **slow, big, and round with dark outlines**, and show their damage-type icon.
  Player shots are **smaller, softer, and partly see-through**. Players must never lose track of what
  can hit them.
- Cap on-screen enemy projectiles so the screen stays readable (see §11.4).

---

## 7. Scaling and Difficulty

### 7.1 Power Score

Enemies scale to your **current power**, so the game always feels like a fair fight.

```
power = Σ (kernel.weight)  +  perkCount × 2  +  powerPocketsFilled × 3
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
  enemies ease off, which gives you a gentle built-in comeback. When you grow, the challenge ramps up
  a beat later so you get to feel strong first.
- Each enemy type has a cost and a minimum power tier. The director mixes **fodder (lots of cheap
  enemies)** with **threats (fewer expensive ones)**.
- **Chomp bands:** about 60% of spawns should be chompable right away (quick snacks), about 30% should
  need a little wearing down, and about 10% should be big "project" cobs that take real effort.
- **Matchup variety:** the director makes sure there's usually at least one cob nearby that your
  current powers are good against, and mixes in cobs that resist them so you have reasons to switch.
- **Pacing waves:** about 45 s calm → 20 s rush → calm, with a scripted event every 2–3 minutes
  (Kernel Swarm, Crow Raid, Harvey, mini-boss).

### 7.3 Difficulty Settings

| Setting        | Who it's for                    | Changes                                                       |
|----------------|---------------------------------|---------------------------------------------------------------|
| **Easy Peasy** | Younger siblings (6–7) and new players | **Smart Fire turned on automatically** (see §11.1), slower enemies, much bigger pickup magnet, fewer resistant cobs, enemies don't grab your fired kernels, Last Chance 6 s, no Crows |
| **Just Right** | Default, tuned for 10-year-olds | As designed                                                    |
| **Spicy**      | Older kids / parents            | Faster director ramp, more resistant and "project" cobs, enemies grab ground kernels faster, smaller magnet |

---

## 8. The World

### 8.1 Infinite Map

- **Chunk-based procedural generation**, seeded per run (so you can share a "seed code" with a friend).
- Chunks are about 1 screen wide at the starting zoom. Load nearby chunks and unload far ones.
- **Distance from the start** sets the biome and nudges difficulty up, so exploring is a choice
  ("go further = more danger, better loot").

### 8.2 Biomes

Biomes sit in rings or regions moving outward from the start. Each biome leans toward certain kernel
types, which changes which powers are useful there:

| Biome              | Vibe                          | Unique feature                                      | Common kernels       |
|--------------------|-------------------------------|-----------------------------------------------------|----------------------|
| **Sunny Farm**     | Starting field, tractors, hay | Hay stacks block shots; mud puddles slow you down   | Sunny, Zinger        |
| **Picnic Park**    | Checkered blankets, ants      | Ants carry kernels away (like Crows)                | Sweetie, Boing       |
| **Kitchen Counter**| Giant cutting board, pots     | Butter puddles = speed boost; sink splashes         | Soggy, Toasty, Frosty|
| **Movie Theater**  | Dark carpet, popcorn buckets  | Popcorn rain event                                  | Leafy, Popper        |
| **County Fair**    | Rides, balloons, lights       | Bumper cars bounce everything; prize booths         | Rubbery, Zappy       |
| **Taco Night**     | Tortillas, salsa rivers       | Salsa river slows                                   | Toasty, Spicy        |
| **Rock Garden**    | Pebbles, little fountains     | Rolling boulders                                    | Stony, Tough Nut     |

**[Decision] Sunny Farm obstacles are gameplay.** Hay blocks shots. Mud slows movement. Hay bales are
a similar, slightly large size and sit in stacks of three, one stack per chunk and sometimes two,
with a little jitter. They are not scattered singles. The opening around spawn stays clear of both.

### 8.3 Points of Interest

These give players places to steer toward on an infinite map:

- **Kernel Piñatas:** shoot them open for a burst of kernels
- **Power Patches:** a little garden that grows one type of power kernel over time
- **Sprinklers:** stand under one to slowly regrow Sunny kernels
- **Shrines (Salt Shaker, Butter Dish):** pick 1 of 2 trades (e.g. "give 10 Sunny, get 1 Epic")
- **Rescue Kernels:** a trapped kernel family in a cage. Free them and they join you.
- **Golden Corn Stalk:** a rare landmark that gives a Legendary

### 8.4 Navigation

- **Edge arrows / compass** point to the nearest point of interest and active events.
- **No full minimap on iPhone** (too small). An optional small one on iPad.

---

## 9. Run Structure and Modes

### 9.1 Harvest Run (Main Mode)

- **10 minutes.** At 10:00 the **Harvest Moon** rises and King Cob arrives. The length is a
  config value to adjust after playtesting.
- Chomp King Cob to **win the run** (fireworks, popcorn rain, big Seed reward). After that you can
  keep going in **Overtime** for bonus Seeds.
- Clear structure for kids: "grow big enough to chomp the King when the moon comes."

### 9.2 Endless

- No boss timer. The director keeps ramping. Go for a high score: biggest cob, cobs chomped, time.

### 9.3 Later Modes (Post-Launch Ideas)

- **Daily Seed:** everyone gets the same map and the same starting kernels.
- **Online multiplayer (possible future feature, not at launch).** Ideas: team up with a friend to
  chomp King Cob together, or a friendly "who can grow biggest" race. Kid-safe rules if it happens:
  - **Friends only:** join with a short room code shared in person. No public matchmaking with strangers.
  - **No chat.** Only preset emotes and stickers ("Yum!", "Help!", "Nice chomp!").
  - **A parent turns it on** behind the parent gate, with a clear explanation of what's shared.
  - No couch co-op (two players on one iPad) is planned.

The launch game is **single-player only**. The code should still be structured so online play could
be added later without a rewrite (§14.2).

---

## 10. Meta Progression

### 10.1 Seeds (Currency)

Earned from every run based on time, size, chomps, chomp streaks, and Goldie kernels.
**The game is completely free:** no real-money purchases, no ads, and nothing locked behind payment.
Everything is earned by playing.

### 10.2 The Farm (Hub Screen)

- A cozy farm where you spend Seeds:
  - **Seed Bank:** unlock new **starting loadouts** on top of the plain Sunny start (e.g. start with
    3 Zinger or 3 Spicy, or with a few Soggy kernels for armor)
  - **Cob Closet:** hats, glasses, mustaches, husk colors (cosmetic only)
  - **Field Upgrades:** small permanent boosts (+5% magnet, +1 starting kernel, +1 re-roll), with a cap
- **Unlock biomes** by reaching them for the first time.

### 10.3 Kernelpedia

- A collection book of every kernel, power combo, enemy, and boss. Locked ones are shown as silhouettes.
- Kernel pages show **matchups with pictures** (a flame bouncing off a Soggy kernel) so kids can learn
  them without reading.
- Each entry has a silly one-line joke ("Frosty kernels are the coolest kernels. Literally.").

### 10.4 Achievements / Stickers

- Stickers instead of "achievements": a sticker book with tasks like "Chomp 100 cobs," "Find a Gem
  kernel," "Make a Steam Burst," "Chomp King Cob on Spicy."

---

## 11. Controls and UX (Touch-First)

### 11.1 Core Controls

| Input                        | Action                                                              |
|------------------------------|---------------------------------------------------------------------|
| **Drag on the left half**    | **Floating joystick** shows up where your thumb lands; drag to steer |
| **Lift finger**              | Cob slowly coasts to a stop (doesn't stop instantly; feels smoother) |
| **Tap the dash button**      | Dash the way you are steering (or the way you last moved). You start with it |
| **Tap a power button**       | Fire one of that power kernel at the target (one shot per tap)      |
| **Tap a cob (right half)**   | Lock the dashed target circle onto that cob                        |
| **Space or Shift**           | Dash, same as the button                                            |
| **Pause**                    | Top corner, inside the safe area                                    |

- **Nothing fires on its own** (except a planted Sprout helper plant). The player always chooses which
  power to use and when.
- **Two thumbs at once:** you must be able to steer and tap power buttons at the same time, and
  tap two power buttons back to back for combos.
- **Smart Fire (option for everyone):** replaces the power buttons with one big **Fire** button that
  picks the best power against the current target. Any player can turn it on or off in Settings,
  and it's **turned on automatically on Easy Peasy**. It still fires only one shot per tap. It helps
  the youngest kids and anyone who finds several buttons hard.
- **[Decision] Alternate movement: "Follow My Finger."** The cob rolls toward wherever your left-side
  finger is. It's easier for very young kids and works well on iPad. Players can switch in Settings.
- Keyboard (WASD/arrows to move, 1–5 for powers, Space to dash, Tab to change target) and gamepad (stick to move,
  face buttons and shoulders for powers) work on desktop and on iPads with a controller.

### 11.2 Layout

- **Dash is the big button in the bottom-right corner.** Power buttons sit in an arc around it, each power in a fixed place. Each button is
  at least 64 pt on iPad and 56 pt on iPhone, with clear space between them so kids don't hit the
  wrong one.
- **iPad (landscape and portrait):** joystick on the left half, power arc bottom-right. HUD along the top.
- **iPhone landscape (recommended):** same layout, smaller HUD, camera zoomed out a bit more.
- **iPhone portrait:** supported. Joystick zone on the bottom-left, power arc bottom-right (two short
  rows if you have 5 pockets), HUD on top. Zoom out further, since the view is narrow.
- **Left-handed option:** mirror the layout (powers on the left, joystick on the right).
- iOS doesn't honor the manifest's `orientation` lock reliably, so **every screen must work in both
  orientations** and re-layout live when the device rotates.

### 11.3 Touch Rules

- Tap targets **at least 44×44 pt** (bigger for kids: 56–64 pt for power buttons, 60+ pt for menus).
- Keep controls **away from the bottom edge** (the iOS home-indicator swipe) and the top-left/right
  corners (system gestures). Use `env(safe-area-inset-*)`.
- No hover-only anything. No long-press-only actions. No pinch gestures in gameplay.
- Prevent page zoom, scroll, bounce, text selection, and the long-press callout inside the game.

### 11.4 Readability (Bullet Heaven Clutter)

- **Layer order (bottom → top):** ground → ground kernels → player shots → enemies → enemy shots →
  player cob → target circle → HUD.
- Player effects **fade as more stack up** (auto-dim when there are a lot of particles).
- Settings: **Reduce Flashing** and **Reduce Screen Shake** toggles.
- Ground kernels get a **gentle pulsing glow** so they read even in busy moments.
- **Flying kernels and ground kernels must look different at a glance.** Flying ones get a motion
  trail and no glow. Landed ones squash, bounce once, and start glowing. Kids need to know "that one
  is a shot" vs. "that one is a pickup."
- **Hit feedback shows the matchup:** every hit shows its damage icon. Resisted hits show a shield and
  a *tink!*; weak-spot hits show a big "x2" and a louder pop.
- Kernel merging (§14.3) and the pickup magnet keep the ground tidy.

### 11.5 HUD (Minimal, Icon-First)

- **Top:** run timer / moon progress bar, Seeds counter, pause.
- **Size tier bar:** a "cob fill" meter showing progress to the next tier.
- **Power buttons double as your power inventory:** icon, count, recharge ring, and milestone border.
- **Waiting powers:** small icons beside the button arc for power types that don't have a pocket yet.
- **Target ring:** shows the target's shield badges and a tiny "chomp meter" for how many more
  kernels need to come off before it turns green.
- **Heart Kernel warning:** when you're down to your Heart Kernel, the cob's glow pulses and arrows
  point toward the nearest kernels on the ground.
- **No numbers for health** — your cob *is* your health bar.

### 11.6 Onboarding (No Reading Needed)

1. A first-run "playground" with a big hand-drawn **thumb icon** that shows how to drag to move.
2. A tiny cob with a green "yum" outline wanders in. Arrow + chomp animation shows you can eat it.
   Your cob grows a little.
3. A bigger red-outlined cob appears. A **Zinger button pulses** and a hand icon taps it. Each shot
   knocks kernels off, the chomp meter fills, and the outline turns green. Chomp it!
4. Your fired kernels are lying on the ground glowing. The hand icon shows you to roll over them.
5. A teal Soggy cob arrives and you've just picked up a Spicy kernel. Fire goes *tink!* with a shield
   icon. The Zinger button pulses again: switch powers to wear it down.
6. Done in about 90 seconds, then straight into the first real run.

---

## 12. Art Direction

### 12.1 Style: "How Many Dudes?" Look

The main reference is **_How Many Dudes?_** (Butterscotch Shenanigans, the studio behind *Crashlands*).
What to take from it:

- **Flat, bright, hand-drawn cartoon art** with **thick, slightly wobbly dark outlines** and very
  little shading (one flat shadow tone at most). Shapes are simple and a bit lumpy on purpose, like
  confident marker doodles.
- **Paper-cutout animation.** Characters don't have walk cycles. They **bob, tilt, and wobble** as they
  slide around, like cutouts on popsicle sticks. Cobs rock side to side as they roll, hop a little when
  they turn, and lean into their direction of travel. It's funny, it reads clearly, and it's cheap
  enough to animate hundreds of cobs on screen at once.
- **Big chaotic crowds** that still read clearly, because every character is a simple flat silhouette.
- **Lots of particles and pops** for every hit.
- **Funny writing** on item cards and Kernelpedia entries.
- **Slightly top-down camera** (looking down at an angle), with cobs drawn standing upright so you can
  see their faces and kernels.

What to change for our audience:

- **No blood or gore.** Where *How Many Dudes?* sprays blood, we spray **kernels, corn silk, crumbs,
  confetti, and popcorn**.
- **Softer, friendlier palette:** sunny yellows, grass greens, sky blues, and candy colors instead of
  darker tones. Each biome has its own palette, but kernel colors stay the same everywhere.
- **Kid-friendly humor:** silly puns and corny jokes, not edgy pop-culture references.

General rules:

- **Big googly eyes and expressive faces** on cobs *and* kernels.
- **Squash and stretch** on everything: cobs squish when they turn, kernels boing when they land.
- **Plain vs. power kernels must read instantly:** plain kernels are matte with calm faces; power
  kernels are shiny, have a glowing icon, and look excited.
- Secondary references: *Crashlands* (same studio, same outline style), *Pikmin* and *Kirby* for
  cuteness, and the crowd readability of *Vampire Survivors* and *Brotato*.

### 12.2 Your Cob Looks Like Its Kernels

**[Decision] A cob's appearance is built entirely from the kernels it's holding.** Nothing about how
a cob looks is decided separately. This applies to the player and every enemy cob.

**Layer 1: real kernels in real sockets.** Every socket on the cob shows the actual kernel in it.
Pick up three Spicy kernels and you can see three red flame-tufted kernels on your cob. Fire one and
its socket turns into an empty "hungry" hole. Your cob is a live picture of your inventory.

**Layer 2: the cob's overall look changes with what it's mostly made of.** When one kernel type
makes up a big share of a cob (about 30% or more), the whole cob picks up that type's **look trait**:

| Mostly made of | Look trait                                                              | Movement wobble              |
|----------------|-------------------------------------------------------------------------|------------------------------|
| Sunny          | Classic bright yellow, happy face                                       | Normal bob                   |
| Sweetie        | Pearly sheen, little hearts float up now and then                       | Gentle sway                  |
| Tough Nut      | Darker, sturdy shape, the husk wraps around like a helmet               | Slow, heavy rock             |
| Soggy          | Teal tint, drips falling off, leaves a little puddle trail              | Squishy, jiggly bob          |
| Toasty         | Golden-brown toast marks, wisps of steam                                | Normal bob                   |
| Rubbery        | Pink and shiny, squiggly stripes                                        | Extra bouncy hops            |
| Stony          | Gray, cracked, chunky lumpy outline                                     | Heavy thud on every bob      |
| Leafy          | Extra leaves, like a leafy cloak                                        | Rustly sway                  |
| Goldie         | Gold shine and sparkles                                                 | Proud, puffed-up strut       |

A cob can show **two traits at once** (e.g. mostly Soggy with lots of Stony gives a teal, cracked,
drippy cob).

**Layer 3: power kernels add "flair."** The power kernels you're holding show up as small extras on
top, scaled by how many you have:

| Power kernel | Flair                                          |
|--------------|------------------------------------------------|
| Zinger       | Orange tassel "hair" that sticks straight up   |
| Spicy        | Little flames flicker from the tassel          |

**[Decision] The pointed stand-in tassel is not drawn.** A triangle on top of a Zinger or Spicy cob
read as an arrow, so this slice leaves it off. Frost on the husk and the occasional popcorn bit still show.
| Frosty       | Frosty breath puffs, icicles on the husk       |
| Boing        | Spring-shaped tassel that boings when you move |
| Popper       | Popcorn bits pop off now and then              |
| Zappy        | Little sparks crackle around the cob           |
| Caramel      | Shiny caramel drips from the top               |
| Sprout       | Tiny sprouts grow out of the husk              |
| Gem          | Rainbow shimmer across the whole cob           |

**Layer 4: face and mood follow your fill level.** Full cob: big grin. Half empty: determined. Down
to the Heart Kernel: worried, sweaty eyebrows. Just chomped: chewing, happy cheeks.

**Why it matters for gameplay:**
- **You can read an enemy's resistances from how it looks.** A teal, drippy cob is fireproof. A gray,
  cracked cob laughs off Zingers. A sparking cob is carrying Zappy kernels to drop. That's the core
  strategy skill, taught entirely through art.
- **Shield badges above cobs (§5.3) stay as a backup** for younger kids and colorblind players.
- **Players see their build change in real time.** Collecting a bunch of Soggy kernels visibly turns
  your cob into a drippy, fireproof cob.
- **Cosmetics (hats, glasses) sit on top** and never hide the kernels or traits.

### 12.3 Character Rendering Notes

- **Base cob body:** a few hand-drawn shapes per size tier, tinted by the main look trait.
- **Kernel sprites:** one small sprite per kernel type, placed into sockets by the auto-arranger (§5.6).
- **Trait overlays and flair:** separate small sprites layered on top (drips, cracks, flames, sparks).
- **Performance:** for enemy cobs, draw the body, kernels, and overlays into **one cached texture**
  and only redraw it when the cob's kernels change. Then each enemy is a single sprite that bobs and
  tilts. The player cob can stay fully live for the most juice.
- **Far-away or tiny cobs** (when zoomed out) use a simpler version: body tint + trait only, no
  per-kernel detail.

### 12.4 Tone Rules (Kid-Appropriate)

- **No blood, no gore, no fear.** Cobs that get worn all the way down get dizzy stars, spin, and
  **poof into a husk** and a puff of corn silk.
- Chomping is cartoony: a big "NOM!" text pop, crumbs, a happy cob face. The eaten cob gives a
  surprised "oop!" and disappears in a sparkle. It shouldn't look like it's being hurt.
- Harvester and crow designs stay **toy-like and goofy**.
- Words used: "pop," "boop," "popped out," "nap time," "chomp," "yum" — never "kill," "die,"
  "shucked," or anything that sounds like getting hurt or beaten.

### 12.5 Juice Checklist

- [ ] Power button press: button squishes, the kernel pops off the cob with a "pthoo!" and leaves an empty socket
- [ ] Kernel lands: squash, one bounce, glow turns on
- [ ] Kernels knocked off a cob: burst particles + a little "pop!" text
- [ ] Resisted hit: *tink!*, a shield icon, the cob makes a smug face
- [ ] Weak-spot hit: big "x2", extra-loud pop
- [ ] Cob turns chompable: outline flips red → green with a little "ding!" and the cob looks nervous
- [ ] Kernel pickup: magnet whoosh → snap onto the cob with a squash + rising pitch sound for each kernel picked up in a row
- [ ] Chomp: screen bounce, crunch, a crumb burst, streak counter
- [ ] Power combo: name pop-up ("STEAM BURST!") and a fanfare sting
- [ ] Tier up: cob grows with a "ta-da!" spin, camera zooms out smoothly
- [ ] Hit taken: cob flinches, quick white flash, kernel spins off
- [ ] All Popped Out: big yawn, cob tucks into its husk sleeping bag, "Zzz" bubbles, a sleepy lullaby jingle

### 12.6 Asset Pipeline

- **Vector source art** (SVG / Figma / Affinity) exported to **sprite atlases** at 1× and 2×.
  Keep the hand-drawn wobble in the outlines; don't clean them up into perfect vectors.
- Kernel types can share one base sprite plus **tint + overlay icon** to save memory and art time.
- **Animation is mostly code:** bob, tilt, wobble, hop, squash, and stretch are done with simple
  math on whole sprites, in the *How Many Dudes?* cutout style. Hand-drawn frames are only needed
  for faces/expressions and a few special effects.
- Each look trait and flair is a small set of overlay sprites, so a new kernel type only needs a
  kernel sprite, a trait overlay, and (for power kernels) a flair sprite.

---

## 13. Audio

- **Music:** bouncy, cheerful — banjo, marimba, kazoo, hand claps, toy piano. Each biome gets a theme.
  The music layers up as action builds up (adaptive stems), and the King Cob fight gets a "big silly
  hoedown" track.
- **SFX:** each power has its own firing sound. Each damage type has its own hit sound, and a resisted
  hit always sounds like *tink!* so players can hear when to switch powers. Pickup pitch rises with
  each kernel in a quick streak. Chomp = crunch, and chomp streaks climb in pitch. All Popped Out =
  yawn + a sleepy music-box jingle.
- **Voice:** short, cute vocal sound effects only ("Yum!", "Whee!", "Uh-oh!"). **No narration or
  read-aloud voice-over**; menus and the Kernelpedia rely on icons, pictures, and short text.
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
- **Data-driven content:** kernel types, damage types, the matchup chart, combos, enemies, biomes, and
  director curves live in JSON/TS config files so they can be balanced without code changes. Add a
  debug panel to tweak them live.
- **Cobs as kernel lists:** every cob (player or enemy) is a list of kernel counts by type. Damage,
  resistances, chomping, and drops all work on that one shared model, so player and enemy rules
  can't drift apart.
- **Floating origin:** every so often, shift the world back toward 0,0 so positions don't lose
  precision far from the start on the infinite map.
- **Input layer** turns touch, mouse, keyboard, and gamepad into one "move vector + power taps +
  target" command each tick. It must track several touches at once (joystick plus button taps).
- **Keep the door open for online multiplayer** (§9.3) without building it now:
  - The simulation only changes through **input commands**, never by reading the touch screen directly.
  - The simulation is **deterministic** (fixed timestep, seeded RNG, no wall-clock time or
    `Math.random()` inside game rules), so it could later be synced across devices or checked by a server.
  - The game state is plain data (cobs as kernel lists, ground kernels, chunks), so it can be
    snapshotted and sent over the network.
  - Don't assume there is exactly one player cob in the game rules.

### 14.3 Performance Budget

- **Targets:** 60 fps on **iPad (9th gen)** and **iPhone 12**. 120 fps where available is a bonus.
- **Entity caps (starting point, tune with profiling):** ~300 enemies, ~400 projectiles,
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
- Use **Pointer Events** and track multiple pointers (joystick + power buttons at the same time).
- Power buttons should respond on **pointer down**, not on release, so firing feels instant.

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

- **Free, with no accounts, no ads, no in-app purchases, no chat, no tracking.** Everything is saved
  on the device.
- Design to **COPPA**-friendly standards. Analytics, if any, are anonymous and opt-in through a
  parent setting.
- Any outside link (website, credits) sits behind a simple **parent gate** (e.g. "hold for 3 seconds"
  or a simple math question).
- **If online multiplayer is ever added**, it needs its own privacy review before launch: COPPA
  parental consent, what data a server stores (ideally nothing but a temporary room), and moderation
  rules (no chat, no custom names, only preset ones like "Speedy Cob").

---

## 15. Decisions and Open Questions

Decided so far:

- **Two kinds of kernels:** plain kernels (body/health, can't be fired, some durable or resistant)
  and power kernels (fired with buttons). (§4.1, §5)
- **No auto-fire.** One button per power type; the player chooses when to shoot. (§4.2)
- **Chomping is the main way to grow.** Shooting wears big cobs down until they can be chomped. (§4.6)
- **Fired kernels land on the ground** to be picked up again, and you can never fire your last
  (Heart) kernel. (§4.2)
- **Kernels knocked off by hits never disappear**; they stay on the ground until picked up. (§4.3)
- **You can chomp any cob with fewer kernels than you.** (§4.6)
- **Losing is "All Popped Out!"** with a gentle nap animation; no "shucked." (§4.4)
- **Color-coded loot** (enemies are worth what they're made of) and **green/red chomp outlines** stay.
- **3 to 5 power buttons:** start with 3, grow to a maximum of 5. (§4.2)
- **One shot per tap** for now; holding a button does nothing extra. (§4.2)
- **Sprout is a planted helper plant** that shoots on its own for a few seconds. (§5.2)
- **Smart Fire is an option for everyone**, and turned on automatically on Easy Peasy. (§11.1)
- **Art style is based on _How Many Dudes?_**, and a cob's appearance is built from its kernels. (§12)
- **Auto-target plus tap-to-lock** is the default; drag-to-aim is optional and off by default. (§4.2)
- **Enemies can pick up kernels you fired** on normal difficulty, but not on Easy Peasy. (§6.1, §7.3)
- **Size tiers only go up** during a run. (§4.5)
- **Designed around 10-year-olds**, so the full matchup chart and combos ship at launch. (§1)
- **10-minute Harvest Runs**, adjusted after playtesting. (§9.1)
- **Single-player at launch.** No couch co-op. Online multiplayer is a possible future feature. (§9.3)

- **No narration or read-aloud voice-over.** Short vocal sound effects only. (§13)
- **Free game:** no purchases and no ads. (§10.1)
- **No story wrapper for now.** The game is pure play; a story can be added later if wanted.
- **The name is _Corn Utopia_.**

To revisit after playtesting:

1. **Run length:** is 10 minutes right?
2. **Hold-to-repeat firing:** add it if kids' thumbs get tired from one tap per shot?
3. **Balance numbers:** shots needed to make a cob chompable, recharge times, magnet radius, Chomp
   Bonus size, and how many cobs resist your current powers.

---

## 16. Development Roadmap (Milestones)

Each milestone has a clear "done when" check. Scope grows only after the previous milestone is fun.

### M0 — Gray-Box Prototype (Find the Fun)
- Circles and squares only. Touch joystick, power buttons, target ring, chomp rule with green/red
  outlines, fired kernels landing as pickups, Heart Kernel minimum.
- 3 plain kernels (Sunny, Soggy, Stony), 3 power kernels (Zinger, Spicy, Popper), so the matchup idea
  can be tested from day one. 3 enemy types, a simple director, an infinite plain field.
- This is where to tune the most important numbers: how many shots it takes to make a cob chompable,
  button recharge times, shot range, magnet radius, and Chomp Bonus size. Those decide whether
  "wear it down, then chomp" feels fun or like a chore.
- PWA shell installed on a real iPad and iPhone from the very first build, to test two-thumb play.
- **Done when:** a kid plays 3 runs in a row without being asked to, and switches powers on their own
  when they hear a *tink!*

### M1 — Vertical Slice
- First real art pass in the *How Many Dudes?*-inspired style: the player cob, a few kernels with
  their look traits and flair, cutout bob-and-tilt animation, Baby Cobs, Sunny Farm biome.
- **Done-when check for art:** a kid can point at an enemy and guess which power to use from its looks alone.
- Full juice on fire/pop/scoop/chomp. Size tiers + camera zoom. Power Pockets. Ear Up! choices.
  All Popped Out + Last Chance.
- Audio unlock, music, core SFX. Offline play works.
- **[Decision] Frosty is in this slice** (icy shot, slows, third hit freezes) so four powers exist
  and a full set of starting pockets can leave one dimmed. Sprout, the helper plant, stays with the
  rest of the roster in M2. Toasty (freeze-immune) is still a later plain kernel, so Frosty's job
  for now is stopping a chaser, not winning a resist matchup.
- **Done when:** a 3-minute run on an iPhone 12 holds 60 fps and *feels* finished.

### M2 — Content Alpha
- All plain and power kernels, matchup chart, milestones, power combos. Full enemy roster, mini-bosses,
  Harvey, King Cob with his coat phases.
- 3 biomes, points of interest, events. Harvest Run 10-minute structure.
- Settings: difficulty, Smart Fire, controls (Follow My Finger, drag-to-aim, left-handed), reduce
  flashing/shake.
- **Done when:** a full run is winnable and the director feels balanced across power levels.

### M3 — Meta + Beta
- The Farm hub, Seeds, starting loadouts, Kernelpedia with matchup pictures, stickers, cosmetics.
- Onboarding, Add to Home Screen helper, update flow, save persistence.
- Remaining biomes, Endless mode, accessibility pass, performance tuning on older devices.
- **Done when:** playtesting with kids of the target age shows people coming back for more runs.

### M4 — Launch and Beyond
- Polish, bug-fixing, store-like landing page.
- Post-launch: Daily Seed, new biomes and kernels, seasonal events (Halloween candy corn!).
- Possible later: friends-only online multiplayer (§9.3), after a separate privacy review.

---

## 17. Playtesting Plan

- **Test with real kids early** (from M0). Watch, don't explain. Note where they get confused, where
  they laugh, and when they put the device down.
- Track locally (debug builds only): run length, what caused each All Popped Out, chomps per minute,
  shots per chomp, resisted (*tink!*) shots in a row before switching powers, share of fired kernels
  picked back up, which buttons get pressed, Ear Up! picks, average fps.
- Key questions:
  - Can kids steer and press power buttons at the same time on iPad? On iPhone?
  - Do they understand that shooting is for making a cob chompable, not the goal by itself?
  - Do they switch powers when a shot doesn't work, or keep pressing the same button?
  - Does spending kernels on shots feel fair, and do they go back to scoop them up?
  - Can a 10-year-old tell chompable cobs from dangerous ones, and guess the right power, without help?
    Can a younger sibling manage on Easy Peasy?
  - Does a 10-minute run feel too long, too short, or just right?
  - Do players actually go after specific kernel colors?
  - Is the screen readable during a Kernel Swarm on an iPhone?

---

## 18. Risks and Mitigations

| Risk                                                | Mitigation                                                                 |
|-----------------------------------------------------|----------------------------------------------------------------------------|
| **Two-thumb play is hard** for young kids           | Smart Fire (on by default in Easy Peasy), Follow My Finger, large spaced buttons, recharge rings that make mashing harmless, few pockets at the start |
| **Too many buttons** on iPhone                      | Power Pocket cap, waiting-power queue, swap arrow, two-row arc in portrait |
| **Matchups are confusing**                          | Color-coded cobs, shield badges, *tink!* sound + icon, onboarding step, Kernelpedia pictures, Smart Fire |
| **Wearing down big cobs feels like a chore**        | Tune shots-per-chomp in M0, director keeps most cobs as quick snacks, combos give big chunks, chomp meter shows progress |
| **Death spiral** (fewer kernels → weaker → more hits) | Kernels never disappear, Heart Kernel minimum, smoothed-power director, Chomp Bonus, Last Chance |
| **Visual clutter** on small screens (shots + piles of ground kernels) | Camera zoom-out, layer rules, flying vs. landed looks, same-type merging, auto-dim effects, projectile caps |
| **Performance** on older iPhones (many ground kernels) | ECS + pooling, kernel merging, off-screen chunk storage, entity caps, dynamic quality |
| **iOS PWA quirks** (audio, storage, install)        | Test on real devices from M0, Add to Home Screen helper, save export      |
| **Scope creep** (infinite map, many kernels)        | Data-driven content, milestone gates, start M0 with 3 plain + 3 power kernels |
| **Same-y runs**                                     | Matchups, power combos, biomes that favor different kernels, events, starting loadouts |

---

## 19. Glossary

- **Kernel:** a piece of a cob. Every kernel counts toward health and size.
- **Plain kernel:** a body kernel that can't be fired. Some are extra durable or resist a damage type.
- **Power kernel:** a kernel you fire with its power button.
- **Power button / Power Pocket:** the on-screen button for one power type. You have a limited number
  of pockets.
- **Damage type:** what kind of hit a shot is (Bonk, Fire, Freeze, Zap, Pop, Sticky).
- **Resistance:** a plain kernel ignoring a damage type (*tink!*).
- **Power combo:** a bonus effect from hitting a cob with one power and then another.
- **Target ring:** the marker showing which cob your shots will go to.
- **Cob:** you, or an enemy made of kernels. A cob's appearance is built from its kernels.
- **Look trait:** the overall appearance a cob takes on when it's mostly one plain kernel type
  (e.g. drippy and teal for Soggy).
- **Flair:** small visual extras from the power kernels a cob is holding (e.g. flames on the tassel for Spicy).
- **Socket:** a spot on your cob that holds one kernel. Empty sockets show missing health.
- **Heart Kernel:** your last kernel, which can never be fired.
- **Chomp:** eating a cob that has fewer kernels than you. The main way to grow.
- **Chomp Bonus / Chomp Streak:** the extra kernels you grow from chomping, and the boost for chomping
  several cobs quickly.
- **Ear Up!:** the level-up choice when you grow a size tier.
- **All Popped Out:** game over (hit while down to your Heart Kernel, and no kernel grabbed during Last Chance).
- **Bare Cob / Last Chance:** the short grace period after losing your Heart Kernel.
- **Smart Fire:** an assist mode with one Fire button that picks the best power for you.
- **Director:** the system that decides what enemies spawn.
- **Seeds:** the meta currency spent at the Farm.
- **Kernelpedia:** the in-game collection book.
