import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { Soundtrack } from './audio'

const media = (name: string) => `${import.meta.env.BASE_URL}media/${name}`
const ease = [0.22, 0.61, 0.36, 1] as const
const sceneFiles = ['closed.webp', 'open.webp', 'envelope.webp', 'card.webp', 'celebration-poster.jpg']
type Stage = 'film' | 'envelope' | 'opening' | 'invitation-card' | 'celebration-video' | 'meeting-confirmation'

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
  const [filmEntered, setFilmEntered] = useState(false)
  const [filmStarting, setFilmStarting] = useState(false)
  const entered = useRef(false)
  const playPending = useRef(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const [handoffReady, setHandoffReady] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [extract, setExtract] = useState(false)
  const [raised, setRaised] = useState(false)
  const [copy, setCopy] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const openButton = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLElement>(null)
  const celebration = useRef<HTMLVideoElement>(null)
  const celebrationEntered = useRef(false)
  const celebrationPending = useRef(false)
  const celebrationComplete = useRef(false)
  const [celebrationStarting, setCelebrationStarting] = useState(false)
  const [celebrationBlocked, setCelebrationBlocked] = useState(false)
  const [celebrationFailed, setCelebrationFailed] = useState(false)
  const [celebrationTime, setCelebrationTime] = useState(0)
  const [celebrationDuration, setCelebrationDuration] = useState(0)
  const [celebrationEnded, setCelebrationEnded] = useState(false)
  const [meetingCopy, setMeetingCopy] = useState(0)
  const [meetingChoice, setMeetingChoice] = useState<'confirmed' | 'adjust' | null>(null)
  const meetingCard = useRef<HTMLElement>(null)
  const track = useRef(new Soundtrack())
  const filmFinished = useRef(false)
  const beginEnvelope = useCallback(() => {
    filmFinished.current = true
    video.current?.pause()
    track.current.releaseVideo(video.current)
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
    if (assetsReady && filmFinished.current) beginEnvelope()
  }, [assetsReady, beginEnvelope])
  useEffect(() => {
    if (stage === 'invitation-card') card.current?.focus({ preventScroll: true })
    if (stage === 'meeting-confirmation') meetingCard.current?.focus({ preventScroll: true })
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
      window.setTimeout(() => setStage('invitation-card'), reduced ? 150 : 3150),
    ]
    return () => timers.forEach(clearTimeout)
  }, [stage, reduced])
  useEffect(() => {
    if (stage !== 'invitation-card') return
    const timers = [1, 2, 3, 4].map((line, i) => window.setTimeout(() => setCopy(line), reduced ? 0 : 350 + i * 900))
    return () => timers.forEach(clearTimeout)
  }, [stage, reduced])
  useEffect(() => {
    if (!celebrationEnded) return
    const timer = window.setTimeout(() => setStage('meeting-confirmation'), 400)
    return () => clearTimeout(timer)
  }, [celebrationEnded])
  useEffect(() => {
    if (stage !== 'meeting-confirmation') return
    const timers = [1, 2, 3].map((line, i) => window.setTimeout(() => setMeetingCopy(line), reduced ? 100 : 350 + i * 650))
    return () => timers.forEach(clearTimeout)
  }, [stage, reduced])
  useEffect(() => {
    const soundtrack = track.current
    const pauseMedia = () => {
      soundtrack.pause()
      if ((entered.current || playPending.current) && !filmFinished.current && video.current) setPlayBlocked(true)
      video.current?.pause()
      if ((celebrationEntered.current || celebrationPending.current) && !celebrationComplete.current && celebration.current) setCelebrationBlocked(true)
      celebration.current?.pause()
    }
    const visibility = () => { if (document.hidden) pauseMedia() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', pauseMedia)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', pauseMedia)
      soundtrack.dispose()
    }
  }, [])

  const enterFilm = () => {
    const element = video.current
    if (!element || playPending.current) return
    if (videoFailed) { if (assetsReady) beginEnvelope(); return }
    playPending.current = true
    track.current.claimVideo(element)
    setFilmStarting(true)
    // Keep play() inside this gesture, on the existing inline video element.
    if (!entered.current) element.currentTime = 0
    element.muted = false
    element.defaultMuted = false
    element.volume = 0.85
    void element.play().then(() => {
      entered.current = true
      setFilmEntered(true)
      setPlayBlocked(element.paused || document.hidden)
      if (document.hidden) element.pause()
    }).catch(() => {
      // A blocked start stays on the poster and requests another gesture.
      setPlayBlocked(true)
    }).finally(() => {
      playPending.current = false
      setFilmStarting(false)
    })
  }

  const playCelebration = () => {
    const element = celebration.current
    if (!element || celebrationPending.current || celebrationComplete.current) return
    if (stage !== 'invitation-card' && stage !== 'celebration-video') return
    if (stage === 'invitation-card' && celebrationEntered.current) return
    celebrationPending.current = true
    setCelebrationStarting(true)
    setCelebrationFailed(false)
    video.current?.pause()
    track.current.claimVideo(element)
    if (!celebrationEntered.current) element.currentTime = 0
    element.muted = false
    element.defaultMuted = false
    element.volume = 0.85
    if (element.error) element.load()
    // YES and Resume call play() synchronously on this already-preloaded element.
    void element.play().then(() => {
      celebrationEntered.current = true
      setCelebrationBlocked(element.paused || document.hidden)
      if (document.hidden) element.pause()
    }).catch(() => setCelebrationBlocked(true)).finally(() => {
      celebrationPending.current = false
      setCelebrationStarting(false)
    })
    setStage('celebration-video')
  }

  const celebrating = stage === 'celebration-video' || stage === 'meeting-confirmation'
  const titleStart = Math.max(0, celebrationDuration - 4.5)
  const titleVisible = celebrationDuration > 0 && celebrationTime < celebrationDuration - .3
  const opened = stage === 'opening' || stage === 'invitation-card'
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
        animate={{ x: stage === 'film' && !reduced ? -planeW * .032 : 0, y: stage === 'film' && !reduced ? -planeH * .036 : 0, scale: stage === 'film' && !reduced ? 1.5 : pressed ? .991 : 1, filter: extract && !celebrating ? 'blur(12px) brightness(0.42)' : 'blur(0px) brightness(1)' }}
        transition={{ duration: reduced ? .2 : celebrating ? .4 : 2, delay: extract && !celebrating ? .4 : 0, x: { duration: reduced ? .2 : 2 }, y: { duration: reduced ? .2 : 2 }, scale: { duration: reduced ? .2 : stage === 'envelope' && !handoffReady ? 2 : .18 } }}>
        <img className="room-image" src={media('closed.webp')} alt="" />
        <motion.img className="room-image" src={media('open.webp')} alt="" initial={{ opacity: 0 }}
          animate={{ opacity: opened ? 1 : 0 }} transition={{ duration: reduced ? .15 : .8 }} />
      </motion.div>
      <div className="vignette" aria-hidden="true" />
      <AnimatePresence>
        {stage === 'film' && <motion.div className="film" key="film" initial={false} exit={{ opacity: 0 }}
          transition={{ duration: reduced ? .2 : 1.25 }}>
          <video ref={video} playsInline preload="auto" poster={media('poster.webp')}
            style={{ width: planeW, height: planeH, left: planeX, top: planeY }}
            onPause={() => { if (entered.current && !filmFinished.current && !video.current?.ended) setPlayBlocked(true) }}
            onEnded={() => { filmFinished.current = true; if (assetsReady) beginEnvelope() }}
            onError={() => setVideoFailed(true)} src={`${media('opening.mp4')}?v=original-audio`} />
          {(!filmEntered || playBlocked || videoFailed) && !assetFailed && <button className="film-start" disabled={filmStarting || (videoFailed && !assetsReady)} onClick={enterFilm}>
            {videoFailed ? 'Open your invitation' : filmEntered ? 'Resume' : 'Enter'}
          </button>}
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
      <AnimatePresence>
      {opened && <>
        <motion.div className="envelope-layers" aria-hidden="true"
          style={{ left: planeX + planeW * .303, top: planeY + planeH * .128, width: planeW * .42, height: planeH * .672 }}
          initial={{ opacity: 0 }} animate={{ opacity: extract ? 0 : 1 }}
          transition={{ duration: extract ? 1.2 : .65, delay: extract ? 1.1 : .35 }}>
          <img src={media('envelope.webp')} className="envelope-back" alt="" />
        </motion.div>
        <motion.article ref={card} tabIndex={-1} aria-label="Your invitation" className="invitation-card" style={{ zIndex: raised ? 5 : 3 }}
          initial={{ ...paperStart, opacity: 0, rotate: -1 }}
          exit={{ opacity: 0, scale: .985, transition: { duration: .28, opacity: { duration: .28 }, scale: { duration: .28 } } }}
          animate={stage === 'invitation-card' ? { ...paperEnd, opacity: 1, rotate: 0 } : extract ? { left: [paperStart.left, paperStart.left, paperEnd.left], top: [paperStart.top, planeY + planeH * .41 - paperStart.height - 18, paperEnd.top], width: [paperStart.width, paperStart.width, paperEnd.width], height: [paperStart.height, paperStart.height, paperEnd.height], opacity: 1, rotate: [-1, -1, 0] } : { ...paperStart, opacity: 1, rotate: -1 }}
          transition={{ duration: reduced ? .15 : stage === 'opening' ? 2.4 : .45, times: [0, .44, 1], ease, opacity: { duration: celebrating ? .35 : .6 }, scale: { duration: .35 }, rotate: { duration: 1.8 } }}>
          <img className="paper" src={media('card.webp')} alt="" />
          <div className="invitation-copy" aria-hidden={stage !== 'invitation-card'}>
            <motion.p className="salutation" animate={reveal(1)} transition={{ duration: reduced ? .1 : .9 }}>For Colette</motion.p>
            <motion.p className="introduction" animate={reveal(2)} transition={{ duration: reduced ? .1 : .9 }}>I've been meaning to ask you something.</motion.p>
            <motion.h1 animate={reveal(3)} transition={{ duration: reduced ? .1 : 1 }}>Would you like to go<br className="desktop-break" /> on a date with me?</motion.h1>
            <motion.div initial={false} animate={{ opacity: copy >= 4 && stage === 'invitation-card' ? 1 : 0, y: copy >= 4 || reduced ? 0 : 6 }} transition={{ duration: .8 }} aria-hidden={copy < 4 || stage !== 'invitation-card'} inert={copy < 4 || stage !== 'invitation-card'}>
              <Answers reduced={reduced} active={copy >= 4 && stage === 'invitation-card'} onYes={playCelebration} />
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
      </AnimatePresence>
      <motion.section className="celebration-scene" aria-label="Celebration" aria-hidden={!celebrating} inert={!celebrating}
        initial={false} animate={{ opacity: celebrating ? 1 : 0 }}
        transition={{ duration: reduced ? .15 : .4, delay: celebrating ? .2 : 0 }} style={{ pointerEvents: celebrating ? 'auto' : 'none' }}>
        <motion.div className="celebration-picture" initial={false}
          animate={{ filter: stage === 'meeting-confirmation' ? w < 600 ? 'blur(5px) brightness(0.76)' : 'blur(6px) brightness(0.74)' : 'blur(0px) brightness(1)', scale: stage === 'meeting-confirmation' ? 1.01 : 1 }}
          transition={{ duration: reduced ? .2 : 1.25 }}>
          <div className="celebration-fill" style={{ backgroundImage: `url(${media('celebration-poster.jpg')})` }} aria-hidden="true" />
          <video ref={celebration} className="celebration-video" playsInline preload="auto" poster={media('celebration-poster.jpg')}
            src={media('celebration-web.mp4')}
            onLoadedMetadata={() => setCelebrationDuration(celebration.current?.duration ?? 0)}
            onTimeUpdate={() => setCelebrationTime(celebration.current?.currentTime ?? 0)}
            onPause={() => { if (celebrationEntered.current && !celebrationComplete.current && !celebration.current?.ended) setCelebrationBlocked(true) }}
            onEnded={() => {
              celebrationComplete.current = true
              track.current.releaseVideo(celebration.current)
              setCelebrationBlocked(false)
              setCelebrationEnded(true)
            }}
            onError={() => { setCelebrationFailed(true); setCelebrationBlocked(true) }} />
        </motion.div>
        {stage === 'celebration-video' && <div className="celebration-copy" aria-live="polite">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: titleVisible && celebrationTime >= titleStart ? 1 : 0, y: celebrationTime >= titleStart ? 0 : 10 }} transition={{ duration: titleVisible ? .8 : .3 }}>Thank you for saying yes.</motion.p>
          <motion.p className="celebration-next" initial={{ opacity: 0, y: 10 }} animate={{ opacity: titleVisible && celebrationTime >= titleStart + .7 ? 1 : 0, y: celebrationTime >= titleStart + .7 ? 0 : 10 }} transition={{ duration: titleVisible ? .8 : .3 }}>Now let me make sure I’ve got the rest right.</motion.p>
        </div>}
        {stage === 'celebration-video' && celebrationBlocked && !celebrationEnded && <button className="film-start celebration-resume" disabled={celebrationStarting} onClick={playCelebration}>
          {celebrationFailed ? 'Try the celebration again' : celebrationEntered.current ? 'Resume' : 'Begin celebration'}
        </button>}
      </motion.section>
      {stage === 'meeting-confirmation' && <motion.article ref={meetingCard} className="invitation-card meeting-card" style={{ ...paperEnd, top: (h - targetHeight) / 2, zIndex: 6 }} tabIndex={-1} aria-label="Meeting confirmation"
        initial={{ opacity: 0, scale: .97, y: reduced ? 0 : 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: reduced ? .2 : .8 }}>
        <img className="paper" src={media('card.webp')} alt="" />
        <div className="invitation-copy meeting-copy">
          <motion.p className="meeting-introduction" animate={{ opacity: meetingCopy >= 1 ? 1 : 0, y: meetingCopy >= 1 ? 0 : 8 }} transition={{ duration: .8 }}>Just to make sure I’ve got it right…</motion.p>
          <motion.h1 animate={{ opacity: meetingCopy >= 2 ? 1 : 0, y: meetingCopy >= 2 ? 0 : 8 }} transition={{ duration: .8 }}>October 22, 12:00 PM —<br />Hong Kong Airport?</motion.h1>
          <motion.div className="meeting-answers" animate={{ opacity: meetingCopy >= 3 ? 1 : 0 }} transition={{ duration: .8 }} inert={meetingCopy < 3}>
            <button className="answer yes-answer" disabled={meetingCopy < 3} aria-pressed={meetingChoice === 'confirmed'} onClick={() => setMeetingChoice('confirmed')}>Yes, see you then ♡</button>
            <button className="answer" disabled={meetingCopy < 3} aria-pressed={meetingChoice === 'adjust'} onClick={() => setMeetingChoice('adjust')}>Let’s adjust it</button>
          </motion.div>
          <p className="meeting-status" role="status">{meetingChoice === 'confirmed' ? 'See you then ♡' : meetingChoice === 'adjust' ? 'We can adjust the details.' : ''}</p>
        </div>
      </motion.article>}

    </main>
  </MotionConfig>
}
