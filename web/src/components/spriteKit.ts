// Shared drawing helpers for the two procedural sprites (PlantSprite and
// DecorSprite). Both draw from a CSV row and nothing else, so both need the
// same two things: a colour they can darken or lighten, and noise that is the
// same every render for the same cell.

/** Deterministic 0..1 noise — same cell, same drawing, every render. */
export function rng(seed: number): () => number {
  let s = (seed || 1) >>> 0
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

/** Mix a hex colour toward black (negative) or white (positive). */
export function shade(hex: string, amount: number): string {
  const v = hex.replace('#', '')
  const full = v.length === 3 ? v.split('').map(c => c + c).join('') : v
  const n = parseInt(full, 16)
  const to = amount < 0 ? 0 : 255
  const k = Math.abs(amount)
  const mix = (c: number) => Math.round(c + (to - c) * k)
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`
}
