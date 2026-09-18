// Lightweight feedback: short synthesized tones via Web Audio plus device
// haptics. No audio assets needed — every sound is generated on the fly, which
// keeps the offline bundle small.

let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) {
    try {
      ctx = new AC()
    } catch {
      return null
    }
  }
  // Browsers start the context suspended until a user gesture resumes it.
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  return ctx
}

/**
 * A soft watering blip for one tend. `pitch` lets a fertilized tend sound
 * brighter. Safe to call rapidly — each tend is its own short voice.
 */
export function playTendSound(pitch = 1): void {
  const audio = getContext()
  if (!audio) return

  const now = audio.currentTime
  const osc = audio.createOscillator()
  const gain = audio.createGain()

  osc.type = 'sine'
  // A short upward drip rather than a hard click — this is a watering can.
  osc.frequency.setValueAtTime(380 * pitch, now)
  osc.frequency.exponentialRampToValueAtTime(620 * pitch, now + 0.07)

  // Fast attack, short decay so quick steps stay crisp and don't muddy.
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.11, now + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11)

  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(now)
  osc.stop(now + 0.12)
}

/** A three-note chime when a plant reaches full bloom — the one moment in the
 *  loop worth stopping for. */
export function playBloomSound(): void {
  const audio = getContext()
  if (!audio) return
  const start = audio.currentTime
  ;[523.25, 659.25, 783.99].forEach((freq, i) => {
    const at = start + i * 0.09
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, at)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.14, at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.26)
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start(at)
    osc.stop(at + 0.28)
  })
}

/** Trigger a brief device vibration when haptics are supported. */
export function haptic(durationMs = 12): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(durationMs)
    } catch {
      // Ignore — vibration is best-effort.
    }
  }
}
