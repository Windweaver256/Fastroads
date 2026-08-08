/** Tiny deterministic noise helpers. They keep every route reproducible from its seed. */
export function hash2(x: number, z: number, seed: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123
  return value - Math.floor(value)
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

export function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = smooth(x - ix)
  const fz = smooth(z - iz)
  const a = hash2(ix, iz, seed)
  const b = hash2(ix + 1, iz, seed)
  const c = hash2(ix, iz + 1, seed)
  const d = hash2(ix + 1, iz + 1, seed)
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz
}

export function fractalNoise(x: number, z: number, seed: number): number {
  let sum = 0
  let amplitude = 0.55
  let frequency = 1
  for (let octave = 0; octave < 4; octave += 1) {
    sum += (valueNoise(x * frequency, z * frequency, seed + octave * 31) * 2 - 1) * amplitude
    frequency *= 2.03
    amplitude *= 0.5
  }
  return sum
}
