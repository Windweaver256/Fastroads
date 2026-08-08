import type { DriveInput } from '../game/Vehicle'
import { cameraViewLabels, cameraViewShortLabels, cameraViews, type CameraView, type GameSettings, qualityDetail, saveSettings } from '../game/Settings'
import type { Telemetry } from '../game/Game'

export interface InterfaceCallbacks {
  onStart: () => void
  onPause: (paused: boolean) => void
  onSettings: (settings: GameSettings) => void
  onNewRoute: () => number
}

const qualityLabel: Record<GameSettings['quality'], string> = {
  smooth: 'Smooth',
  balanced: 'Balanced',
  cinematic: 'Cinematic',
}

export class Interface {
  private readonly root: HTMLElement
  private readonly callbacks: InterfaceCallbacks
  private settings: GameSettings
  private readonly keys = new Set<string>()
  private touchInput = { steer: 0, throttle: 0, brake: 0 }
  private paused = true
  private telemetryElements: Record<'speed' | 'power', HTMLElement>

  constructor(root: HTMLElement, settings: GameSettings, callbacks: InterfaceCallbacks) {
    this.root = root
    this.settings = { ...settings }
    this.callbacks = callbacks
    this.root.innerHTML = this.template()
    this.telemetryElements = {
      speed: this.byId('speed'),
      power: this.byId('power-readout'),
    }
    this.bind()
    this.syncForm()
  }

  getInput(): DriveInput {
    const throttle = this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0
    const brake = this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0
    const steer = (this.keys.has('a') || this.keys.has('arrowleft') ? -1 : 0) + (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0)
    return {
      throttle: Math.max(throttle, this.touchInput.throttle),
      brake: Math.max(brake, this.touchInput.brake),
      steer: steer !== 0 ? steer : this.touchInput.steer,
    }
  }

  updateTelemetry(data: Telemetry): void {
    this.telemetryElements.speed.textContent = `${Math.round(data.speed)}`
  }

  setRouteSeed(seed: number): void {
    this.byId('seed').textContent = `Route ${seed}`
  }

