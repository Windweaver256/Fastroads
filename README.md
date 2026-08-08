# Fastroradss

A zero-objective, procedural driving escape built with TypeScript and Three.js. It is designed around a small download, keyboard and touch controls, and graceful quality scaling.

## Run locally

```sh
npm install
npm run dev
```

## Deploy on Vercel

Import this folder as a Vercel project. Vercel detects Vite automatically; use `npm run build` and publish `dist`. The included `vercel.json` supports direct links if the project later gains routes.

## Controls

- Drive: `W` / `↑`, brake: `S` / `↓`, steer: `A` `D` / arrows
- Pause: `Space`
- On touch devices, hold the glass controls at the lower edge.

## Architecture

- `game/World.ts` streams deterministic road and terrain chunks around the driver.
- `game/Vehicle.ts` manages easy, forgiving arcade vehicle dynamics.
- `game/Game.ts` is the renderer/camera/update coordinator.
- `ui/Interface.ts` owns settings, touch input, and HUD bindings.

No textures or external models are downloaded: the road, vegetation, car, and terrain are geometry plus vertex color. The graphics panel applies its choices immediately and persists them in local storage.
