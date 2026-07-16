# GAME_MEMORY.md

Live architecture snapshot for Claude Code. Update at the end of every session where changes were made.

---

## Last Updated
Session: split single-file index.html into index.html + style.css + script.js, added font/aesthetic polish (Baloo 2 / Quicksand fonts, vignette overlay), added README.md for thesis project.

---

## File Structure

| File | Purpose |
|------|---------|
| `index.html` | Markup only — links `style.css` and `script.js` |
| `style.css` | All CSS (was previously the inline `<style>` block) |
| `script.js` | All JS (was previously the inline `<script>` block, incl. the `RescueGame` class) |
| `README.md` | Project overview for course/thesis submission |
| `angela.png` | Person sprite 1 (default) |
| `angela2.png` – `angela5.png` | Person sprites 2–5 (drop files here; randomly assigned per spawn) |
| `resan.png` | Present, used in `PERSON_IMGS` pool |
| `CLAUDE.md` | Claude Code instructions |
| `GAME_MEMORY.md` | This file |

No build system. Open `index.html` directly in a browser — it loads `style.css` and `script.js` via relative paths, so keep all three files in the same folder.

---

## JS Architecture

Single class `RescueGame`, instantiated as `const game = new RescueGame()` at the bottom of `<script>`.

### Core Loop
```
requestAnimationFrame → loop() → spawn() + moveObjects() + updateHUD()
```
- `spawn()` skips if `this.isPaused`, `!this.gameActive`, or `this.bossWaveActive`
- `moveObjects()` iterates `.kid`, `.debris`, `.powerup` elements; uses `getBoundingClientRect()` AABB collision

### Key State Variables
| Variable | Type | Purpose |
|----------|------|---------|
| `this.nets[]` | Array of net objects | All net stations |
| `this.day` | int | Current day (advances every 20s via `dayCycle()`) |
| `this.lives` | int | Player lives (starts 5) |
| `this.money` | int | In-game currency |
| `this.score` | int | Player score |
| `this.netTier` | 1–5 | Upgrade level |
| `this.cdMs` | ms | Retract cooldown duration (decreases with tier) |
| `this.deploySpd` | float | Net deploy speed multiplier |
| `this.scoreMult` | float | Score multiplier (1.5× at tier 4, 2× at tier 5) |
| `this.moneyMult` | int | Money multiplier per rescue (Levi cutie power-up) |
| `this.regenOn` | bool | Auto-regen active (tier 3+) |
| `this.weather` | string | `'clear'` \| `'storm'` \| `'night'` |
| `this.bossWaveActive` | bool | Boss wave in progress |
| `this.combo` | int | Consecutive catch counter |
| `this.chainCatch` | int | Chain for cinematic trigger (resets after 4s) |
| `this.goldenMode` | bool | ×5 score multiplier active (8s) |
| `this.speedBoost` | bool | Next deploy is 2.5× speed (one use) |
| `this.shield` | int | Shield charges |

### Net Object Shape
```js
{ st, netEl, shieldRing, active, health, xPct, netH, cooldownEnd, cooldownRaf, shielded }
```
- `active`: net is currently deployed
- `health`: 0–100; at 0 net shows "broken" CSS, can no longer catch kids, debris passes through freely
- `cooldownEnd`: timestamp; deploy blocked until `Date.now() >= cooldownEnd`
- `shielded`: next debris hit is blocked (from shield power-up)
- `netH`: pixel height the net extends — `window.innerHeight - 78 - 108` (no controls subtraction; station spans full viewport)

---

## Systems

### Net Stations
- `buildStations(count)` — tears down and rebuilds all stations
- Positions: 1 net = 50%, 2 nets = 25%/75%, 3+ evenly across 25–75%
- Net height formula: `window.innerHeight - 78 - 108` (top pillar=78px, bottom pillar=108px)
- **Important:** call `renderControls()` BEFORE `buildStations()` so controls panel has correct height for spawn clamping in `laneToY()`

### Spawn System
- Objects spawn at left=-70px, assigned a pixel Y via `laneToY(lane)`
- `laneToY()` clamps Y to `[78 + hudHeight, windowHeight - 108 - ctrlHeight - 42]` — guarantees no object spawns outside net range
- 380ms warning flash (`lane-warning` div) before object appears: green=kid, red=debris, yellow=powerup
- Lanes 2–9 (8 lanes); `occupiedLanes` Set prevents stacking

### Speed Scaling
- Kids: `1.1 + (day-1) × 0.27` px/frame
- Debris: `1.65 + (day-1) × 0.27` px/frame
- Storm multiplier: ×1.3 on top of base speed
- Boss wave objects use same formula

### Repair Rules
- Repair ($25) only works on **retracted** nets with health < 100
- Deployed broken nets (health=0) must be retracted first
- Net health=0 → broken CSS, cannot catch kids or be deployed, debris passes through

