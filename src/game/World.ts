import * as THREE from 'three'
import { fractalNoise, hash2 } from './Noise'
import { qualityDetail, type GameSettings } from './Settings'

const CHUNK_LENGTH = 160
const TERRAIN_HALF_WIDTH = 210
const ROAD_WIDTH = 9.5

export interface RoadSample {
  x: number
  y: number
  directionX: number
  directionZ: number
}

interface WorldChunk {
  group: THREE.Group
  dispose: () => void
}

/**
 * A deterministic, forward-only streamed landscape. Terrain, route, paint and plants
 * are generated independently per chunk, then discarded when they move behind the car.
 */
export class World {
  readonly scene: THREE.Scene
  private readonly chunks = new Map<number, WorldChunk>()
  private seed: number
  private settings: GameSettings
  private terrainMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  private roadMaterial = new THREE.MeshStandardMaterial({ color: 0x27302d, roughness: 0.92, metalness: 0 })
  private paintMaterial = new THREE.MeshBasicMaterial({ color: 0xf7e9cb })
  private trunkGeometry = new THREE.CylinderGeometry(0.16, 0.28, 2.1, 5)
  private canopyGeometry = new THREE.ConeGeometry(1.25, 4.7, 7)
  private rockGeometry = new THREE.DodecahedronGeometry(1, 0)
  private trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x4b3526, flatShading: true })
  private canopyMaterial = new THREE.MeshLambertMaterial({ color: 0x294e36, flatShading: true })
  private rockMaterial = new THREE.MeshLambertMaterial({ color: 0x6d756a, flatShading: true })
  private sun: THREE.DirectionalLight
  private fill: THREE.HemisphereLight

  constructor(scene: THREE.Scene, seed: number, settings: GameSettings) {
    this.scene = scene
    this.seed = seed
    this.settings = settings
    this.fill = new THREE.HemisphereLight(0x9bc3e2, 0x293d2d, 2.05)
    this.sun = new THREE.DirectionalLight(0xffdeb2, 3.1)
    this.sun.position.set(-220, 260, 90)
    this.sun.castShadow = settings.shadows
    this.sun.shadow.mapSize.set(1024, 1024)
    this.sun.shadow.camera.left = -105
    this.sun.shadow.camera.right = 105
    this.sun.shadow.camera.top = 105
    this.sun.shadow.camera.bottom = -105
    this.scene.add(this.fill, this.sun)
  }

  get roadWidth(): number {
    return ROAD_WIDTH
  }

  setSettings(settings: GameSettings): void {
    const needsRebuild = settings.quality !== this.settings.quality || settings.vegetation !== this.settings.vegetation
    this.settings = settings
    this.sun.castShadow = settings.shadows
    if (needsRebuild) this.clearChunks()
  }

  setSeed(seed: number): void {
    this.seed = seed
    this.clearChunks()
  }

  update(playerZ: number): void {
    const rear = Math.floor((playerZ - 300) / CHUNK_LENGTH)
    const forward = Math.ceil((playerZ + this.settings.drawDistance) / CHUNK_LENGTH)
    for (let index = rear; index <= forward; index += 1) {
      if (!this.chunks.has(index)) this.chunks.set(index, this.createChunk(index))
    }
    for (const [index, chunk] of this.chunks) {
      if (index < rear || index > forward) {
        this.scene.remove(chunk.group)
        chunk.dispose()
        this.chunks.delete(index)
      }
    }
  }

  roadAt(z: number): RoadSample {
    const x = Math.sin(z * 0.0022 + this.seed * 0.11) * 33 + Math.sin(z * 0.0067 + this.seed) * 12
    const dx = Math.cos(z * 0.0022 + this.seed * 0.11) * 0.0726 + Math.cos(z * 0.0067 + this.seed) * 0.0804
    const length = Math.hypot(dx, 1)
    return { x, y: this.roadHeight(z), directionX: dx / length, directionZ: 1 / length }
  }

  terrainHeight(x: number, z: number): number {
    const road = this.roadAt(z)
    const raw = fractalNoise(x * 0.012, z * 0.012, this.seed) * 17 + fractalNoise(x * 0.045, z * 0.045, this.seed + 19) * 3
    const distance = Math.abs(x - road.x)
    const blend = THREE.MathUtils.smoothstep(distance, ROAD_WIDTH * 0.7, 35)
    return THREE.MathUtils.lerp(road.y - 0.18, raw, blend)
  }

  updateAtmosphere(time: number, haze: number): void {
    const angle = THREE.MathUtils.lerp(0.12, 2.75, time)
    const warmth = Math.max(0, 1 - Math.abs(time - 0.72) * 2.4)
    const sky = new THREE.Color().setHSL(0.55 - warmth * 0.07, 0.42, 0.36 + Math.sin(angle) * 0.16)
    this.scene.background = sky
    this.scene.fog = new THREE.Fog(sky, 180, THREE.MathUtils.lerp(560, 1150, 1 - haze))
    this.sun.color.setHSL(0.1 - warmth * 0.07, 0.78, 0.67)
    this.sun.intensity = THREE.MathUtils.lerp(1.1, 3.4, Math.max(0.14, Math.sin(angle)))
    this.sun.position.set(Math.cos(angle) * 330, Math.max(25, Math.sin(angle) * 310), 120)
    this.fill.intensity = THREE.MathUtils.lerp(1.05, 2.35, Math.max(0.1, Math.sin(angle)))
  }

  dispose(): void {
    this.clearChunks()
    this.scene.remove(this.fill, this.sun)
  }

  private roadHeight(z: number): number {
    return Math.sin(z * 0.009 + this.seed) * 2.7 + Math.sin(z * 0.022 + this.seed * 3) * 0.7
  }

  private clearChunks(): void {
    for (const chunk of this.chunks.values()) {
      this.scene.remove(chunk.group)
      chunk.dispose()
    }
    this.chunks.clear()
  }

  private createChunk(index: number): WorldChunk {
    const group = new THREE.Group()
    group.name = `landscape-${index}`
    const zStart = index * CHUNK_LENGTH
    const detail = qualityDetail(this.settings.quality)
    const terrain = this.createTerrain(zStart, Math.round(12 + detail * 18))
    const road = this.createRoad(zStart, Math.round(18 + detail * 20))
    const vegetation = this.createVegetation(index, zStart, Math.round((14 + detail * 48) * this.settings.vegetation))
    group.add(terrain, road, vegetation)
    this.scene.add(group)
    return {
      group,
      dispose: () => {
        terrain.geometry.dispose()
        road.children.forEach((child) => {
          const mesh = child as THREE.Mesh
          mesh.geometry?.dispose()
        })
      },
    }
  }

  private createTerrain(zStart: number, segments: number): THREE.Mesh {
    const columns = segments * 2
    const vertices: number[] = []
    const colors: number[] = []
    const indices: number[] = []
    const color = new THREE.Color()
    for (let zIndex = 0; zIndex <= segments; zIndex += 1) {
      const z = zStart + (zIndex / segments) * CHUNK_LENGTH
      for (let xIndex = 0; xIndex <= columns; xIndex += 1) {
        const x = -TERRAIN_HALF_WIDTH + (xIndex / columns) * TERRAIN_HALF_WIDTH * 2
        const y = this.terrainHeight(x, z)
        vertices.push(x, y, z)
        const variation = fractalNoise(x * 0.08, z * 0.08, this.seed + 8)
        const dry = THREE.MathUtils.clamp(0.52 + variation * 0.18 + Math.abs(x) / 1800, 0.28, 0.8)
        color.setHSL(0.26 - dry * 0.055, 0.28 + dry * 0.24, 0.22 + dry * 0.16)
        colors.push(color.r, color.g, color.b)
      }
    }
    const stride = columns + 1
    for (let zIndex = 0; zIndex < segments; zIndex += 1) {
      for (let xIndex = 0; xIndex < columns; xIndex += 1) {
        const a = zIndex * stride + xIndex
        indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    const mesh = new THREE.Mesh(geometry, this.terrainMaterial)
    mesh.receiveShadow = this.settings.shadows
    return mesh
  }

  private createRoad(zStart: number, segments: number): THREE.Group {
    const group = new THREE.Group()
    const vertices: number[] = []
    const indices: number[] = []
    for (let index = 0; index <= segments; index += 1) {
      const z = zStart + (index / segments) * CHUNK_LENGTH
      const road = this.roadAt(z)
      const sideX = road.directionZ
      const sideZ = -road.directionX
      vertices.push(road.x - sideX * ROAD_WIDTH * 0.5, road.y + 0.045, z - sideZ * ROAD_WIDTH * 0.5)
      vertices.push(road.x + sideX * ROAD_WIDTH * 0.5, road.y + 0.045, z + sideZ * ROAD_WIDTH * 0.5)
    }
    for (let index = 0; index < segments; index += 1) {
      const a = index * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    const asphalt = new THREE.Mesh(geometry, this.roadMaterial)
    asphalt.receiveShadow = this.settings.shadows
    group.add(asphalt)

    for (let z = zStart + 9; z < zStart + CHUNK_LENGTH; z += 14) {
      const road = this.roadAt(z)
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 5.1), this.paintMaterial)
      dash.position.set(road.x, road.y + 0.075, z)
      dash.rotation.y = Math.atan2(road.directionX, road.directionZ)
      group.add(dash)
    }
    return group
  }

  private createVegetation(chunkIndex: number, zStart: number, count: number): THREE.Group {
    const group = new THREE.Group()
    const trunks = new THREE.InstancedMesh(this.trunkGeometry, this.trunkMaterial, count)
    const crowns = new THREE.InstancedMesh(this.canopyGeometry, this.canopyMaterial, count)
    const rocks = new THREE.InstancedMesh(this.rockGeometry, this.rockMaterial, Math.max(3, Math.floor(count / 5)))
    const dummy = new THREE.Object3D()
    const leafColor = new THREE.Color()
    let made = 0
    let attempts = 0
    while (made < count && attempts < count * 4) {
      attempts += 1
      const randomA = hash2(chunkIndex * 41 + attempts, 1, this.seed)
      const randomB = hash2(chunkIndex * 41 + attempts, 2, this.seed)
      const side = hash2(chunkIndex * 41 + attempts, 3, this.seed) > 0.5 ? 1 : -1
      const z = zStart + randomA * CHUNK_LENGTH
      const road = this.roadAt(z)
      const x = road.x + side * (17 + randomB * (TERRAIN_HALF_WIDTH - 30))
      const scale = 0.55 + hash2(chunkIndex * 11 + attempts, 4, this.seed) * 0.9
      dummy.position.set(x, this.terrainHeight(x, z) + scale, z)
      dummy.rotation.set(0, hash2(chunkIndex * 17 + attempts, 5, this.seed) * Math.PI, 0)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      trunks.setMatrixAt(made, dummy.matrix)
      dummy.position.y += 2.25 * scale
      dummy.updateMatrix()
      crowns.setMatrixAt(made, dummy.matrix)
      leafColor.setHSL(0.29 + hash2(chunkIndex * 13 + attempts, 6, this.seed) * 0.08, 0.37, 0.23 + scale * 0.06)
      crowns.setColorAt(made, leafColor)
      made += 1
    }
    trunks.count = made
    crowns.count = made
    trunks.instanceMatrix.needsUpdate = true
    crowns.instanceMatrix.needsUpdate = true
    crowns.instanceColor!.needsUpdate = true
    trunks.castShadow = this.settings.shadows
    crowns.castShadow = this.settings.shadows
    group.add(trunks, crowns)

    for (let index = 0; index < rocks.count; index += 1) {
      const z = zStart + hash2(chunkIndex * 73 + index, 11, this.seed) * CHUNK_LENGTH
      const road = this.roadAt(z)
      const x = road.x + (hash2(chunkIndex * 73 + index, 12, this.seed) > 0.5 ? 1 : -1) * (13 + hash2(chunkIndex * 73 + index, 13, this.seed) * 95)
      const scale = 0.3 + hash2(chunkIndex * 73 + index, 14, this.seed) * 1.4
      dummy.position.set(x, this.terrainHeight(x, z) + scale * 0.45, z)
      dummy.rotation.set(hash2(index, 8, this.seed), hash2(index, 9, this.seed), hash2(index, 10, this.seed))
      dummy.scale.set(scale, scale * 0.7, scale)
      dummy.updateMatrix()
      rocks.setMatrixAt(index, dummy.matrix)
    }
    rocks.instanceMatrix.needsUpdate = true
    group.add(rocks)
    return group
  }
}
