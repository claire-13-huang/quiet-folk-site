type Channel = 'bgm' | 'paper' | 'slide' | 'character'
const sources: Partial<Record<Channel, string>> = {
  paper: `${import.meta.env.BASE_URL}media/audio/envelope-open.mp3`,
  slide: `${import.meta.env.BASE_URL}media/audio/paper-slide.mp3`,
}
export class Soundtrack {
  private context: AudioContext | null = null
  private buffers = new Map<Channel, AudioBuffer>()
  private data: Promise<[Channel, ArrayBuffer][]> | null = null
  private musicData: Promise<ArrayBuffer | null> | null = null
  private decoding = false
  private tracks = new Set<AudioBufferSourceNode>()
  private video: HTMLVideoElement | null = null
  private music: AudioBufferSourceNode | null = null
  private musicGain: GainNode | null = null
  private musicOffset = 0
  private musicStarted = 0
  private musicEnabled = true
  private musicVolume = .25
  resumeMusic() {
    const buffer = this.buffers.get('bgm'), context = this.context
    if (!this.musicEnabled || this.music || document.hidden || !buffer || !context || context.state !== 'running') return
    const source = context.createBufferSource(), gain = context.createGain()
    source.buffer = buffer
    source.loop = true
    gain.gain.setValueAtTime(0, context.currentTime)
    gain.gain.linearRampToValueAtTime(this.musicVolume * (this.video ? .12 : 1), context.currentTime + .6)
    source.connect(gain); gain.connect(context.destination)
    this.music = source; this.musicGain = gain; this.musicStarted = context.currentTime
    source.start(0, this.musicOffset % buffer.duration)
  }
  private pauseMusic() {
    if (!this.music || !this.context) return
    this.musicOffset += this.context.currentTime - this.musicStarted
    this.music.stop(); this.music.disconnect(); this.musicGain?.disconnect()
    this.music = null; this.musicGain = null
  }
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
      gain.setTargetAtTime(this.musicVolume * (this.video ? .12 : 1), now, .15)
    }
  }
  preload() {
    this.musicData ??= fetch(`${import.meta.env.BASE_URL}media/audio/study-music.mp3`).then(async response => {
      if (!response.ok) throw new Error(`Music unavailable: ${response.status}`)
      return response.arrayBuffer()
    }).catch(error => { console.warn('Background music could not load', error); return null })
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
    void context.resume().then(() => this.resumeMusic()).catch(error => console.warn('Paper audio awaits another gesture', error))
    if (this.decoding) return
    this.decoding = true
    void this.preload().then(files => Promise.all(files.map(async ([channel, data]) => {
      this.buffers.set(channel, await context.decodeAudioData(data.slice(0)))
    }))).then(() => this.resumeMusic()).catch(error => { this.decoding = false; console.warn('Paper audio could not load', error) })
    void this.musicData?.then(async data => {
      if (!data) return
      this.buffers.set('bgm', await context.decodeAudioData(data.slice(0)))
      this.resumeMusic()
    }).catch(error => console.warn('Background music could not decode', error))
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
  dispose() { this.pause(); this.video = null; if (this.context) void this.context.close(); this.context = null; this.buffers.clear(); this.decoding = false }
}
