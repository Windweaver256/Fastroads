export type Quality = 'smooth' | 'balanced' | 'cinematic'

export interface GameSettings {
  quality: Quality
  renderScale: number
  vegetation: number
  drawDistance: number
  shadows: boolean
  horsepower: number
  steering: number
  cruise: boolean
  timeOfDay: number
  haze: number
  cameraFov: number
}

const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

export const defaults: GameSettings = {
  quality: mobile ? 'smooth' : 'balanced',
  renderScale: mobile ? 0.75 : 1,
  vegetation: mobile ? 0.55 : 0.8,
  drawDistance: mobile ? 900 : 1280,
  shadows: !mobile,
  horsepower: 420,
  steering: 1,
  cruise: false,
  timeOfDay: 0.72,
  haze: 0.56,
  cameraFov: mobile ? 66 : 62,
}

export function loadSettings(): GameSettings {
  try {
    const saved = localStorage.getItem('fastroradss:settings')
    return saved ? { ...defaults, ...JSON.parse(saved) } : { ...defaults }
  } catch {
    return { ...defaults }
  }
}

export function saveSettings(settings: GameSettings): void {
  localStorage.setItem('fastroradss:settings', JSON.stringify(settings))
}

export function qualityDetail(quality: Quality): number {
  return quality === 'cinematic' ? 1 : quality === 'balanced' ? 0.68 : 0.42
}
