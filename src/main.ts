import './style.css'
import { Game } from './game/Game'
import { loadSettings } from './game/Settings'
import { Interface } from './ui/Interface'

const app = document.querySelector<HTMLElement>('#app')
if (!app) throw new Error('Missing application root')

const settings = loadSettings()
let game: Game
const ui = new Interface(app, settings, {
  onStart: () => game.setPaused(false),
  onPause: (paused) => game.setPaused(paused),
  onSettings: (nextSettings) => game.setSettings(nextSettings),
  onNewRoute: () => game.newRoute(),
})

game = new Game(app, settings, {
  getInput: () => ui.getInput(),
  onTelemetry: (telemetry) => ui.updateTelemetry(telemetry),
})
