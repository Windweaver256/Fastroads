import * as THREE from 'three'
import { type DriveInput, Vehicle } from './Vehicle'
import { type GameSettings } from './Settings'
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
    this.camera = new THREE.PerspectiveCamera(settings.cameraFov, 1, 0.1, 1800)
    this.world = new World(this.scene, this.activeSeed, settings)
    this.scene.add(this.vehicle.object)
    this.vehicle.setTuning(settings.horsepower, settings.steering, settings.cruise)
    this.vehicle.reset(this.world.roadAt(0))
    this.world.update(0)
    this.world.updateAtmosphere(settings.timeOfDay, settings.haze)
    this.camera.position.set(0, 4.4, -9.2)
    this.camera.lookAt(0, 1.2, 18)
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
    this.settings = settings
    this.vehicle.setTuning(settings.horsepower, settings.steering, settings.cruise)
    this.world.setSettings(settings)
    this.world.updateAtmosphere(settings.timeOfDay, settings.haze)
    this.camera.fov = settings.cameraFov
    this.camera.updateProjectionMatrix()
    this.applyRendererSettings()
  }

  newRoute(): number {
    this.activeSeed = Math.floor(Math.random() * 900000) + 100000
    this.world.setSeed(this.activeSeed)
    this.vehicle.reset(this.world.roadAt(0))
    this.world.update(0)
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
    const sin = Math.sin(this.vehicle.object.rotation.y)
    const cos = Math.cos(this.vehicle.object.rotation.y)
    this.cameraPosition.set(this.vehicle.x - sin * 9.2, this.vehicle.y + 4.25, this.vehicle.z - cos * 9.2)
    this.camera.position.lerp(this.cameraPosition, 1 - Math.exp(-delta * 4.6))
    this.lookTarget.set(this.vehicle.x + sin * 21, this.vehicle.y + 1.4, this.vehicle.z + cos * 21)
    this.camera.lookAt(this.lookTarget)
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
}
