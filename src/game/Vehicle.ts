import * as THREE from 'three'
import type { RoadSample } from './World'

export interface DriveInput {
  throttle: number
  brake: number
  steer: number
}

/** Forgiving arcade dynamics: a little inertia, no fragile simulation, and clear off-road feedback. */
export class Vehicle {
  readonly object = new THREE.Group()
  private readonly visual = new THREE.Group()
  private readonly wheels: THREE.Mesh[] = []
  private horsepower = 420
  private steeringAssist = 1
  private velocity = 0
  private yaw = 0
  private steerAngle = 0
  private lateralLean = 0
  private cruise = false
  private odometer = 0

  x = 0
  y = 0
  z = 0

  constructor() {
    this.buildModel()
  }

  get speedKph(): number {
    return Math.max(0, this.velocity * 3.6)
  }

  get distanceKm(): number {
    return this.odometer / 1000
  }

  /** Heading in world space; it is deliberately independent of suspension/visual lean. */
  get heading(): number {
    return this.yaw
  }

  setTuning(horsepower: number, steeringAssist: number, cruise: boolean): void {
    this.horsepower = horsepower
    this.steeringAssist = steeringAssist
    this.cruise = cruise
  }

  reset(road: RoadSample): void {
    this.x = road.x
    this.y = road.y
    this.z = 0
    this.yaw = Math.atan2(road.directionX, road.directionZ)
    this.velocity = 0
    this.odometer = 0
    this.object.position.set(this.x, this.y + 0.42, this.z)
    this.object.rotation.set(0, this.yaw, 0)
    this.visual.rotation.set(0, 0, 0)
  }

  update(delta: number, input: DriveInput, road: RoadSample, terrainY: number, roadWidth: number): void {
    const onRoad = Math.abs(this.x - road.x) < roadWidth * 0.72
    const maxSpeed = 42 + this.horsepower * 0.092
    const automaticThrottle = this.cruise && input.brake < 0.1 && this.velocity < maxSpeed * 0.54 ? 0.44 : 0
    const throttle = Math.max(input.throttle, automaticThrottle)
    const driveForce = (this.horsepower / 510) * 12.2 * throttle * (1 - Math.min(this.velocity / maxSpeed, 0.94) * 0.55)
    const braking = input.brake * 31
    const rolling = onRoad ? 0.35 + this.velocity * this.velocity * 0.0043 : 3.5 + this.velocity * this.velocity * 0.014
    this.velocity += (driveForce - braking - rolling) * delta
    if (this.velocity < 0) this.velocity = 0
    this.velocity = Math.min(this.velocity, maxSpeed)

    const desiredSteer = input.steer * (0.42 + this.steeringAssist * 0.34)
    this.steerAngle = THREE.MathUtils.damp(this.steerAngle, desiredSteer, 9, delta)
    const steeringStrength = (0.018 + this.steeringAssist * 0.012) * THREE.MathUtils.clamp(1 - this.velocity / 120, 0.32, 1)
    // The follow camera faces forward from behind the car. In that view, world X is
    // mirrored on screen, so steering must rotate opposite to the raw screen axis.
    // This keeps A/← and the left touch button reliably turning toward screen-left.
    this.yaw -= this.steerAngle * this.velocity * steeringStrength * delta

    const forwardX = Math.sin(this.yaw)
    const forwardZ = Math.cos(this.yaw)
    this.x += forwardX * this.velocity * delta
    this.z += forwardZ * this.velocity * delta
    this.odometer += this.velocity * delta

    const roadYaw = Math.atan2(road.directionX, road.directionZ)
    if (onRoad && Math.abs(input.steer) < 0.12) {
      this.yaw = THREE.MathUtils.damp(this.yaw, roadYaw, 0.7 + this.steeringAssist * 1.2, delta)
    }
    this.lateralLean = THREE.MathUtils.damp(this.lateralLean, -this.steerAngle * Math.min(this.velocity * 0.027, 0.24), 6, delta)
    this.y = THREE.MathUtils.damp(this.y, onRoad ? road.y : terrainY, 8, delta)
    this.object.position.set(this.x, this.y + 0.46, this.z)
    this.object.rotation.set(0, this.yaw, 0)
    this.visual.rotation.set(0, 0, this.lateralLean)
    for (const wheel of this.wheels) wheel.rotation.x -= this.velocity * delta / 0.36
  }

  private buildModel(): void {
    const paint = new THREE.MeshStandardMaterial({ color: 0xd15d37, roughness: 0.3, metalness: 0.42 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x111918, roughness: 0.72, metalness: 0.15 })
    const glass = new THREE.MeshStandardMaterial({ color: 0x91bdc2, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.72 })
    const chrome = new THREE.MeshStandardMaterial({ color: 0xe9d9ba, roughness: 0.18, metalness: 0.85 })
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.48, 4.18), paint)
    body.position.y = 0.48
    body.castShadow = true
    this.visual.add(body)
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.24, 1.25), paint)
    hood.position.set(0, 0.73, 1.18)
    hood.castShadow = true
    this.visual.add(hood)
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.65, 1.8), glass)
    cabin.position.set(0, 1.03, -0.36)
    cabin.castShadow = true
    this.visual.add(cabin)
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.16, 0.08), dark)
    grille.position.set(0, 0.47, 2.13)
    this.visual.add(grille)
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.07), chrome)
      lamp.position.set(side * 0.58, 0.71, 2.12)
      this.visual.add(lamp)
      for (const front of [-1.35, 1.3]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.23, 12), dark)
        wheel.position.set(side * 0.98, 0.37, front)
        wheel.rotation.z = Math.PI / 2
        wheel.castShadow = true
        this.wheels.push(wheel)
        this.visual.add(wheel)
      }
    }
    this.object.add(this.visual)
    this.object.name = 'solstice-car'
  }
}
