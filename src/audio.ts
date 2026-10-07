type Channel = 'bgm' | 'paper' | 'slide' | 'character'
const sources: Partial<Record<Channel, string>> = {
  paper: `${import.meta.env.BASE_URL}media/audio/envelope-open.mp3`,
  slide: `${import.meta.env.BASE_URL}media/audio/paper-slide.mp3`,
}
export class Soundtrack {
  private context: AudioContext | null = null
  private buffers = new Map<Channel, AudioBuffer>()
  private data: Promise<[Channel, ArrayBuffer][]> | null = null
  private decoding = false
  private tracks = new Set<AudioBufferSourceNode>()
  private video: HTMLVideoElement | null = null
  private music: HTMLAudioElement | null = null
  private musicSource: MediaElementAudioSourceNode | null = null
  private musicGain: GainNode | null = null
  private musicEnabled = true
  private musicVolume = .25
  resumeMusic() {
    if (!this.musicEnabled || document.hidden || !this.music || !this.music.paused) return
    // Native audio can autoplay on allowed sites without waiting for Web Audio unlock.
    void this.music.play().catch(error => {
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') console.warn('Background music could not play', error)
    })
  }
  private connectMusic() {
    const context = this.context
    if (!this.music || this.musicSource || !context || context.state !== 'running') return
    const source = context.createMediaElementSource(this.music), gain = context.createGain()
    gain.gain.value = this.musicVolume * (this.video ? .65 : 1)
    source.connect(gain); gain.connect(context.destination)
    this.musicSource = source; this.musicGain = gain
    this.music.volume = 1
  }
  private pauseMusic() { this.music?.pause() }
  setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled
    if (enabled) { this.unlock(); this.resumeMusic() }
    else this.pauseMusic()
  }
  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume))
    if (this.musicGain && this.context) {
      const gain = this.musicGain.gain, now = this.context.currentTime
      gain.cancelScheduledValues(now)
      gain.setValueAtTime(gain.value, now)
      gain.setTargetAtTime(this.musicVolume * (this.video ? .65 : 1), now, .35)
    } else if (this.music) this.music.volume = this.musicVolume * (this.video ? .65 : 1)
  }
  preload() {
    if (!this.music) {
      this.music = new Audio(`${import.meta.env.BASE_URL}media/audio/study-music.mp3`)
      this.music.loop = true
      this.music.preload = 'auto'
      this.music.volume = this.musicVolume
      this.resumeMusic()
    }
    this.data ??= Promise.all((Object.entries(sources) as [Channel, string][]).map(async ([channel, source]) => {
      const response = await fetch(source)
      if (!response.ok) throw new Error(`Paper sound unavailable: ${response.status}`)
      return [channel, await response.arrayBuffer()] as [Channel, ArrayBuffer]
    }))
    return this.data
  }
  claimVideo(video: HTMLVideoElement) {
    this.video?.pause()
    this.tracks.forEach(track => track.stop()); this.tracks.clear()
    this.video = video
    this.setMusicVolume(this.musicVolume)
    this.resumeMusic()
  }
  releaseVideo(video: HTMLVideoElement | null) { if (this.video === video) { this.video = null; this.setMusicVolume(this.musicVolume); this.resumeMusic() } }
  unlock() {
    this.context ??= new AudioContext()
    const context = this.context
    this.resumeMusic()
    void context.resume().then(() => { this.connectMusic(); this.resumeMusic() }).catch(error => console.warn('Paper audio awaits another gesture', error))
    if (this.decoding) return
    this.decoding = true
    void this.preload().then(files => Promise.all(files.map(async ([channel, data]) => {
      this.buffers.set(channel, await context.decodeAudioData(data.slice(0)))
    }))).then(() => this.resumeMusic()).catch(error => { this.decoding = false; console.warn('Paper audio could not load', error) })

  }
  play(channel: Channel) {
    if (document.hidden || (this.video && !this.video.ended)) return
    const buffer = this.buffers.get(channel), context = this.context
    if (!buffer || !context || context.state !== 'running') return
    this.tracks.forEach(track => track.stop())
    this.tracks.clear()
    const source = context.createBufferSource(), gain = context.createGain()
    source.buffer = buffer
    gain.gain.value = channel === 'paper' ? 0.18 : 0.14
    source.connect(gain); gain.connect(context.destination)
    this.tracks.add(source)
    source.onended = () => { this.tracks.delete(source); source.disconnect(); gain.disconnect() }
    source.start()
  }
  pause() { this.pauseMusic(); this.video?.pause(); this.tracks.forEach(track => track.stop()); this.tracks.clear() }
  dispose() { this.pause(); this.video = null; this.musicSource?.disconnect(); this.musicGain?.disconnect(); this.musicSource = null; this.musicGain = null; if (this.music) { this.music.removeAttribute('src'); this.music.load() }; this.music = null; if (this.context) void this.context.close(); this.context = null; this.buffers.clear(); this.decoding = false }
}
