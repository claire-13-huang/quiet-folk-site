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
  preload() {
    this.data ??= Promise.all((Object.entries(sources) as [Channel, string][]).map(async ([channel, source]) => {
      const response = await fetch(source)
      if (!response.ok) throw new Error(`Paper sound unavailable: ${response.status}`)
      return [channel, await response.arrayBuffer()] as [Channel, ArrayBuffer]
    }))
    return this.data
  }
  claimVideo(video: HTMLVideoElement) { this.pause(); this.video = video }
  releaseVideo(video: HTMLVideoElement | null) { if (this.video === video) this.video = null }
  unlock() {
    this.context ??= new AudioContext()
    const context = this.context
    void context.resume().catch(error => console.warn('Paper audio awaits another gesture', error))
    if (this.decoding) return
    this.decoding = true
    void this.preload().then(files => Promise.all(files.map(async ([channel, data]) => {
      this.buffers.set(channel, await context.decodeAudioData(data.slice(0)))
    }))).catch(error => { this.decoding = false; console.warn('Paper audio could not load', error) })
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
  pause() { this.video?.pause(); this.tracks.forEach(track => track.stop()); this.tracks.clear() }
  dispose() { this.pause(); this.video = null; if (this.context) void this.context.close(); this.context = null; this.buffers.clear(); this.decoding = false }
}
