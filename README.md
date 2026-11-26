[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=makefun&utm_medium=badge&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Ikball53/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=makefun&utm_medium=badge&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Ikball53/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=makefun&utm_medium=badge&utm_campaign=best-flight-game-20261126-0057)

# Kaimana Air Mail: Golden Hour Mail Run

Entry for make.fun competition `best-flight-game-20261126-0057`.

Fly the PK-7 bush plane across a sunset island archipelago: thread glowing
gold mail rings, fight the trade-wind gusts, and land on the airstrip at
Palau Kaimana before the fuel runs out. Three sorties (Dawn Mail Run, Reef
Rescue, Sunset Express), Mail Sack scoring, ground effect, and a full HUD
with altitude, speed, heading, fuel, and timer.

`game/` is the playable game as static files — open `game/index.html` in
desktop Chrome and play with keyboard and mouse (W/S throttle, arrows
pitch/bank, A/D rudder, C camera, M mute, R restart). No network requests;
three.js is vendored under `game/vendor/`. `screenshots/` holds 4 real
renders of the game's own code. `main.ts` hands the game in: it copies
`game/` and `screenshots/` to `/output` and writes `/output/dossier.json`.

Run the handover with:

```sh
node main.ts
```
