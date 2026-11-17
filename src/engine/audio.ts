/**
 * Web Audio mixer with music and SFX buses. Browsers only allow audio after a user gesture, so
 * call `unlock()` from the first click/key press (the title screen does this).
 *
 * The starter ships no audio files: SFX are synthesized and the music is a generative ambient
 * pad. To use recorded assets, `load(url)` an AudioBuffer and `playBuffer()` it on either bus.
 */
export type Sfx = 'bump' | 'fall' | 'count' | 'go' | 'join' | 'ui' | 'win' | 'lose' | 'shot' | 'click' | 'rack' | 'load' | 'item' | 'heal' | 'rope' | 'crackle' | 'hit'

export class Audio {
  readonly ctx: AudioContext
  private master: GainNode
  private music: GainNode
  private sfx: GainNode
  private musicTimer = 0
  private musicOn = false
  private buffers = new Map<string, AudioBuffer>()

  constructor() {
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.music = this.ctx.createGain()
    this.sfx = this.ctx.createGain()
    this.music.connect(this.master)
    this.sfx.connect(this.master)
    this.master.connect(this.ctx.destination)
  }

  unlock(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  /** Volumes in 0..1. */
  setVolumes(music: number, sfx: number, muted = false): void {
    const t = this.ctx.currentTime
    this.music.gain.setTargetAtTime(muted ? 0 : music * 0.55, t, 0.05)
    this.sfx.gain.setTargetAtTime(muted ? 0 : sfx * 0.8, t, 0.05)
  }

  async load(url: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(url)
    if (cached) return cached
    const data = await (await fetch(url)).arrayBuffer()
    const buffer = await this.ctx.decodeAudioData(data)
    this.buffers.set(url, buffer)
    return buffer
  }

  playBuffer(buffer: AudioBuffer, bus: 'music' | 'sfx' = 'sfx', loop = false): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.loop = loop
    src.connect(bus === 'music' ? this.music : this.sfx)
    src.start()
    return src
  }

  play(name: Sfx): void {
    if (this.ctx.state !== 'running') return
    const t = this.ctx.currentTime
    const tone = (freq: number, end: number, dur: number, type: OscillatorType, vol: number, delay = 0) => {
      const o = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      o.type = type
      o.frequency.setValueAtTime(freq, t + delay)
      o.frequency.exponentialRampToValueAtTime(Math.max(end, 20), t + delay + dur)
      g.gain.setValueAtTime(0.0001, t + delay)
      g.gain.exponentialRampToValueAtTime(vol, t + delay + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur)
      o.connect(g).connect(this.sfx)
      o.start(t + delay)
      o.stop(t + delay + dur + 0.05)
    }
    // Filtered white noise with a fast decay: gunshots, clicks, cloth, fire.
    const noise = (dur: number, vol: number, delay = 0, freq = 2000, type: BiquadFilterType = 'lowpass', curve = 2.5) => {
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur))
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, curve)
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      const f = this.ctx.createBiquadFilter()
      f.type = type
      f.frequency.setValueAtTime(freq, t + delay)
      if (type === 'lowpass') f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * .12), t + delay + dur)
      const g = this.ctx.createGain()
      g.gain.value = vol
      src.connect(f).connect(g).connect(this.sfx)
      src.start(t + delay)
    }
    switch (name) {
      case 'shot': noise(.04, 1.4, 0, 9000, 'highpass', 1); noise(1.1, 1.3, 0, 2600); tone(110, 38, .5, 'sine', .9); noise(.6, .25, .12, 700); break
      case 'click': noise(.025, .5, 0, 4500, 'bandpass', 3); tone(2400, 1900, .03, 'square', .08); noise(.02, .3, .07, 3000, 'bandpass', 3); break
      case 'rack': noise(.05, .55, 0, 2200, 'bandpass', 2); noise(.03, .4, .05, 4000, 'bandpass', 3); noise(.06, .6, .2, 1800, 'bandpass', 2); noise(.03, .5, .26, 3500, 'bandpass', 3); break
      case 'load': for (let i = 0; i < 4; i++) noise(.035, .4, i * .14, 3200, 'bandpass', 3); noise(.06, .5, .62, 1800, 'bandpass', 2); break
      case 'item': noise(.08, .25, 0, 1500, 'bandpass', 2); tone(740, 980, .1, 'triangle', .12, .05); break
      case 'heal': noise(.3, .15, 0, 900, 'lowpass', 1); tone(520, 780, .25, 'sine', .14, .1); break
      case 'rope': noise(.18, .35, 0, 1200, 'bandpass', 1.5); noise(.12, .3, .2, 900, 'bandpass', 1.5); break
      case 'hit': tone(160, 60, .3, 'sine', .5); noise(.15, .4, 0, 600); break
      case 'crackle': noise(.012 + Math.random() * .02, .05 + Math.random() * .08, 0, 2000 + Math.random() * 3000, 'bandpass', 4); break
      case 'bump': tone(140, 60, 0.16, 'sine', 0.45); tone(420, 180, 0.08, 'square', 0.08); break
      case 'fall': tone(520, 70, 0.7, 'sawtooth', 0.16); break
      case 'count': tone(520, 520, 0.12, 'triangle', 0.25); break
      case 'go': tone(780, 1040, 0.22, 'triangle', 0.3); break
      case 'join': tone(660, 990, 0.14, 'sine', 0.25); tone(990, 1320, 0.16, 'sine', 0.2, 0.08); break
      case 'ui': tone(660, 700, 0.06, 'triangle', 0.18); break
      case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.01, 0.3, 'triangle', 0.25, i * 0.11)); break
      case 'lose': [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, 0.38, 'sine', 0.25, i * 0.16)); break
    }
  }

  /** Generative ambient pad: slow chord changes on a pentatonic set, scheduled ahead of time. */
  startMusic(): void {
    if (this.musicOn) return
    this.musicOn = true
    const chords = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 261.6, 329.6]]
    let bar = 0
    const schedule = () => {
      if (!this.musicOn) return
      const t = this.ctx.currentTime + 0.05
      const chord = chords[bar % chords.length]
      for (const f of chord) {
        for (const detune of [-6, 6]) {
          const o = this.ctx.createOscillator()
          const g = this.ctx.createGain()
          o.type = 'sine'
          o.frequency.value = f / 2
          o.detune.value = detune
          g.gain.setValueAtTime(0.0001, t)
          g.gain.linearRampToValueAtTime(0.05, t + 1.2)
          g.gain.linearRampToValueAtTime(0.0001, t + 4.2)
          o.connect(g).connect(this.music)
          o.start(t)
          o.stop(t + 4.4)
        }
      }
      bar += 1
      this.musicTimer = window.setTimeout(schedule, 3600)
    }
    schedule()
  }

  stopMusic(): void {
    this.musicOn = false
    clearTimeout(this.musicTimer)
  }
}