  private template(): string {
    return `
      <main class="experience">
        <section class="hud top-hud">
          <div class="brand-block"><span class="brand-mark">F</span><span class="brand">FASTRORADSS</span></div>
          <div class="hud-actions">
            <button class="camera-button" id="camera-button" aria-label="Change camera view" title="Change camera view"><span>◉</span><small id="camera-label">CHASE</small></button>
            <button class="icon-button" id="pause-button" aria-label="Pause drive" title="Pause drive">Ⅱ</button>
            <button class="icon-button settings-button" id="open-settings" aria-label="Open settings" title="Settings">⚙</button>
          </div>
        </section>

        <section class="hud dashboard" aria-label="Drive telemetry">
          <div class="speed-cluster"><strong id="speed">0</strong><span>KM/H</span></div>
        </section>

        <section class="hud drive-tip"><span class="keyboard-tip">C</span><span>changes view</span></section>

        <section class="touch-controls" aria-label="Touch controls">
          <div class="touch-steer">
            <button class="touch-button" data-touch="left" aria-label="Steer left">◀</button>
            <button class="touch-button" data-touch="right" aria-label="Steer right">▶</button>
          </div>
          <div class="touch-pedals">
            <button class="touch-button brake" data-touch="brake" aria-label="Brake">—</button>
            <button class="touch-button throttle" data-touch="throttle" aria-label="Accelerate">▲</button>
          </div>
        </section>

        <section class="welcome" id="welcome">
          <div class="welcome-line"></div>
          <p class="eyebrow">A small place, without a finish line</p>
          <h1>Take the road<br /><em>until it changes you.</em></h1>
          <p class="welcome-copy">A new procedural route is waiting beyond the next bend. No traffic. No timer. Just a good car and enough horizon.</p>
          <button class="primary-button" id="begin"><span>Start driving</span><span>→</span></button>
          <p class="micro-copy">Headphones optional · works with keyboard or touch</p>
        </section>

        <aside class="settings-sheet" id="settings-sheet" aria-label="Game settings" aria-hidden="true">
          <div class="sheet-heading">
            <div><p class="eyebrow">Your journey, your tune</p><h2>Settings</h2></div>
            <button class="close-button" id="close-settings" aria-label="Close settings">×</button>
          </div>
          <div class="settings-scroll">
            <section class="setting-group setting-group-featured">
              <div class="setting-title"><span>Graphics mode</span><small>Target a stable frame time</small></div>
              <div class="quality-options" role="group" aria-label="Graphics mode">
                <button data-quality="smooth">Smooth <small>mobile-first</small></button>
                <button data-quality="balanced">Balanced <small>recommended</small></button>
                <button data-quality="cinematic">Cinematic <small>maximum detail</small></button>
              </div>
            </section>
            <section class="setting-group">
              <div class="setting-title"><span>Car character</span><small id="power-readout">420 hp · Touring</small></div>
              <label class="range-row" for="horsepower"><span>Horsepower</span><output id="horsepower-value"></output></label>
              <input id="horsepower" type="range" min="120" max="900" step="10" />
              <label class="range-row" for="steering"><span>Steering assist</span><output id="steering-value"></output></label>
              <input id="steering" type="range" min="0" max="1.4" step="0.1" />
              <label class="switch-row"><span><strong>Easy cruise</strong><small>Gently holds a relaxed pace</small></span><input id="cruise" type="checkbox" /><i></i></label>
            </section>
            <section class="setting-group">
              <div class="setting-title"><span>World &amp; camera</span><small>Build your atmosphere</small></div>
              <div class="camera-options" role="group" aria-label="Camera view">
                <button data-camera="chase">Chase</button><button data-camera="high">High</button><button data-camera="hood">Hood</button><button data-camera="cockpit">Cockpit</button><button data-camera="bumper">Bumper</button><button data-camera="side">Side</button><button data-camera="cinema">Cinema</button>
              </div>
              <label class="range-row" for="time"><span>Sun position</span><output id="time-value"></output></label>
              <input id="time" type="range" min="0.08" max="0.94" step="0.01" />
              <label class="range-row" for="haze"><span>Distance haze</span><output id="haze-value"></output></label>
              <input id="haze" type="range" min="0" max="1" step="0.05" />
              <label class="range-row" for="fov"><span>Camera field of view</span><output id="fov-value"></output></label>
              <input id="fov" type="range" min="55" max="78" step="1" />
            </section>
            <section class="setting-group">
              <div class="setting-title"><span>Fine graphics</span><small>Make it yours</small></div>
              <label class="range-row" for="render-scale"><span>Render scale</span><output id="render-scale-value"></output></label>
              <input id="render-scale" type="range" min="0.55" max="1.25" step="0.05" />
              <label class="range-row" for="vegetation"><span>Vegetation density</span><output id="vegetation-value"></output></label>
              <input id="vegetation" type="range" min="0.25" max="1" step="0.05" />
              <label class="range-row" for="distance"><span>View distance</span><output id="distance-value"></output></label>
              <input id="distance" type="range" min="700" max="1600" step="50" />
              <label class="switch-row"><span><strong>Soft shadows</strong><small>More depth, a little more GPU</small></span><input id="shadows" type="checkbox" /><i></i></label>
            </section>
          </div>
          <div class="route-actions"><button id="new-route" class="route-button">New route</button><span id="seed">Route —</span></div>
          <div class="sheet-foot">Settings save on this device <span>•</span> <span id="quality-readout">Balanced</span></div>
        </aside>
      </main>`
  }

