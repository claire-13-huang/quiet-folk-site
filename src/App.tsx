import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { Soundtrack } from './audio'

const media = (name: string) => `${import.meta.env.BASE_URL}media/${name}`
const ease = [0.22, 0.61, 0.36, 1] as const
const sceneFiles = ['closed.webp', 'open.webp', 'envelope.webp', 'card.webp']
type Stage = 'film' | 'envelope' | 'opening' | 'card' | 'yes'

function useViewport() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const resize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  return size
}

function Answers({ onYes, reduced, active }: { onYes: () => void; reduced: boolean; active: boolean }) {
  const no = useRef<HTMLButtonElement>(null)
  const yes = useRef<HTMLButtonElement>(null)
  const { w, h } = useViewport()
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const lastMove = useRef(0)
  const count = useRef(0)
  useEffect(() => { setOffset({ x: 0, y: 0 }) }, [w, h])
  const evade = useCallback(() => {
    if (!active || reduced || !no.current || !yes.current || performance.now() - lastMove.current < 650) return
    const rect = no.current.getBoundingClientRect()
    const yesRect = yes.current.getBoundingClientRect()
    const base = { x: rect.left - offset.x, y: rect.top - offset.y }
    // Each move is measured from the current position, not the original position.
    const choices = [{ x: 110, y: 0 }, { x: 0, y: 110 }, { x: -110, y: 0 }, { x: 0, y: -110 }, { x: 78, y: 78 }, { x: -78, y: 78 }, { x: -78, y: -78 }, { x: 78, y: -78 }]
    for (let i = 0; i < choices.length; i++) {
      const candidate = choices[(count.current + i) % choices.length]
      const x = Math.max(16 - base.x, Math.min(offset.x + candidate.x, w - 16 - rect.width - base.x))
      const y = Math.max(16 - base.y, Math.min(offset.y + candidate.y, h - 16 - rect.height - base.y))
      const left = base.x + x, top = base.y + y
      const overlapsYes = left < yesRect.right + 12 && left + rect.width > yesRect.left - 12 && top < yesRect.bottom + 12 && top + rect.height > yesRect.top - 12
      if (!overlapsYes && Math.hypot(x - offset.x, y - offset.y) >= 90) {
        setOffset({ x, y }); count.current += i + 1; lastMove.current = performance.now(); break
      }
    }
  }, [offset, reduced, active, w, h])
  useEffect(() => {
    if (!active) return
    const near = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !no.current || document.activeElement === no.current) return
      const rect = no.current.getBoundingClientRect()
      const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right)
      const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom)
      if (Math.hypot(dx, dy) < 40) evade()
    }
    window.addEventListener('pointermove', near)
    return () => window.removeEventListener('pointermove', near)
  }, [evade, active])
  const [declined, setDeclined] = useState(false)
  return <div className="answers">
    <button ref={yes} className="answer yes-answer" disabled={!active} onClick={onYes}>Yes, I'd love to</button>
    <motion.button ref={no} className="answer no-answer" disabled={!active} animate={offset}
      transition={{ type: 'tween', duration: reduced ? 0 : 0.55, ease }}
      onPointerDown={event => {
        if (event.pointerType === 'touch' && !reduced) { evade() }
      }}
      onClick={event => {
        if ((event.nativeEvent as PointerEvent).pointerType === 'touch' && !reduced) { event.preventDefault(); return }
        // Keyboard and reduced-motion users can decline without chasing a control.
        if (event.detail === 0 || reduced) setDeclined(true)
        else evade()
      }}>No</motion.button>
    <span className="decline-note" role="status">{declined ? 'Take your time.' : ''}</span>
  </div>
}

