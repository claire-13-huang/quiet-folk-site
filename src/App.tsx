import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { Soundtrack } from './audio'
import { trackEvent } from './analytics'
import { roomEntry } from './roomAssets'

const ExploreRoom = lazy(() => import('./ExploreRoom'))

const media = (name: string) => `${import.meta.env.BASE_URL}media/${name}`
const ease = [0.22, 0.61, 0.36, 1] as const
const foodChoices = ['Japanese / Sushi', 'Cha chaan teng', 'Korean', 'Italian / Pasta', "We can decide later"]
const letterParagraphs = [
  'Dear Colie,',
  'It still feels a little unreal that we’re finally going to meet.',
  'I don’t need everything to go perfectly. If you’re tired, if you change your mind, or if there’s simply something you want to say, just tell me. You don’t have to overthink it with me.',
  'And if there’s anywhere in Hong Kong you’d like to take me, or anything you’d like us to do together, I’d love to know.',
  'I MISS U ❤️',
  'It’ll be nice to finally be there with you.',
  '你的,\nClaire',
  '7/10-2026',
]
const oliveLines = [
  'I’ve been keeping something safe for you.',
  'I was told not to give it to you until the very end.',
  'I think this belongs to you now.',
]
const friends = [
  { name: 'Olive', line: 'I’ll be waiting for all your happy stories. Have a wonderful trip — and save a little cuddle for me when you’re back.', x: 14, y: 66 },
  { name: 'Orion', line: 'I’m not saying I’m excited… but you two have a lovely little spark. Have the best trip. And bring me a treat.', x: 82, y: 24 },
  { name: '大灰', line: 'May your trip be full of little joys, sweet treats, and moments you’ll want to keep forever.', x: 84, y: 70 },
  { name: '茶小熊', line: 'I packed a little warmth for your journey. Laugh lots, take care of each other, and come home with happy stories.', x: 37, y: 66 },
]
const sceneFiles = ['closed.webp', 'open.webp', 'envelope.webp', 'card.webp', 'celebration-poster.jpg', 'celebration-room.jpg', 'sealed.webp']
type Stage = 'film' | 'envelope' | 'opening' | 'invitation-card' | 'celebration-video' | 'meeting-confirmation' | 'food-choice' | 'final-summary' | 'olive-npc' | 'hidden-letter' | 'room-explore'

function useViewport() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const resize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', resize)
    return () => { window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize) }
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
    <button ref={yes} className="answer yes-answer" disabled={!active} onClick={onYes}>Yes — it's a date ♡</button>
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
      }}>Let me think…</motion.button>
    <span className="decline-note" role="status">{declined ? 'Take your time.' : ''}</span>
  </div>
}