### Cooldown System
- After retract: `n.cooldownEnd = Date.now() + this.cdMs`
- Visual: cooldown overlay fills deploy button from bottom, countdown text shown
- `runCooldownAnim(i)` drives smooth rAF update per net

### Upgrade Tiers (`TIERS` array, index 0–3 = levels 2–5)
| Level | Cost | Nets | Cooldown | Deploy Speed | Regen | Score Mult |
|-------|------|------|----------|-------------|-------|-----------|
| 2 | $300 | 2 | 3.5s | 1.3× | ✗ | 1.0× |
| 3 | $650 | 3 | 2.5s | 1.6× | ✓ | 1.0× |
| 4 | $1200 | 4 | 1.8s | 2.0× | ✓ | 1.5× |
| 5 | $2200 | 5 | 0.9s | 2.5× | ✓ | 2.0× |

### Day Cycle
- Every 20s: `day++`, money += `30 + day×8`
- Every 5th day: Boss Wave triggered
- Uses are NOT refilled on day advance (removed use-limit system; cooldown is the only constraint)

### Boss Wave (`triggerBossWave()`)
- Triggered on day 5, 10, 15…
- Shows "⚠️ WAVE INCOMING" cinematic for 2.5s (descending alarm SFX)
- Normal spawning paused during wave (`bossWaveActive` flag)
- Wave: `4 + waveNum×2` kids + `2 + waveNum` debris, 500ms apart across 8 lanes
- Red progress bar under HUD fills as wave spawns
- End result cinematic: survived with no lives lost → +$150+ bonus; took hits → +$30 only

### Weather System
- Cycles: 25–40s clear → 15–25s storm or night → clear
- `setWeather('storm'|'night'|'clear')` — updates sky CSS class, overlays, stars
- Storm: rain streaks (`.raindrop` elements), lightning flash (`#lightning.flash`), ×1.3 speed mult, extra spawn rate
- Night: radial spotlight centered on nets (`--spot-x` CSS var), kids get `.glow` class, stars visible
- Weather badge shown in HUD during non-clear weather

### Power-Ups
Spawned via `spawnPowerup(lane)` from normal spawn loop (~1.8% chance) OR `scheduleHeartDrop()` for hearts.

| Type | Icon | Effect | Notes |
|------|------|--------|-------|
| `shield` | 🛡️ | Next debris hit blocked on catching net | Shield ring shown on net |
| `speedup` | ⚡ | Next deploy is 2.5× speed | Single use |
| `golden` | ⭐ | ×5 score per rescue for 8s | |
| `heart` | ❤️ | +1 life | Scheduled timer only (not random pool); starts 45s, min 18s |
| `clearsky` | 🌤️ | Clears storm/night immediately | Only appears during non-clear weather |
| `dayreset` | 🗓️ | Resets day timer + bonus money | From random pool |
| `levi` | text | ×2 money/rescue for 5s; easter egg cinematic | ~8% of powerup spawns; "Levi cutie" text, wobble animation |

### Combo & Chain
- `combo`: increments per catch, resets after 3s no catch or on life lost
- Score multiplier: `1 + floor(combo/3) × 0.1`
- `chainCatch`: increments per catch in same session, resets after 4s
- ≥3 chain triggers cinematic overlay: TRIPLE SAVE, QUAD SAVE, LEGENDARY, etc.

### Leaderboard
- `localStorage` key: `rescuenet_v4_lb`
- Per-name high score (updates if beaten, not duplicated)
- Top 20 stored, top 12 displayed

### Audio (Web Audio API only, no files)
- `startAudio()` called on first user interaction (browser autoplay policy)
- BGM: ukulele pluck arpeggios (1.5s interval) + marimba pentatonic melody (600ms) + filtered ocean noise + bubble pops
- SFX: catch (marimba ding), hit (sawtooth), lose (square), powerup (ascending marimba), thunder (noise burst), bossWarn (descending sawtooth alarm), bossWin (victory fanfare), heart (warm chord), levi (sparkle trill)
- `stopBGM()` clears all `bgmNodes` and intervals on game over/restart

### Cinematic Overlay (`#cinematicOverlay`)
- Used for: chain catches, boss wave result, Levi easter egg
- `showCinematic(chain, pts)` — shows for 1.6s then fades
- Boss wave and Levi use the same overlay with custom text

---

## Known Issues / Watch Points
- `buildStations()` must be called AFTER `renderControls()` so controls panel height is measured correctly for `laneToY()`
- `nRects` in `moveObjects()` is computed once per frame; retraction mid-frame won't update it until next frame (acceptable behavior)
- Person images `angela2.png`–`angela5.png` must be manually placed in the folder by the user
- `style.css` loads Google Fonts (Baloo 2, Quicksand) via `@import` — requires internet access; falls back to system fonts otherwise

---

## Assets Expected
```
angela.png    ← person 1
angela2.png   ← person 2 (user adds)
angela3.png   ← person 3 (user adds)
angela4.png   ← person 4 (user adds)
angela5.png   ← person 5 (user adds)
```
Debris has no image — pure CSS styling.