export function App() {
  const reduced = !!useReducedMotion()
  const { w, h } = useViewport()
  const [stage, setStage] = useState<Stage>('film')
  const [assetsReady, setAssetsReady] = useState(false)
  const [assetFailed, setAssetFailed] = useState(false)
  const [playBlocked, setPlayBlocked] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const [handoffReady, setHandoffReady] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [extract, setExtract] = useState(false)
  const [raised, setRaised] = useState(false)
  const [copy, setCopy] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const openButton = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLElement>(null)
  const yesHeading = useRef<HTMLHeadingElement>(null)
  const track = useRef(new Soundtrack())
  const filmFinished = useRef(false)
  const beginEnvelope = useCallback(() => {
    filmFinished.current = true
    setStage(current => current === 'film' ? 'envelope' : current)
  }, [])

  useEffect(() => {
    let active = true
    const images = sceneFiles.map(file => new Promise<void>((resolve, reject) => {
      const image = new Image()
      image.onload = () => image.decode().then(resolve, reject)
      image.onerror = reject
      image.src = media(file)
    }))
    void Promise.all(images).then(() => {
      if (active) setAssetsReady(true)
    }).catch(() => { if (active) setAssetFailed(true) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (assetsReady && (filmFinished.current || videoFailed)) beginEnvelope()
  }, [assetsReady, videoFailed, beginEnvelope])
  useEffect(() => {
    const element = video.current
    if (!element) return
    void element.play().catch(() => setPlayBlocked(true))
  }, [])
  useEffect(() => {
    if (stage === 'card') card.current?.focus({ preventScroll: true })
    if (stage === 'yes') yesHeading.current?.focus({ preventScroll: true })
  }, [stage])
  useEffect(() => {
    if (stage !== 'envelope') return
    const timer = window.setTimeout(() => setHandoffReady(true), reduced ? 200 : 2000)
    return () => clearTimeout(timer)
  }, [stage, reduced])
  useEffect(() => {
    if (stage !== 'opening') return
    const timers = [
      window.setTimeout(() => setExtract(true), reduced ? 50 : 650),
      window.setTimeout(() => setRaised(true), reduced ? 75 : 1750),
      window.setTimeout(() => setStage('card'), reduced ? 150 : 3150),
    ]
    return () => timers.forEach(clearTimeout)
  }, [stage, reduced])
  useEffect(() => {
    if (stage !== 'card') return
    const timers = [1, 2, 3, 4].map((line, i) => window.setTimeout(() => setCopy(line), reduced ? 0 : 350 + i * 900))
    return () => timers.forEach(clearTimeout)
  }, [stage, reduced])
  useEffect(() => {
    const soundtrack = track.current
    const visibility = () => {
      if (document.hidden) { soundtrack.pause(); video.current?.pause() }
      else if (video.current && !filmFinished.current) void video.current.play().catch(() => setPlayBlocked(true))
    }
    document.addEventListener('visibilitychange', visibility)
    return () => { document.removeEventListener('visibilitychange', visibility); soundtrack.dispose() }
  }, [])

  const opened = stage === 'opening' || stage === 'card' || stage === 'yes'
  const planeW = Math.max(w, Math.min(h * 16 / 9, w * 1.35))
  const planeH = planeW * 9 / 16
  const planeX = (w - planeW) / 2, planeY = (h - planeH) / 2
  const startWidth = planeW * 0.362
  const targetWidth = Math.min(760, w - 32, w < 600 ? Infinity : (h - 56) * 1.85)
  const targetHeight = w < 600 ? Math.min(438, h - 64) : targetWidth / 1.85
  const paperStart = { left: planeX + planeW * 0.328, top: planeY + planeH * 0.269, width: startWidth, height: startWidth / 1.85 }
  const paperEnd = { left: (w - targetWidth) / 2, top: (h - targetHeight) / 2 - Math.min(25, h * .025), width: targetWidth, height: targetHeight }
  const reveal = (line: number) => ({ opacity: copy >= line ? 1 : 0, y: copy >= line || reduced ? 0 : 9 })
  const openEnvelope = () => {
    if (stage !== 'envelope' || !assetsReady || !handoffReady) return
    track.current.unlock(); track.current.play('paper'); setStage('opening')
  }

  return <MotionConfig reducedMotion="user" transition={{ type: 'tween', ease }}>
    <main className="experience" data-stage={stage} aria-label="An invitation for Colette">
      <motion.div className="room-fill" aria-hidden="true" animate={{ filter: extract ? 'blur(25px) brightness(0.42)' : 'blur(25px) brightness(0.62)' }} transition={{ duration: reduced ? .2 : 2, delay: extract ? .4 : 0 }} />
      <motion.div className="room" style={{ width: planeW, height: planeH, left: planeX, top: planeY, transformOrigin: '53.7% 58.3%' }}
        initial={false}
        animate={{ x: stage === 'film' && !reduced ? -planeW * .032 : 0, y: stage === 'film' && !reduced ? -planeH * .036 : 0, scale: stage === 'film' && !reduced ? 1.5 : pressed ? .991 : 1, filter: extract ? 'blur(12px) brightness(0.42)' : 'blur(0px) brightness(1)' }}
        transition={{ duration: reduced ? .2 : 2, delay: extract ? .4 : 0, x: { duration: reduced ? .2 : 2 }, y: { duration: reduced ? .2 : 2 }, scale: { duration: reduced ? .2 : stage === 'envelope' && !handoffReady ? 2 : .18 } }}>
        <img className="room-image" src={media('closed.webp')} alt="" />
        <motion.img className="room-image" src={media('open.webp')} alt="" initial={{ opacity: 0 }}
          animate={{ opacity: opened ? 1 : 0 }} transition={{ duration: reduced ? .15 : .8 }} />
      </motion.div>
      <div className="vignette" aria-hidden="true" />
      <AnimatePresence>
        {stage === 'film' && <motion.div className="film" key="film" initial={false} exit={{ opacity: 0 }}
          transition={{ duration: reduced ? .2 : 1.25 }}>
          <video ref={video} autoPlay muted playsInline preload="auto" poster={media('poster.webp')}
            style={{ width: planeW, height: planeH, left: planeX, top: planeY }}
            onTimeUpdate={() => {
              const element = video.current
              if (element && assetsReady && element.duration - element.currentTime <= .12) beginEnvelope()
            }}
            onEnded={() => { filmFinished.current = true; if (assetsReady) beginEnvelope() }}
            onError={() => setVideoFailed(true)} src={media('opening.mp4')} />
          {(playBlocked || videoFailed) && !assetFailed && <button className="film-start" onClick={() => {
            track.current.unlock()
            if (videoFailed && assetsReady) beginEnvelope()
            else void video.current?.play().then(() => setPlayBlocked(false)).catch(() => { setVideoFailed(true) })
          }}>{videoFailed ? 'Open your invitation' : 'Begin'}</button>}
          {assetFailed && <button className="film-start" onClick={() => window.location.reload()}>Try loading your invitation again</button>}
        </motion.div>}
      </AnimatePresence>
      {stage === 'envelope' && <>
        <motion.button ref={openButton} className="envelope-hit" disabled={!handoffReady} aria-label="Open your invitation"
          style={{ left: planeX + planeW * .335, top: planeY + planeH * .40, width: planeW * .40, height: planeH * .365 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? .2 : 2 }}
          onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerCancel={() => setPressed(false)} onPointerLeave={() => setPressed(false)} onClick={openEnvelope} />
        <motion.p className="open-hint" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
          style={{ top: Math.min(h - 65, planeY + planeH * .82) }} transition={{ duration: .9, delay: reduced ? .2 : 2.15 }}>Open me</motion.p>
      </>}
      {opened && <>
        <motion.div className="envelope-layers" aria-hidden="true"
          style={{ left: planeX + planeW * .303, top: planeY + planeH * .128, width: planeW * .42, height: planeH * .672 }}
          initial={{ opacity: 0 }} animate={{ opacity: extract ? 0 : 1 }}
          transition={{ duration: extract ? 1.2 : .65, delay: extract ? 1.1 : .35 }}>
          <img src={media('envelope.webp')} className="envelope-back" alt="" />
        </motion.div>
        <motion.article ref={card} tabIndex={-1} aria-label="Your invitation" className="invitation-card" style={{ zIndex: raised ? 5 : 3 }}
          initial={{ ...paperStart, opacity: 0, rotate: -1 }}
          animate={stage === 'card' || stage === 'yes' ? { ...paperEnd, opacity: stage === 'yes' ? 0 : 1, rotate: 0 } : extract ? { left: [paperStart.left, paperStart.left, paperEnd.left], top: [paperStart.top, planeY + planeH * .41 - paperStart.height - 18, paperEnd.top], width: [paperStart.width, paperStart.width, paperEnd.width], height: [paperStart.height, paperStart.height, paperEnd.height], opacity: 1, rotate: [-1, -1, 0] } : { ...paperStart, opacity: 1, rotate: -1 }}
          transition={{ duration: reduced ? .15 : stage === 'opening' ? 2.4 : .45, times: [0, .44, 1], ease, opacity: { duration: .6 }, rotate: { duration: 1.8 } }}>
          <img className="paper" src={media('card.webp')} alt="" />
          <div className="invitation-copy" aria-hidden={stage !== 'card'}>
            <motion.p className="salutation" animate={reveal(1)} transition={{ duration: reduced ? .1 : .9 }}>For Colette</motion.p>
            <motion.p className="introduction" animate={reveal(2)} transition={{ duration: reduced ? .1 : .9 }}>I've been meaning to ask you something.</motion.p>
            <motion.h1 animate={reveal(3)} transition={{ duration: reduced ? .1 : 1 }}>Would you like to go<br className="desktop-break" /> on a date with me?</motion.h1>
            <motion.div initial={false} animate={{ opacity: copy >= 4 && stage === 'card' ? 1 : 0, y: copy >= 4 || reduced ? 0 : 6 }} transition={{ duration: .8 }} aria-hidden={copy < 4 || stage !== 'card'} inert={copy < 4 || stage !== 'card'}>
              <Answers reduced={reduced} active={copy >= 4 && stage === 'card'} onYes={() => setStage('yes')} />
            </motion.div>
          </div>
        </motion.article>
        <motion.div className="envelope-layers envelope-front" aria-hidden="true"
          style={{ left: planeX + planeW * .303, top: planeY + planeH * .128, width: planeW * .42, height: planeH * .672 }}
          initial={{ opacity: 0 }} animate={{ opacity: extract ? 0 : 1 }}
          transition={{ duration: extract ? .65 : .5, delay: extract ? 1.1 : .4 }}>
          <img src={media('envelope.webp')} alt="" />
        </motion.div>
      </>}
      <AnimatePresence>
        {stage === 'yes' && <motion.section className="yes-scene" key="yes" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: reduced ? .2 : 1.8 }} aria-label="You said yes">
          <motion.h1 ref={yesHeading} tabIndex={-1} initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: reduced ? 0 : .7 }}>You said yes.</motion.h1>
        </motion.section>}
      </AnimatePresence>
    </main>
  </MotionConfig>
}
