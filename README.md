# Rescue Net 🌊

A browser-based arcade survival game built for a Game Development midterm project. Players manage a set of rescue nets along a river, deploying and retracting them to catch drifting people while avoiding damaging debris, riding out escalating "boss waves," and reacting to a dynamic day/weather cycle.

## Gameplay

- Deploy nets at fixed stations to catch people (`kid` sprites) floating downstream — each catch scores points and earns money.
- Debris damages whichever net is deployed when it passes through; a net at 0 health must be retracted and repaired before it can be used again.
- Money earned from rescues and the day-cycle bonus can be spent on **net upgrades** (more stations, faster cooldowns, auto-regeneration, score multipliers) and **repairs**.
- Random power-ups (shield, speed boost, golden score multiplier, extra life, weather clear, day-timer reset, and a rare "Levi cutie" money multiplier easter egg) spawn alongside the normal rescue objects.
- Every 5th day triggers a **boss wave**: a dense, timed surge of people and debris across all lanes, capped off with a cinematic pass/fail result.
- Weather cycles between clear, storm, and night conditions, each changing visuals, spawn rates, and object speed.
- Scores are saved to a local leaderboard (`localStorage`) per player name.

Controls: click a net's Deploy/Retract button, or press number keys `1`–`5` to toggle the corresponding net. Press `P` to pause.

## Project Structure

| File | Purpose |
|---|---|
| `index.html` | Page markup only — links `style.css` and `script.js` |
| `style.css` | All visual styling: sky/water backdrop, HUD, stations, power-ups, overlays, animations |
| `script.js` | Game logic: the `RescueGame` class, spawn/collision system, upgrades, weather, boss waves, audio synthesis, leaderboard |
| `GAME_MEMORY.md` | Living architecture reference for ongoing development (state variables, systems, known issues) |
| `*.png` | Person sprites randomly assigned to rescue targets |

The game was originally a single self-contained `index.html` file; it has since been separated into HTML/CSS/JS for clarity and to reflect standard front-end project structure. There is no build step or external dependency — open `index.html` directly in any modern browser.

## Tech Notes

- Pure vanilla JavaScript (ES6 class-based), no frameworks or libraries.
- All audio (background music and sound effects) is synthesized at runtime via the Web Audio API — no audio files are loaded.
- Collision detection uses `getBoundingClientRect()` AABB checks against actively-deployed net elements each animation frame.
- Persistence (leaderboard) uses `localStorage`, keyed per browser/device.

## Why This Project

This game was built as a midterm project for a Game Development course and doubles as an early testbed for interaction and feedback-loop ideas (risk/reward pacing, escalating difficulty, resource management under time pressure) relevant to a planned thesis on game design. See `GAME_MEMORY.md` for the current, detailed system-by-system architecture.

## Running It

No install required:

1. Clone or download this folder.
2. Open `index.html` in a browser (double-click, or right-click → Open With).

That's it — the game runs entirely client-side.
