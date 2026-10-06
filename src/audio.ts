// Add real file URLs here when the original soundtrack becomes available.
// Nothing is requested or synthesised when a channel is absent.
type Channel = 'bgm' | 'paper' | 'character'
const sources: Partial<Record<Channel, string>> = {}
export class Soundtrack {
  private tracks = new Map<Channel, HTMLAudioElement>()
  unlock() {
    for (const [channel, source] of Object.entries(sources) as [Channel, string][]) {
      if (!this.tracks.has(channel)) {
        const audio = new Audio(source)
        audio.loop = channel === 'bgm'
        audio.volume = channel === 'bgm' ? 0.25 : 0.5
        this.tracks.set(channel, audio)
      }
    }
    this.play('bgm')
  }
  play(channel: Channel) {
    const audio = this.tracks.get(channel)
    if (!audio) return
    if (channel !== 'bgm') audio.currentTime = 0
    void audio.play().catch(() => { /* Optional audio never blocks the invitation. */ })
  }
  pause() { this.tracks.forEach(audio => audio.pause()) }
  dispose() { this.pause(); this.tracks.clear() }
}
