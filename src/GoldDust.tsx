import { useEffect, useRef } from 'react'
import './goldDust.css'

type Particle = {
  x: number; y: number; vx: number; vy: number
  size: number; alpha: number; born: number; life: number; color: string
}
type QuietRect = { left: number; top: number; right: number; bottom: number }

const colors = ['#c6a15b', '#d8b875', '#ead39a', '#f2dfad']
const particleLimit = 64
const quietAreas = [
  '.entry-copy', '.film-start', '.open-hint', '.invitation-card', '.celebration-copy',
  '.olive-dialogue', '.secret-envelope', '.private-letter', '.saved-letter',
  '.character-dialogue', '.author-note', '.private-writing-paper',
  '.first-letter-viewer header', '.original-letter-scroll', '.put-letter-back',
  '.scene-swipe-hint', '.music-control', '.fullscreen-toggle', '.fullscreen-error',
  '.orientation-overlay',
].join(',')

/** One canvas and one engine persist through the invitation's existing stages. */
export function GoldDust({ mobile, stage }: { mobile: boolean; stage: string }) {
  const stageRef = useRef(stage)
  const moveLayer = useRef<(() => void) | null>(null)
  stageRef.current = stage

  useEffect(() => {
    if (mobile) return
    const finePointer = window.matchMedia('(pointer: fine) and (hover: hover)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let stopEngine: (() => void) | undefined

    const startEngine = () => {
      const root = document.querySelector<HTMLElement>('main.experience')
      if (!root) return () => {}
      const canvas = document.createElement('canvas')
      canvas.className = 'gold-dust-layer'
      canvas.setAttribute('aria-hidden', 'true')
      const context = canvas.getContext('2d', { alpha: true })
      if (!context) return () => {}
      let width = 0, height = 0, frame = 0
      let particles: Particle[] = []
      let lastPoint: { x: number; y: number } | null = null
      let distanceCarried = 0
      let nextSpacing = 16 + Math.random() * 8
      let elements: HTMLElement[] = []
      let rects: QuietRect[] = []
      let measuredAt = -Infinity

      // Move this same node between background stacking contexts. Its local
      // z-index stays below the existing cards, dialogue, controls and letters.
      const rehome = () => {
        const current = stageRef.current
        const selector = current === 'film' ? '.film'
          : current === 'room-explore' ? '.final-room'
            : ['celebration-video', 'meeting-confirmation', 'food-choice', 'final-summary', 'olive-npc', 'hidden-letter'].includes(current)
              ? '.celebration-scene' : null
        const readingRoom = current === 'hidden-letter' ? root.querySelector<HTMLElement>('.final-room') : null
        const parent = readingRoom ?? (selector ? root.querySelector<HTMLElement>(selector) ?? root : root)
        if (canvas.parentElement !== parent) parent.appendChild(canvas)
        measuredAt = -Infinity
      }
      moveLayer.current = rehome
      const refreshElements = () => {
        elements = Array.from(root.querySelectorAll<HTMLElement>(quietAreas))
        measuredAt = -Infinity
        rehome()
      }
      const observer = new MutationObserver(refreshElements)
      observer.observe(root, { childList: true, subtree: true })
      refreshElements()

      const resize = () => {
        width = window.innerWidth
        height = window.innerHeight
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.round(width * pixelRatio)
        canvas.height = Math.round(height * pixelRatio)
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
        measuredAt = -Infinity
      }
      resize()

      const measureQuietAreas = (now: number) => {
        // Rectangles are cached; layout is read only while particles are alive.
        if (now - measuredAt < 90) return
        measuredAt = now
        rects = elements.flatMap(element => {
          if (!element.isConnected || element.closest('[inert], [aria-hidden="true"]')) return []
          const style = window.getComputedStyle(element)
          if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return []
          const rect = element.getBoundingClientRect()
          if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > height) return []
          return [{ left: rect.left - 7, top: rect.top - 7, right: rect.right + 7, bottom: rect.bottom + 7 }]
        })
      }
      const paint = (now: number) => {
        frame = 0
        context.clearRect(0, 0, width, height)
        particles = particles.filter(particle => now - particle.born < particle.life)
        if (!particles.length || document.hidden) return
        measureQuietAreas(now)
        for (const particle of particles) {
          const age = Math.max(0, now - particle.born)
          const progress = age / particle.life
          const drift = 240 * (1 - Math.exp(-age / 240))
          const x = particle.x + particle.vx * drift
          const y = particle.y + particle.vy * drift
          const fadeIn = Math.min(1, age / 65)
          context.globalAlpha = particle.alpha * fadeIn * Math.pow(1 - progress, 1.3)
          context.fillStyle = particle.color
          context.beginPath()
          context.arc(x, y, particle.size * (1 - progress * .12) / 2, 0, Math.PI * 2)
          context.fill()
        }
        context.globalAlpha = 1
        // A few nested text containers share a background stacking context.
        // Clearing their bounds keeps dust entirely off the existing typography.
        for (const rect of rects) context.clearRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top)
        frame = window.requestAnimationFrame(paint)
      }
      const addParticle = (x: number, y: number, now: number, bloom = false) => {
        if (particles.length >= particleLimit) particles.shift()
        const angle = Math.random() * Math.PI * 2
        const spread = Math.random() * (bloom ? 5 : 3)
        particles.push({
          x: x + Math.cos(angle) * spread, y: y + Math.sin(angle) * spread,
          vx: (Math.random() - .5) * .025, vy: (Math.random() - .58) * .022,
          size: Math.random() < .055 ? 2.5 + Math.random() : .8 + Math.random() * 1.4,
          alpha: .15 + Math.random() * .4, born: now, life: 450 + Math.random() * 550,
          color: Math.random() < .025 ? '#f3e7c9' : colors[Math.floor(Math.random() * colors.length)],
        })
        if (!frame) frame = window.requestAnimationFrame(paint)
      }
      const onMove = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse' || document.hidden) return
        const point = { x: event.clientX, y: event.clientY }
        if (lastPoint) {
          const dx = point.x - lastPoint.x, dy = point.y - lastPoint.y
          const distance = Math.hypot(dx, dy)
          distanceCarried += distance
          if (distanceCarried >= nextSpacing) {
            const count = Math.min(5, Math.floor(distanceCarried / nextSpacing))
            const now = performance.now()
            for (let i = 1; i <= count; i++) {
              const fraction = i / (count + 1)
              addParticle(lastPoint.x + dx * fraction, lastPoint.y + dy * fraction, now)
            }
            distanceCarried %= nextSpacing
            nextSpacing = 16 + Math.random() * 8
          }
        }
        lastPoint = point
      }
      const onPress = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse' || event.button !== 0 || document.hidden) return
        const now = performance.now(), count = 6 + Math.floor(Math.random() * 5)
        for (let i = 0; i < count; i++) addParticle(event.clientX, event.clientY, now, true)
      }
      const clear = () => {
        window.cancelAnimationFrame(frame)
        frame = 0
        particles = []
        lastPoint = null
        distanceCarried = 0
        context.clearRect(0, 0, width, height)
      }
      const invalidateRects = () => { measuredAt = -Infinity }
      const onLeave = (event: PointerEvent) => { if (!event.relatedTarget) lastPoint = null }
      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('pointerdown', onPress, { passive: true })
      window.addEventListener('pointerout', onLeave, { passive: true })
      window.addEventListener('resize', resize, { passive: true })
      window.addEventListener('scroll', invalidateRects, { passive: true, capture: true })
      document.addEventListener('visibilitychange', clear)
      return () => {
        clear()
        observer.disconnect()
        moveLayer.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerdown', onPress)
        window.removeEventListener('pointerout', onLeave)
        window.removeEventListener('resize', resize)
        window.removeEventListener('scroll', invalidateRects, true)
        document.removeEventListener('visibilitychange', clear)
        canvas.remove()
      }
    }
    const update = () => {
      stopEngine?.()
      stopEngine = !reducedMotion.matches && finePointer.matches ? startEngine() : undefined
    }
    update()
    finePointer.addEventListener('change', update)
    reducedMotion.addEventListener('change', update)
    return () => {
      stopEngine?.()
      finePointer.removeEventListener('change', update)
      reducedMotion.removeEventListener('change', update)
    }
  }, [mobile])

  useEffect(() => { moveLayer.current?.() }, [stage])
  return null
}