  private bind(): void {
    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'c', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault()
      if (key === ' ') this.togglePause()
      else if (key === 'c') this.cycleCamera()
      else this.keys.add(key)
    })
    window.addEventListener('keyup', (event) => this.keys.delete(event.key.toLowerCase()))
    window.addEventListener('blur', () => this.keys.clear())
    this.byId('begin').addEventListener('click', () => {
      this.byId('welcome').classList.add('is-hidden')
      this.setPaused(false)
      this.callbacks.onStart()
    })
    this.byId('open-settings').addEventListener('click', () => this.openSettings(true))
    this.byId('close-settings').addEventListener('click', () => this.openSettings(false))
    this.byId('camera-button').addEventListener('click', () => this.cycleCamera())
    this.byId('pause-button').addEventListener('click', () => this.togglePause())
    this.byId('new-route').addEventListener('click', () => this.setRouteSeed(this.callbacks.onNewRoute()))
    this.root.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach((button) => {
      button.addEventListener('click', () => this.chooseQuality(button.dataset.quality as GameSettings['quality']))
    })
    this.root.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach((button) => {
      button.addEventListener('click', () => this.chooseCamera(button.dataset.camera as CameraView))
    })
    const inputIds = ['horsepower', 'steering', 'time', 'haze', 'fov', 'render-scale', 'vegetation', 'distance']
    inputIds.forEach((id) => {
      const input = this.byId<HTMLInputElement>(id)
      input.addEventListener('input', () => {
        this.pullForm()
        this.syncValueLabels()
        if (!['vegetation', 'distance'].includes(id)) this.commit()
      })
      input.addEventListener('change', () => this.commit())
    })
    ;['cruise', 'shadows'].forEach((id) => this.byId<HTMLInputElement>(id).addEventListener('change', () => {
      this.pullForm()
      this.commit()
    }))
    this.root.querySelectorAll<HTMLButtonElement>('[data-touch]').forEach((button) => this.bindTouchButton(button))
  }

  private bindTouchButton(button: HTMLButtonElement): void {
    const action = button.dataset.touch
    const set = (active: boolean) => {
      button.classList.toggle('is-pressed', active)
      if (action === 'left') this.touchInput.steer = active ? -1 : 0
      if (action === 'right') this.touchInput.steer = active ? 1 : 0
      if (action === 'throttle') this.touchInput.throttle = active ? 1 : 0
      if (action === 'brake') this.touchInput.brake = active ? 1 : 0
    }
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      button.setPointerCapture(event.pointerId)
      set(true)
    })
    button.addEventListener('pointerup', () => set(false))
    button.addEventListener('pointercancel', () => set(false))
    button.addEventListener('pointerleave', (event) => {
      if (event.buttons === 0) set(false)
    })
  }

  private chooseQuality(quality: GameSettings['quality']): void {
    this.settings.quality = quality
    const detail = qualityDetail(quality)
    this.settings.renderScale = quality === 'smooth' ? 0.72 : quality === 'balanced' ? 1 : 1.15
    this.settings.vegetation = 0.28 + detail * 0.72
    this.settings.drawDistance = quality === 'smooth' ? 850 : quality === 'balanced' ? 1250 : 1550
    this.settings.shadows = quality === 'cinematic'
    this.syncForm()
    this.commit()
  }

  private cycleCamera(): void {
    const currentIndex = cameraViews.indexOf(this.settings.cameraView)
    this.chooseCamera(cameraViews[(currentIndex + 1) % cameraViews.length])
  }

  private chooseCamera(view: CameraView): void {
    this.settings.cameraView = view
    this.syncCameraControls()
    this.commit()
  }

  private pullForm(): void {
    this.settings.horsepower = Number(this.byId<HTMLInputElement>('horsepower').value)
    this.settings.steering = Number(this.byId<HTMLInputElement>('steering').value)
    this.settings.cruise = this.byId<HTMLInputElement>('cruise').checked
    this.settings.timeOfDay = Number(this.byId<HTMLInputElement>('time').value)
    this.settings.haze = Number(this.byId<HTMLInputElement>('haze').value)
    this.settings.cameraFov = Number(this.byId<HTMLInputElement>('fov').value)
    this.settings.renderScale = Number(this.byId<HTMLInputElement>('render-scale').value)
    this.settings.vegetation = Number(this.byId<HTMLInputElement>('vegetation').value)
    this.settings.drawDistance = Number(this.byId<HTMLInputElement>('distance').value)
    this.settings.shadows = this.byId<HTMLInputElement>('shadows').checked
  }

  private syncForm(): void {
    this.byId<HTMLInputElement>('horsepower').value = String(this.settings.horsepower)
    this.byId<HTMLInputElement>('steering').value = String(this.settings.steering)
    this.byId<HTMLInputElement>('cruise').checked = this.settings.cruise
    this.byId<HTMLInputElement>('time').value = String(this.settings.timeOfDay)
    this.byId<HTMLInputElement>('haze').value = String(this.settings.haze)
    this.byId<HTMLInputElement>('fov').value = String(this.settings.cameraFov)
    this.byId<HTMLInputElement>('render-scale').value = String(this.settings.renderScale)
    this.byId<HTMLInputElement>('vegetation').value = String(this.settings.vegetation)
    this.byId<HTMLInputElement>('distance').value = String(this.settings.drawDistance)
    this.byId<HTMLInputElement>('shadows').checked = this.settings.shadows
    this.root.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach((button) => button.classList.toggle('is-selected', button.dataset.quality === this.settings.quality))
    this.syncCameraControls()
    this.syncValueLabels()
  }

  private syncCameraControls(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach((button) => {
      const view = button.dataset.camera as CameraView
      button.classList.toggle('is-selected', view === this.settings.cameraView)
      button.setAttribute('aria-label', cameraViewLabels[view])
    })
    this.byId('camera-label').textContent = cameraViewShortLabels[this.settings.cameraView]
  }

  private syncValueLabels(): void {
    this.byId('horsepower-value').textContent = `${this.settings.horsepower} hp`
    this.byId('steering-value').textContent = `${Math.round(this.settings.steering * 100)}%`
    this.byId('time-value').textContent = this.settings.timeOfDay > 0.68 ? 'golden hour' : this.settings.timeOfDay < 0.32 ? 'blue morning' : 'clear day'
    this.byId('haze-value').textContent = `${Math.round(this.settings.haze * 100)}%`
    this.byId('fov-value').textContent = `${this.settings.cameraFov}°`
    this.byId('render-scale-value').textContent = `${Math.round(this.settings.renderScale * 100)}%`
    this.byId('vegetation-value').textContent = `${Math.round(this.settings.vegetation * 100)}%`
    this.byId('distance-value').textContent = `${(this.settings.drawDistance / 1000).toFixed(2)} km`
    this.byId('quality-readout').textContent = qualityLabel[this.settings.quality]
    const mood = this.settings.horsepower < 300 ? 'Zen' : this.settings.horsepower < 560 ? 'Touring' : 'Sport'
    this.telemetryElements.power.textContent = `${this.settings.horsepower} hp · ${mood}`
  }

  private commit(): void {
    saveSettings(this.settings)
    this.callbacks.onSettings({ ...this.settings })
  }

  private togglePause(): void {
    this.setPaused(!this.paused)
  }

  private setPaused(paused: boolean): void {
    this.paused = paused
    this.byId('pause-button').textContent = paused ? '▶' : 'Ⅱ'
    this.byId('pause-button').setAttribute('aria-label', paused ? 'Resume drive' : 'Pause drive')
    this.root.classList.toggle('is-paused', paused)
    this.callbacks.onPause(paused)
  }

  private openSettings(open: boolean): void {
    const sheet = this.byId('settings-sheet')
    sheet.classList.toggle('is-open', open)
    sheet.setAttribute('aria-hidden', String(!open))
  }

  private byId<T extends HTMLElement = HTMLElement>(id: string): T {
    return this.root.querySelector<T>(`#${id}`) as T
  }
}