export function App() {
  const reduced = !!useReducedMotion()
  const { w, h } = useViewport()
  const [mobile] = useState(() => /iPhone|iPad|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches))
  const [orientationGate, setOrientationGate] = useState(false)
  const mobileEntryReady = useRef(false)
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement)
  const [fullscreenError, setFullscreenError] = useState('')
  const fullscreenPending = useRef(false)
  const toggleFullscreen = useCallback(async () => {
    if (fullscreenPending.current) return false
    fullscreenPending.current = true
    setFullscreenError('')
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); return false }
      if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) {
        if (!mobile) setFullscreenError('Please click the fullscreen button to try again.')
        return false
      }
      await document.documentElement.requestFullscreen()
      return !!document.fullscreenElement
    } catch {
      if (!mobile) setFullscreenError('Please click the fullscreen button to try again.')
      return false
    } finally { fullscreenPending.current = false }
  }, [mobile])
  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement)
    const shortcut = (event: KeyboardEvent) => {
      if (event.repeat || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return
      if (((event.metaKey || event.ctrlKey) && event.code === 'Digit9') || (!event.metaKey && !event.ctrlKey && !event.altKey && event.code === 'KeyF')) {
        event.preventDefault()
        void toggleFullscreen()
      }
    }
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('keydown', shortcut)
    return () => { document.removeEventListener('fullscreenchange', sync); document.removeEventListener('keydown', shortcut) }
  }, [toggleFullscreen])
  const [musicOpen, setMusicOpen] = useState(false)
  const [musicEnabled, setMusicEnabled] = useState(true)
  const [musicVolume, setMusicVolume] = useState(25)
  const [stage, setStage] = useState<Stage>('film')
  const [assetsReady, setAssetsReady] = useState(false)
  const [assetFailed, setAssetFailed] = useState(false)
  const [playBlocked, setPlayBlocked] = useState(false)
  const [entryRevealed, setEntryRevealed] = useState(false)
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
  const [meetingConfirmed, setMeetingConfirmed] = useState(false)
  const [foodChoice, setFoodChoice] = useState<string | null>(null)
  const [letterCopy, setLetterCopy] = useState(0)
  const [roomRequested, setRoomRequested] = useState(false)
  const [roomReady, setRoomReady] = useState(false)
  const [roomEntryReady, setRoomEntryReady] = useState(false)
  const [activeFriend, setActiveFriend] = useState<number | null>(null)
  const [foodCopy, setFoodCopy] = useState(0)
  const [postFrameReady, setPostFrameReady] = useState(false)
  const [oliveReady, setOliveReady] = useState(false)
  const [oliveLine, setOliveLine] = useState(0)
  const [secretReady, setSecretReady] = useState(false)
  const matchImage = useRef<HTMLImageElement>(null)
  const [matchDecoded, setMatchDecoded] = useState(false)
  const dialogue = useRef<HTMLButtonElement>(null)
  const [matchEnvelope, setMatchEnvelope] = useState(false)
  const [filmEnded, setFilmEnded] = useState(false)
  const letterCard = useRef<HTMLElement>(null)
  const nextCard = useRef<HTMLElement>(null)
  const meetingCard = useRef<HTMLElement>(null)
  const track = useRef(new Soundtrack())
  const filmFinished = useRef(false)
  const beginEnvelope = useCallback(() => {
    filmFinished.current = true
    video.current?.pause()
    track.current.releaseVideo(video.current)
    setMatchEnvelope(true)
  }, [])

  useEffect(() => {
    let active = true
    void track.current.preload().catch(error => console.warn('Paper audio preload failed', error))
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
    if (!assetsReady || !matchDecoded || !filmFinished.current || stage !== 'film') return
    const timer = window.setTimeout(beginEnvelope, reduced ? 100 : 350)
    return () => clearTimeout(timer)
  }, [assetsReady, matchDecoded, filmEnded, stage, beginEnvelope, reduced])
  useEffect(() => {
    if (!matchEnvelope || stage !== 'film') return
    const timer = window.setTimeout(() => setStage('envelope'), reduced ? 200 : 1100)
    return () => clearTimeout(timer)
  }, [matchEnvelope, stage, reduced])
  useEffect(() => {
    if (stage === 'invitation-card') card.current?.focus({ preventScroll: true })
    if (stage === 'meeting-confirmation') meetingCard.current?.focus({ preventScroll: true })
    if (stage === 'food-choice' || stage === 'final-summary') nextCard.current?.focus({ preventScroll: true })
    if (stage === 'hidden-letter') letterCard.current?.focus({ preventScroll: true })
  }, [stage])
  useEffect(() => {
    if (stage !== 'envelope') return
    const timer = window.setTimeout(() => setHandoffReady(true), reduced ? 100 : 200)
    return () => clearTimeout(timer)
  }, [stage, reduced])
  useEffect(() => {
    if (stage !== 'opening') return
    const timers = [
      window.setTimeout(() => { setExtract(true); track.current.play('slide') }, reduced ? 50 : 650),
      window.setTimeout(() => setRaised(true), reduced ? 75 : 1750),
      window.setTimeout(() => setStage('invitation-card'), reduced ? 150 : 3150),
    ]
    return () => timers.forEach(clearTimeout)
  }, [stage, reduced])
  useEffect(() => {
    if (stage !== 'invitation-card') return
    const timers = [1, 2, 3, 4, 5].map((line, i) => window.setTimeout(() => setCopy(line), reduced ? 0 : 350 + i * 900))
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
    if (stage !== 'meeting-confirmation' || meetingChoice !== 'adjust') return
    const timer = window.setTimeout(() => setStage('food-choice'), 1200)
    return () => clearTimeout(timer)
  }, [stage, meetingChoice])
  useEffect(() => {
    if (stage !== 'food-choice' || !foodChoice) return
    const timer = window.setTimeout(() => setStage('final-summary'), 1000)
    return () => clearTimeout(timer)
  }, [stage, foodChoice])
  useEffect(() => {
    if (stage !== 'food-choice') return
    const timers = [0, 500, 1100, 1650, 2200].map((delay, i) => window.setTimeout(() => setFoodCopy(i + 1), reduced ? 0 : delay))
    return () => timers.forEach(clearTimeout)
  }, [stage, reduced])
  useEffect(() => {
    if (stage !== 'final-summary') return
    const timer = window.setTimeout(() => setStage('olive-npc'), 3000)
    return () => clearTimeout(timer)
  }, [stage])
  useEffect(() => {
    if (stage !== 'olive-npc') return
    const timer = window.setTimeout(() => { setOliveReady(true); dialogue.current?.focus({ preventScroll: true }) }, reduced ? 200 : 1400)
    return () => clearTimeout(timer)
  }, [stage, reduced])
  useEffect(() => {
    if (stage !== 'olive-npc' || oliveLine !== 2) return
    const timer = window.setTimeout(() => setSecretReady(true), 650)
    return () => clearTimeout(timer)
  }, [stage, oliveLine])
  useEffect(() => {
    if (stage !== 'hidden-letter') return
    const timers = [window.setTimeout(() => track.current.play('slide'), 1350), ...[1, 2, 3, 4, 5, 6, 7, 8].map((line, i) => window.setTimeout(() => setLetterCopy(line), 2550 + i * 950))]
    return () => timers.forEach(clearTimeout)
  }, [stage])
  useEffect(() => {
    const soundtrack = track.current
    const startMusic = () => { setEntryRevealed(true); soundtrack.unlock() }
    document.addEventListener('pointerdown', startMusic)
    document.addEventListener('keydown', startMusic)
    const pauseMedia = () => {
      soundtrack.pause()
      if ((entered.current || playPending.current) && !filmFinished.current && video.current) setPlayBlocked(true)
      video.current?.pause()
      if ((celebrationEntered.current || celebrationPending.current) && !celebrationComplete.current && celebration.current) setCelebrationBlocked(true)
      celebration.current?.pause()
    }
    const visibility = () => { if (document.hidden) pauseMedia(); else soundtrack.resumeMusic() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', pauseMedia)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', pauseMedia)
      document.removeEventListener('pointerdown', startMusic)
      document.removeEventListener('keydown', startMusic)
      soundtrack.dispose()
    }
  }, [])

  const enterFilm = () => {
    const element = video.current
    if (!element || playPending.current) return
    if (mobile && !entered.current && !mobileEntryReady.current) { setOrientationGate(true); return }
    if (!mobile && !entered.current && !document.fullscreenElement) {
      void toggleFullscreen().then(active => { if (active) enterFilm() })
      return
    }
    if (videoFailed) { if (assetsReady) { trackEvent('come_in'); beginEnvelope() } return }
    playPending.current = true
    track.current.unlock()
    track.current.claimVideo(element)
    setFilmStarting(true)
    // Keep play() inside this gesture, on the existing inline video element.
    if (!entered.current) element.currentTime = 0
    element.muted = false
    element.defaultMuted = false
    element.volume = 0.85
    void element.play().then(() => {
      trackEvent('come_in')
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

  const continueMobile = () => {
    if (w < h || playPending.current) return
    mobileEntryReady.current = true
    setOrientationGate(false)
    // Both calls stay in this tap. Fullscreen never controls whether video can start.
    try {
      if (!document.fullscreenElement && document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function') {
        void document.documentElement.requestFullscreen().catch(() => {})
      }
    } catch { /* Mobile browsers may decline fullscreen; landscape remains usable. */ }
    enterFilm()
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

  const celebrating = ['celebration-video', 'meeting-confirmation', 'food-choice', 'final-summary', 'olive-npc', 'hidden-letter', 'room-explore'].includes(stage)
  const stationery = ['meeting-confirmation', 'food-choice', 'final-summary', 'olive-npc', 'hidden-letter', 'room-explore'].includes(stage)
  useEffect(() => {
    if (!stationery) return
    const timer = window.setTimeout(() => setPostFrameReady(true), 600)
    return () => clearTimeout(timer)
  }, [stationery])
  const titleStart = Math.max(0, celebrationDuration - 4.5)
  const titleVisible = celebrationDuration > 0 && celebrationTime < celebrationDuration - .3
  const exploring = stage === 'room-explore'
  useEffect(() => {
    if (stage === 'hidden-letter' && letterCopy >= 1) setRoomRequested(true)
  }, [stage, letterCopy])
  const openPrivateLetter = () => {
    setActiveFriend(null); setLetterCopy(0)
    track.current.unlock(); track.current.play('paper'); trackEvent('secret_letter_open'); setStage('hidden-letter')
  }
  const oliveFocus = stage === 'olive-npc'
  const secretWidth = mobile && h < 500 ? 140 : w < 600 ? 168 : 190
  const secretPosition = { left: w < 600 ? w * .29 : w * .27, top: mobile && h < 500 ? h * .13 : w < 600 ? 205 : h * .59, width: secretWidth }
  const opened = stage === 'opening' || stage === 'invitation-card'
  const planeW = mobile ? Math.min(w, h * 16 / 9) : Math.max(w, Math.min(h * 16 / 9, w * 1.35))
  const planeH = planeW * 9 / 16
  const planeX = (w - planeW) / 2, planeY = (h - planeH) / 2
  const startWidth = planeW * 0.362
  const targetWidth = Math.min(760, w - 32, w < 600 ? Infinity : (h - 56) * 1.85)
  const targetHeight = w < 600 ? Math.min(438, h - 64) : targetWidth / 1.85
  const paperStart = { left: planeX + planeW * 0.328, top: planeY + planeH * 0.269, width: startWidth, height: startWidth / 1.85 }
  const paperEnd = { left: (w - targetWidth) / 2, top: (h - targetHeight) / 2 - Math.min(25, h * .025), width: targetWidth, height: targetHeight }
  const reveal = (line: number) => ({ opacity: stage === 'invitation-card' && copy >= line ? 1 : 0, y: copy >= line || reduced ? 0 : 9 })
  const openEnvelope = () => {
    if (stage !== 'envelope' || !assetsReady || !handoffReady) return
    trackEvent('envelope_open')
    track.current.unlock(); track.current.play('paper'); setStage('opening')
  }

  return <MotionConfig reducedMotion="user" transition={{ type: 'tween', ease }}>
    <main className="experience" data-mobile={mobile} onKeyDown={event => { if (event.key === 'Escape') setActiveFriend(null) }} data-stage={stage} aria-label="An invitation for Colette">
      <motion.div className="room-fill" aria-hidden="true" animate={{ filter: extract ? 'blur(25px) brightness(0.42)' : 'blur(25px) brightness(0.62)' }} transition={{ duration: reduced ? .2 : 2, delay: extract ? .4 : 0 }} />
      <motion.div className="room" style={{ width: planeW, height: planeH, left: planeX, top: planeY, transformOrigin: '53.7% 58.3%' }}
        initial={false}
        animate={{ x: stage === 'film' && !matchEnvelope && !reduced ? -planeW * .032 : 0, y: stage === 'film' && !matchEnvelope && !reduced ? -planeH * .036 : 0, scale: stage === 'film' && !matchEnvelope && !reduced ? 1.5 : pressed ? .991 : 1, filter: extract && !celebrating ? 'blur(12px) brightness(0.42)' : 'blur(0px) brightness(1)' }}
        transition={{ duration: reduced ? .2 : matchEnvelope ? 1.1 : celebrating ? .4 : 2, delay: extract && !celebrating ? .4 : 0, x: { duration: reduced ? .2 : matchEnvelope ? 1.1 : 2 }, y: { duration: reduced ? .2 : matchEnvelope ? 1.1 : 2 }, scale: { duration: reduced ? .2 : matchEnvelope && !handoffReady ? 1.1 : .18 } }}>
        <img className="room-image" src={media('closed.webp')} alt="" />
        <motion.img className="room-image" src={media('open.webp')} alt="" initial={{ opacity: 0 }}
          animate={{ opacity: opened ? 1 : 0 }} transition={{ duration: reduced ? .15 : .8 }} />
      </motion.div>
      <div className="vignette" aria-hidden="true" />
      <AnimatePresence>
        {stage === 'film' && <motion.div className="film" key="film" initial={false} animate={{ opacity: matchEnvelope ? 0 : 1 }} exit={{ opacity: 0, transition: { duration: reduced ? .2 : .3 } }}
          transition={{ duration: reduced ? .2 : 1.1 }}>
          <motion.video ref={video} playsInline preload="auto" poster={media('poster.webp')}
            style={{ width: planeW, height: planeH, left: planeX, top: planeY }}
            initial={{ filter: 'blur(110px) brightness(0.32) saturate(0.65)', scale: 1.2 }}
            animate={{ filter: filmEntered ? 'blur(0px) brightness(1)' : 'blur(110px) brightness(0.32) saturate(0.65)', scale: filmEntered ? 1 : 1.2 }} transition={{ duration: 1.4 }}
            onPause={() => { if (entered.current && !filmFinished.current && !video.current?.ended) setPlayBlocked(true) }}
            onEnded={() => { trackEvent('scene01_complete'); filmFinished.current = true; track.current.releaseVideo(video.current); setFilmEnded(true) }}
            onError={() => setVideoFailed(true)} src={`${media('opening.mp4')}?v=original-audio`} />
          <motion.div className="entry-background" aria-hidden="true" initial={false} animate={{ opacity: filmEntered ? 0 : 1 }} transition={{ duration: 1.6 }} />
          <AnimatePresence>{entryRevealed && !filmEntered && <motion.div className="entry-copy" initial={false} animate={{ opacity: filmStarting ? 0 : 1 }} exit={{ opacity: 0 }} transition={{ duration: .5 }}>
            <motion.p initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? .1 : 1, delay: reduced ? 0 : .4 }}>Hi, it’s Claire.</motion.p>
            <motion.p initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? .1 : 1, delay: reduced ? 0 : 1.25 }}>I made something for you.</motion.p>
            <motion.div className="entry-ornament" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .9, delay: reduced ? 0 : 2.1 }}><span /><svg viewBox="0 0 40 40"><path d="M20 34 5 19C-5 7 12-3 20 9 28-3 45 7 35 19Z" /></svg><span /></motion.div>
          </motion.div>}</AnimatePresence>
          {entryRevealed && (!filmEntered || playBlocked || videoFailed) && !assetFailed && <button className={`film-start${!filmEntered && !videoFailed ? ' entry-button' : ''}`} disabled={filmStarting || (videoFailed && !assetsReady)} onClick={enterFilm}>
            {videoFailed ? 'Open your invitation' : filmEntered ? 'Resume' : 'Come in'}
          </button>}
          {assetFailed && <button className="film-start" onClick={() => window.location.reload()}>Try loading your invitation again</button>}
        </motion.div>}
      </AnimatePresence>
      <motion.img ref={matchImage} className="match-envelope" src={media('sealed.webp')} alt="" aria-hidden="true"
        onLoad={() => { void matchImage.current?.decode().then(() => setMatchDecoded(true)).catch(() => setAssetFailed(true)) }}
        initial={false}
        animate={matchEnvelope ? { left: planeX + planeW * .335, top: planeY + planeH * .4 - planeW * .4 * .129, width: planeW * .4, opacity: handoffReady ? 0 : 1 } : { left: planeX + planeW * .21, top: planeY + planeH * .27 - planeW * .60 * .129, width: planeW * .60, opacity: 0 }}
        transition={{ duration: reduced ? .2 : 1.1, opacity: { duration: .35 } }} />
      {stage === 'envelope' && <>
        <motion.button ref={openButton} className="envelope-hit" disabled={!handoffReady} aria-label="Open your invitation"
          style={{ left: planeX + planeW * .335, top: planeY + planeH * .40, width: planeW * .40, height: planeH * .365 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? .2 : .4 }}
          onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerCancel={() => setPressed(false)} onPointerLeave={() => setPressed(false)} onClick={openEnvelope} />
        <motion.p className="open-hint" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
          style={{ top: Math.min(h - 65, planeY + planeH * .79) }} transition={{ duration: .9, delay: reduced ? .2 : .4 }}>Whenever you’re ready.</motion.p>
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
          <div className="invitation-copy" style={{ visibility: stage === 'invitation-card' ? 'visible' : 'hidden' }} aria-hidden={stage !== 'invitation-card'}>
            <motion.p className="salutation" initial={{ opacity: 0 }} animate={reveal(1)} transition={{ duration: reduced ? .1 : .9 }}>For Colette</motion.p>
            <motion.p className="introduction" initial={{ opacity: 0 }} animate={reveal(2)} transition={{ duration: reduced ? .1 : .9 }}>I know we're already going…</motion.p>
            <motion.p className="introduction invitation-properly" initial={{ opacity: 0 }} animate={reveal(3)} transition={{ duration: reduced ? .1 : .9 }}>but I still wanted to ask properly.</motion.p>
            <motion.h1 initial={{ opacity: 0 }} animate={reveal(4)} transition={{ duration: reduced ? .1 : 1 }}>Shall we make these few days in Hong Kong<br />our little getaway?</motion.h1>
            <motion.div initial={false} animate={{ opacity: copy >= 5 && stage === 'invitation-card' ? 1 : 0, y: copy >= 5 || reduced ? 0 : 6 }} transition={{ duration: .8 }} aria-hidden={copy < 5 || stage !== 'invitation-card'} inert={copy < 5 || stage !== 'invitation-card'}>
              <Answers reduced={reduced} active={copy >= 5 && stage === 'invitation-card'} onYes={() => { trackEvent('invitation_yes'); playCelebration() }} />
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
        <motion.div className="celebration-picture" style={{ transformOrigin: w < 600 ? '16% 12%' : '16% 55%' }} initial={false}
          animate={{ filter: exploring ? 'blur(0px) brightness(0.94)' : oliveFocus ? 'blur(2px) brightness(0.86)' : stationery ? w < 600 ? 'blur(5px) brightness(0.72)' : 'blur(6px) brightness(0.72)' : 'blur(0px) brightness(1)', scale: exploring ? 1 : oliveFocus ? 1.12 : stationery ? 1.015 : 1, x: oliveFocus ? w * .055 : 0, y: oliveFocus && w >= 600 ? -8 : 0 }}
          transition={{ duration: reduced ? .2 : 1.25, scale: { duration: reduced ? .2 : oliveFocus || stage === 'hidden-letter' ? 1.4 : 24, ease: oliveFocus ? ease : 'linear' }, x: { duration: 1.4 }, y: { duration: 1.4 } }}>
          <div className="celebration-fill" style={{ backgroundImage: `url(${media('celebration-poster.jpg')})` }} aria-hidden="true" />
          <video ref={celebration} className="celebration-video" style={{ visibility: postFrameReady ? 'hidden' : 'visible', opacity: stationery ? 0 : 1, transition: 'opacity .6s' }} playsInline preload="auto" poster={media('celebration-poster.jpg')}
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
          <motion.img className="post-celebration-image" src={media('celebration-room.jpg')} alt="" initial={false} animate={{ opacity: stationery ? 1 : 0 }} transition={{ duration: .6 }} />
        </motion.div>
        {stage === 'celebration-video' && <div className="celebration-copy" aria-live="polite">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: titleVisible && celebrationTime >= titleStart ? 1 : 0, y: celebrationTime >= titleStart ? 0 : 10 }} transition={{ duration: titleVisible ? .8 : .3 }}>Thank you for saying yes.</motion.p>
          <motion.p className="celebration-next" initial={{ opacity: 0, y: 10 }} animate={{ opacity: titleVisible && celebrationTime >= titleStart + .7 ? 1 : 0, y: celebrationTime >= titleStart + .7 ? 0 : 10 }} transition={{ duration: titleVisible ? .8 : .3 }}>Now let me make sure I've got the rest right.</motion.p>
        </div>}
        {stage === 'celebration-video' && celebrationBlocked && !celebrationEnded && <button className="film-start celebration-resume" disabled={celebrationStarting} onClick={playCelebration}>
          {celebrationFailed ? 'Try the celebration again' : celebrationEntered.current ? 'Resume' : 'Begin celebration'}
        </button>}
      </motion.section>
      <AnimatePresence>
      {stage === 'meeting-confirmation' && <motion.article key="meeting" ref={meetingCard} className="invitation-card meeting-card" style={{ ...paperEnd, top: (h - targetHeight) / 2, zIndex: 6 }} tabIndex={-1} aria-label="Meeting confirmation"
        initial={{ opacity: 0, scale: .97, y: reduced ? 0 : 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -6 }} transition={{ duration: reduced ? .2 : .8 }}>
        <img className="paper" src={media('card.webp')} alt="" />
        <div className="invitation-copy meeting-copy">
          <motion.p className="meeting-introduction" animate={{ opacity: meetingCopy >= 1 ? 1 : 0, y: meetingCopy >= 1 ? 0 : 8 }} transition={{ duration: .8 }}>Just to make sure I've got it right…</motion.p>
          <motion.h1 animate={{ opacity: meetingCopy >= 2 ? 1 : 0, y: meetingCopy >= 2 ? 0 : 8 }} transition={{ duration: .8 }}>October 22, 12:00 PM —<br />Hong Kong Airport?</motion.h1>
          <motion.div className="meeting-answers" animate={{ opacity: meetingCopy >= 3 ? 1 : 0 }} transition={{ duration: .8 }} inert={meetingCopy < 3}>
            <button className="answer yes-answer" aria-pressed={meetingChoice === 'confirmed'} disabled={meetingCopy < 3 || meetingChoice !== null} onClick={() => { trackEvent('meeting_confirm'); setMeetingConfirmed(true); setMeetingChoice('confirmed'); setStage('food-choice') }}>Yes, see you then ♡</button>
            <button className="answer" disabled={meetingCopy < 3 || meetingChoice !== null} aria-pressed={meetingChoice === 'adjust'} onClick={() => { trackEvent('meeting_adjust'); setMeetingChoice('adjust') }}>Let's adjust it</button>
          </motion.div>
          <p className="meeting-status" role="status" style={meetingChoice === 'adjust' ? { height: 40 } : undefined}>{meetingChoice === 'confirmed' ? 'See you then ♡' : meetingChoice === 'adjust' ? <>Of course —<br />we’ll figure it out together. ♡</> : ''}</p>
        </div>
      </motion.article>}
      {(stage === 'food-choice' || stage === 'final-summary') && <motion.article key={stage} ref={nextCard} className="invitation-card meeting-card" style={{ ...paperEnd, width: targetWidth * (stage === 'final-summary' ? .86 : 1), height: targetHeight * (stage === 'final-summary' ? .86 : 1), left: (w - targetWidth * (stage === 'final-summary' ? .86 : 1)) / 2, top: (h - targetHeight * (stage === 'final-summary' ? .86 : 1)) / 2, zIndex: 6 }} tabIndex={-1} aria-label={stage === 'food-choice' ? 'Food choice' : 'Our plans'}
        initial={{ opacity: 0, scale: .97, y: reduced ? 0 : 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -6 }} transition={{ duration: reduced ? .2 : .8 }}>
        <img className="paper" src={media('card.webp')} alt="" />
        {stage === 'food-choice' ? <div className="invitation-copy food-copy">
          <motion.p className="meeting-introduction" initial={{ opacity: 0 }} animate={{ opacity: foodCopy >= 1 ? 1 : 0 }} transition={{ duration: .6 }}>Okay, one more very important question…</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: foodCopy >= 2 ? 1 : 0, y: foodCopy >= 2 ? 0 : 6 }} transition={{ duration: .6 }}>What should we eat?</motion.h1>
          <div className="food-choices">
            {foodChoices.map((choice, i) => <motion.button key={choice} className="answer" initial={{ opacity: 0, y: 6 }} animate={{ opacity: foodCopy >= 3 + Math.floor(i / 2) ? 1 : 0, y: foodCopy >= 3 + Math.floor(i / 2) ? 0 : 6 }} transition={{ duration: .6 }} disabled={foodChoice !== null || foodCopy < 3 + Math.floor(i / 2)} aria-pressed={foodChoice === choice} onClick={() => { trackEvent('food_choice', choice); setFoodChoice(choice) }}>{choice}</motion.button>)}
          </div>
          <motion.p className="dessert-note" role="status" initial={{ opacity: 0, y: 6 }} animate={{ opacity: foodChoice ? 1 : 0, y: foodChoice ? 0 : 6 }} transition={{ duration: .4 }}>And maybe dessert after? :)</motion.p>
        </div> : <div className="invitation-copy summary-copy">
          <h1>October 22</h1>
          <p>{meetingConfirmed ? '12:00 PM · Hong Kong Airport' : 'Hong Kong Airport · We’ll confirm the time together'}</p>
          <p className="first-stop">First stop:<br /><span>{foodChoice === "We can decide later" ? "We'll decide together ♡" : foodChoice}</span></p>
        </div>}
      </motion.article>}
      </AnimatePresence>
      <AnimatePresence>
      {stage === 'olive-npc' && <motion.button key="olive-dialogue" ref={dialogue} className="olive-dialogue" aria-label={`Olive: ${oliveLines[oliveLine]}`} disabled={!oliveReady}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: oliveReady ? 1 : 0, y: oliveReady ? 0 : 12 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: .65 }}
        onClick={() => { if (oliveLine < 2) setOliveLine(oliveLine + 1) }}>
        <motion.span className="olive-name" initial={{ opacity: 0 }} animate={{ opacity: oliveReady ? 1 : 0 }} transition={{ duration: reduced ? .1 : .6, delay: reduced ? 0 : .12 }}>Olive</motion.span>
        <AnimatePresence mode="wait"><motion.span className="olive-line" key={oliveLine} initial={{ opacity: 0, y: 4 }} animate={{ opacity: oliveReady ? 1 : 0, y: oliveReady ? 0 : 4 }} exit={{ opacity: 0, y: -3, transition: { duration: .2, delay: 0 } }} transition={{ duration: reduced ? .1 : .65, delay: reduced ? 0 : .35 }}>{oliveLines[oliveLine]}</motion.span></AnimatePresence>
        {oliveLine < 2 && <motion.span key={`continue-${oliveLine}`} className="dialogue-hint" initial={{ opacity: 0 }} animate={{ opacity: oliveReady ? 1 : 0 }} transition={{ duration: reduced ? .1 : .6, delay: reduced ? 0 : 1 }}>Continue</motion.span>}
      </motion.button>}
      </AnimatePresence>
      {stage === 'olive-npc' && <motion.button className="secret-envelope" aria-label="Open the sealed private letter" disabled={!secretReady} style={secretPosition}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: secretReady ? 1 : 0, y: secretReady ? 0 : 6 }} whileHover={{ y: -4 }} transition={{ duration: .8 }}
        onClick={openPrivateLetter}>
        <img src={media('sealed.webp')} alt="" /><span className="wax-seal" aria-hidden="true" />
      </motion.button>}
      {roomRequested && <motion.img className="room-entry-anchor" src={roomEntry} alt="" aria-hidden="true" onError={() => setRoomEntryReady(true)} onLoad={event => { void event.currentTarget.decode().then(() => setRoomEntryReady(true)).catch(() => setRoomEntryReady(true)) }} initial={{ opacity: 0 }} animate={{ opacity: roomEntryReady ? 1 : 0 }} transition={{ duration: reduced ? .2 : 3 }} />}
      {roomRequested && <Suspense fallback={null}><ExploreRoom active={exploring} blocked={activeFriend !== null} reduced={reduced} mobile={mobile} onReady={() => setRoomReady(true)} onFriend={setActiveFriend} onReadLetter={openPrivateLetter} /></Suspense>}
      <AnimatePresence>
      {stage === 'hidden-letter' && <motion.div key="private-letter-scene" className="private-letter-scene" exit={{ opacity: 0, y: 12, transition: { duration: reduced ? .15 : 1.1 } }}>
        <motion.div className="letter-envelope" initial={{ ...secretPosition, opacity: 1 }} animate={{ left: (w - 260) / 2, top: h / 2 - 110, width: 260, opacity: [1, 1, 0] }} transition={{ duration: 1.9, opacity: { duration: 1.9, times: [0, .85, 1], ease: 'linear' } }} aria-hidden="true">
          <motion.img src={media('sealed.webp')} alt="" initial={{ opacity: 1, rotateX: 0 }} animate={{ opacity: [1, 1, 0], rotateX: [0, 0, 65] }} transition={{ duration: 1.6, times: [0, .6, 1] }} />
          <motion.img src={media('envelope.webp')} alt="" initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 1] }} transition={{ duration: 1.6, times: [0, .6, 1] }} />
          <motion.span className="wax-seal" initial={{ opacity: 1 }} animate={{ opacity: [1, 1, 0], rotate: [0, 0, -12], scale: [1, 1, .94], y: [0, 0, -4] }} transition={{ duration: 1.25, times: [0, .75, 1] }} />
        </motion.div>
        <motion.article ref={letterCard} className="private-letter" tabIndex={-1} aria-label="A letter from Claire" initial={{ opacity: 0, y: 50, scale: .95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 1.1, delay: 1.35 }}>
          <div className="letter-paper" aria-hidden="true" style={{ backgroundImage: `url(${media('card.webp')})` }} />
          <div className="letter-scroll">
            {letterParagraphs.map((paragraph, i) => <motion.p key={i} className={i === 0 ? 'letter-title' : i === 4 ? 'letter-miss' : i === 6 ? 'letter-signature' : i === 7 ? 'letter-date' : undefined} initial={{ opacity: 0, y: 6 }} animate={{ opacity: letterCopy >= i + 1 ? 1 : 0, y: letterCopy >= i + 1 ? 0 : 6 }} transition={{ duration: .6 }}>{paragraph}</motion.p>)}
          </div>
          <button className="letter-close" disabled={!roomReady || !roomEntryReady || letterCopy < letterParagraphs.length} onClick={() => { track.current.play('slide'); setStage('room-explore') }}>Fold away</button>
        </motion.article>
      </motion.div>}
      </AnimatePresence>
      {exploring && activeFriend !== null && <button className="npc-dismiss" aria-label="Close animal dialogue" onClick={() => setActiveFriend(null)} />}
      {exploring && <button className="saved-letter" aria-label="Read Claire's letter again" onClick={openPrivateLetter}><img src={media('sealed.webp')} alt="" /><span>Claire’s letter</span></button>}
      <AnimatePresence mode="wait">
        {exploring && activeFriend !== null && <motion.section key={activeFriend} className="olive-dialogue friend-dialogue" role="dialog" aria-label={`A wish from ${friends[activeFriend].name}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: .3 }}>
          <span className="olive-name">{friends[activeFriend].name}</span>
          <p className="olive-line">{friends[activeFriend].line}</p>
          <button className="friend-close" onClick={() => setActiveFriend(null)}>Close</button>
        </motion.section>}
      </AnimatePresence>

      <AnimatePresence>
        {mobile && orientationGate && <motion.section className="orientation-overlay" role="dialog" aria-modal="true" aria-label="A little preparation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .45 }}>
          <AnimatePresence mode="wait">
            {w < h ? <motion.div key="portrait" className="orientation-copy" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .4 }}>
              <svg className="rotation-icon" viewBox="0 0 80 80" aria-hidden="true"><rect x="28" y="15" width="24" height="46" rx="4" /><path d="M36 55h8M12 35a28 28 0 0 1 43-23M55 4v9H46M68 45a28 28 0 0 1-43 23M25 76v-9h9" /></svg>
              <h2>One tiny thing…</h2>
              <p>For the best view,<br />turn off Portrait Orientation Lock<br />and rotate your phone sideways.</p>
            </motion.div> : <motion.button key="landscape" className="orientation-continue" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .45 }} onClick={continueMobile}>Continue</motion.button>}
          </AnimatePresence>
        </motion.section>}
      </AnimatePresence>
      <button className="fullscreen-toggle" aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} aria-pressed={fullscreen} title="Fullscreen · F / Command + 9" onClick={() => { void toggleFullscreen() }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={fullscreen ? 'M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6' : 'M3 9V3h6M15 3h6v6M3 15v6h6M15 21h6v-6'} /></svg>
      </button>
      {!mobile && fullscreenError && <p className="fullscreen-error" role="status">{fullscreenError}</p>}
      <div className="music-control" onKeyDown={event => { if (event.key === 'Escape') setMusicOpen(false) }}>
        <button className="music-toggle" aria-label="Music settings" aria-expanded={musicOpen} aria-controls="music-panel" onClick={() => setMusicOpen(!musicOpen)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13M9 8l11-2" /><ellipse cx="6" cy="18" rx="3" ry="2" /><ellipse cx="17" cy="16" rx="3" ry="2" />{!musicEnabled && <path d="M3 3 21 21" />}</svg>
        </button>
        {musicOpen && <div id="music-panel" className="music-panel">
          <div className="music-panel-heading"><span>Music</span><button className="music-switch" aria-pressed={musicEnabled} onClick={() => { const enabled = !musicEnabled; setMusicEnabled(enabled); track.current.setMusicEnabled(enabled) }}>{musicEnabled ? 'On' : 'Off'}</button></div>
          <label htmlFor="music-volume">Volume <span>{musicVolume}%</span></label>
          <input id="music-volume" type="range" min="0" max="100" value={musicVolume} onChange={event => { const volume = Number(event.target.value); setMusicVolume(volume); track.current.setMusicVolume(volume / 100) }} />
          <p>Softens during films.</p>
        </div>}
      </div>
    </main>
  </MotionConfig>
}
