import * as THREE from 'three'
import { type DriveInput, Vehicle } from './Vehicle'
import { type CameraView, type GameSettings } from './Settings'
import { World } from './World'

export interface GameCallbacks {
  getInput: () => DriveInput
  onTelemetry: (telemetry: Telemetry) => void
}

export interface Telemetry {
  speed: number
  distance: number
  fps: number
  biome: string
  offRoad: boolean
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly vehicle = new Vehicle()
  private world: World
  private settings: GameSettings
  private readonly callbacks: GameCallbacks
  private previous = performance.now()
  private frameAccumulator = 0
  private frameCount = 0
  private fps = 60
  private paused = true
  private running = true
  private cameraPosition = new THREE.Vector3()
  private lookTarget = new THREE.Vector3()
  private cameraElapsed = 0
  private snapCamera = true
  private activeSeed = Math.floor(Math.random() * 900000) + 100000

  constructor(host: HTMLElement, settings: GameSettings, callbacks: GameCallbacks) {
    this.settings = settings
    this.callbacks = callbacks
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.renderer.shadowMap.enabled = settings.shadows
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.className = 'game-canvas'
    host.append(this.renderer.domElement)
    this.camera = new THREE.PerspectiveCamera(settings.cameraFov, 1, 0.06, 2600)
    this.world = new World(this.scene, this.activeSeed, settings)
    this.scene.add(this.vehicle.object)
    this.vehicle.setTuning(settings.horsepower, settings.steering, settings.cruise)
    this.vehicle.reset(this.world.roadAt(0))
    this.world.update(0)
    this.world.updateAtmosphere(settings.timeOfDay, settings.haze)
    this.updateCamera(0, true)
    this.applyRendererSettings()
    window.addEventListener('resize', this.resize)
    this.resize()
    requestAnimationFrame(this.frame)
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    this.previous = performance.now()
  }

  setSettings(settings: GameSettings): void {
    const cameraChanged = settings.cameraView !== this.settings.cameraView
    this.settings = settings
    this.vehicle.setTuning(settings.horsepower, settings.steering, settings.cruise)
    this.world.setSettings(settings)
    this.world.update(this.vehicle.z)
    this.world.updateAtmosphere(settings.timeOfDay, settings.haze)
    this.camera.fov = settings.cameraFov
    this.camera.updateProjectionMatrix()
    if (cameraChanged) this.snapCamera = true
    this.applyRendererSettings()
  }

  newRoute(): number {
    this.activeSeed = Math.floor(Math.random() * 900000) + 100000
    this.world.setSeed(this.activeSeed)
    this.vehicle.reset(this.world.roadAt(0))
    this.world.update(0)
    this.snapCamera = true
    return this.activeSeed
  }

  dispose(): void {
    this.running = false
    window.removeEventListener('resize', this.resize)
    this.world.dispose()
    this.renderer.dispose()
  }

  private applyRendererSettings(): void {
    const pixelRatio = Math.min(window.devicePixelRatio, 2) * this.settings.renderScale
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.shadowMap.enabled = this.settings.shadows
  }

  private resize = (): void => {
    const width = window.innerWidth
    const height = window.innerHeight
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private frame = (now: number): void => {
    if (!this.running) return
    const delta = Math.min((now - this.previous) / 1000, 0.05)
    this.previous = now
    if (!this.paused) this.update(delta)
    this.renderer.render(this.scene, this.camera)
    requestAnimationFrame(this.frame)
  }

  private update(delta: number): void {
    const input = this.callbacks.getInput()
    const roadBefore = this.world.roadAt(this.vehicle.z)
    this.vehicle.update(delta, input, roadBefore, this.world.terrainHeight(this.vehicle.x, this.vehicle.z), this.world.roadWidth)
    this.world.update(this.vehicle.z)
    const road = this.world.roadAt(this.vehicle.z)
    this.cameraElapsed += delta
    this.updateCamera(delta)
    this.frameAccumulator += delta
    this.frameCount += 1
    if (this.frameAccumulator > 0.45) {
      this.fps = Math.round(this.frameCount / this.frameAccumulator)
      const names = ['Lupine Vale', 'Amber Ranges', 'Mosslight Basin', 'Sunward Reach']
      const biome = names[Math.abs(Math.floor(this.vehicle.z / 630 + this.activeSeed)) % names.length]
      this.callbacks.onTelemetry({
        speed: this.vehicle.speedKph,
        distance: this.vehicle.distanceKm,
        fps: this.fps,
        biome,
        offRoad: Math.abs(this.vehicle.x - road.x) > this.world.roadWidth * 0.72,
      })
      this.frameAccumulator = 0
      this.frameCount = 0
    }
  }

  private updateCamera(delta: number, immediate = false): void {
    const heading = this.vehicle.heading
    const forwardX = Math.sin(heading)
    const forwardZ = Math.cos(heading)
    const rightX = Math.cos(heading)
    const rightZ = -Math.sin(heading)
    const x = this.vehicle.x
    const y = this.vehicle.y
    const z = this.vehicle.z
    const place = (forward: number, right: number, height: number, targetForward: number, targetHeight: number): void => {
      this.cameraPosition.set(x + forwardX * forward + rightX * right, y + height, z + forwardZ * forward + rightZ * right)
      this.lookTarget.set(x + forwardX * targetForward, y + targetHeight, z + forwardZ * targetForward)
    }

    const view: CameraView = this.settings.cameraView
    switch (view) {
      case 'high':
        place(-18, 0, 8.8, 39, 1.8)
        break
      case 'hood':
        place(1.65, 0, 1.52, 34, 1.32)
        break
      case 'cockpit':
        place(0.12, 0, 1.5, 31, 1.5)
        break
      case 'bumper':
        place(2.16, 0, 0.92, 31, 0.95)
        break
      case 'side':
        place(-3.3, 8.2, 3.3, 14, 1.15)
        break
      case 'cinema': {
        const orbit = Math.sin(this.cameraElapsed * 0.22) * 6.2
        place(-13.5, orbit, 5.1 + Math.cos(this.cameraElapsed * 0.22) * 1.2, 25, 1.55)
        break
      }
      case 'chase':
      default:
        place(-9.2, 0, 4.25, 23, 1.4)
        break
    }
    this.vehicle.object.visible = view !== 'cockpit' && view !== 'bumper'
    if (immediate || this.snapCamera) {
      this.camera.position.copy(this.cameraPosition)
      this.snapCamera = false
    } else {
      const follow = view === 'cockpit' || view === 'bumper' || view === 'hood' ? 1 - Math.exp(-delta * 15) : 1 - Math.exp(-delta * 4.8)
      this.camera.position.lerp(this.cameraPosition, follow)
    }
    this.camera.lookAt(this.lookTarget)
  }
}
