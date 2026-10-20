import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { roomEntry } from './roomAssets'
import { interactionAssets as art } from './roomInteractionAssets'
import { LetterViewer, PaperDialog } from './LetterViewer'
import { CharacterDialogue, scenePointToViewport, type Placement, type SceneRect } from './CharacterDialogue'
import { saveRoomNote } from './roomApi'
import { getSubmissionIdentity } from './analytics'
import './room.css'

type Friend = { name: string; line: string; x: number; y: number }
type Story = 'closed' | 'before' | 'offered' | 'viewer' | 'after' | 'compose' | 'kept'
const before = ['…oh.\nYou caught me.', 'I was keeping something safe.']
const offeredLine = 'Fine. You can read it.\nBut I’m taking it back afterwards.'
// Measured against the supplied final image. Faces remain protected when the room is cropped.
const characters = [
  { anchor: { x: .33, y: .49 }, placement: 'above-right', face: { left: .224, top: .475, width: .105, height: .187 }, width: .23, height: .36 },
  { anchor: { x: .69, y: .45 }, placement: 'left', face: { left: .69, top: .075, width: .12, height: .225 }, width: .21, height: .40 },
  { anchor: { x: .70, y: .49 }, placement: 'above-left', face: { left: .688, top: .53, width: .10, height: .15 }, width: .22, height: .35 },
  { anchor: { x: .47, y: .49 }, placement: 'above', face: { left: .414, top: .521, width: .105, height: .151 }, width: .18, height: .34 },
] satisfies { anchor: { x: number; y: number }; placement: Placement; face: SceneRect; width: number; height: number }[]
const position = (u: number, v: number, width: number, height: number): CSSProperties => ({ left: `${u * 100}%`, top: `${v * 100}%`, width: `${width * 100}%`, height: `${height * 100}%` })

export default function FinalRoom({ active, reading, mobile, reduced, w, h, friends, onReady, onReadLetter }: { active: boolean; reading: boolean; mobile: boolean; reduced: boolean; w: number; h: number; friends: Friend[]; onReady: () => void; onReadLetter: () => void }) {
  const [ready, setReady] = useState(false), [story, setStory] = useState<Story>('closed'), [line, setLine] = useState(0), [friend, setFriend] = useState<number | null>(null)
  const [draft, setDraft] = useState(''), [letterId, setLetterId] = useState(() => crypto.randomUUID()), [letterBusy, setLetterBusy] = useState(false), [letterError, setLetterError] = useState('')
  const [noteReady, setNoteReady] = useState(false), [noteDismissed, setNoteDismissed] = useState(false)
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>()
  const [projection, setProjection] = useState(() => ({ scene: { left: 0, top: 0, width: w, height: h }, viewport: { left: 0, top: 0, width: w, height: h }, controls: [] as SceneRect[] }))
  const [rating, setRating] = useState<number | null>(null), [hoverRating, setHoverRating] = useState<number | null>(null), [message, setMessage] = useState(''), [feedbackBusy, setFeedbackBusy] = useState(false), [ratingBusy, setRatingBusy] = useState(false), [feedbackError, setFeedbackError] = useState(''), [received, setReceived] = useState(false), [outroRevealed, setOutroRevealed] = useState(false)
  const [feedbackId, setFeedbackId] = useState(() => crypto.randomUUID()), [swipeHint, setSwipeHint] = useState(true)
  const [letterIdentity, setLetterIdentity] = useState(getSubmissionIdentity), [feedbackIdentity, setFeedbackIdentity] = useState(getSubmissionIdentity)
  const scroller = useRef<HTMLDivElement>(null), plane = useRef<HTMLDivElement>(null), room = useRef<HTMLElement>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve()), lastRating = useRef(0)
  const ratio = imageSize ? imageSize.width / imageSize.height : w / h
  const sceneW = Math.max(w, h * ratio), sceneH = sceneW / ratio
  const orion = friends[1]
  const focused = story !== 'closed', modal = story === 'viewer' || story === 'compose'
  const storyDialogue = ['before', 'offered', 'after', 'kept'].includes(story)
  const activeCharacter = storyDialogue ? 1 : friend
  const selectedCharacter = useRef(activeCharacter)
  selectedCharacter.current = focused ? 1 : friend
  const showNote = noteReady && !noteDismissed && !focused && friend === null && active
  const attemptedLetter = useRef<string | null>(null)
  useLayoutEffect(() => {
    const selected = selectedCharacter.current
    if (scroller.current) scroller.current.scrollLeft = Math.max(0, selected === null ? (sceneW - w) / 2 : sceneW * friends[selected].x / 100 - w * .55)
  }, [sceneW, w, friends])
  useLayoutEffect(() => {
    const surface = plane.current, viewport = room.current, scroll = scroller.current
    if (!surface || !viewport || !scroll) return
    const controls = Array.from(document.querySelectorAll<HTMLElement>('.music-control,.fullscreen-toggle'))
    let frame = 0
    const measure = () => {
      frame = 0
      const scene = surface.getBoundingClientRect(), view = viewport.getBoundingClientRect()
      setProjection({ scene: { left: scene.left, top: scene.top, width: scene.width, height: scene.height }, viewport: { left: view.left, top: view.top, width: view.width, height: view.height }, controls: controls.map(control => { const rect = control.getBoundingClientRect(); return { left: rect.left, top: rect.top, width: rect.width, height: rect.height } }) })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
    const observer = new ResizeObserver(schedule)
    observer.observe(surface); observer.observe(viewport)
    controls.forEach(control => observer.observe(control))
    scroll.addEventListener('scroll', schedule, { passive: true })
    measure()
    return () => { observer.disconnect(); scroll.removeEventListener('scroll', schedule); cancelAnimationFrame(frame) }
  }, [])
  useEffect(() => { if (!active) return; setSwipeHint(true); const hint = setTimeout(() => setSwipeHint(false), 8000); return () => clearTimeout(hint) }, [active])
  useEffect(() => {
    if (story !== 'kept') return
    const timer = setTimeout(() => { setStory('closed'); setNoteReady(true); if (!received) setNoteDismissed(false) }, 2300)
    return () => clearTimeout(timer)
  }, [story, received])
  useEffect(() => {
    if (!received) return
    const reveal = setTimeout(() => setOutroRevealed(true), 700)
    const dismiss = setTimeout(() => setNoteDismissed(true), 3200)
    return () => { clearTimeout(reveal); clearTimeout(dismiss) }
  }, [received])
  const openCharacter = (index: number) => {
    setSwipeHint(false)
    if (index === 1) { setFriend(null); setLine(0); setStory('before') }
    else { setStory('closed'); setFriend(index) }
    scroller.current?.scrollTo({ left: Math.max(0, sceneW * friends[index].x / 100 - w * .55), behavior: reduced ? 'auto' : 'smooth' })
  }
  const reopenNote = () => {
    if (received) {
      setFeedbackId(crypto.randomUUID()); setFeedbackIdentity(getSubmissionIdentity())
      setMessage(''); setReceived(false); setOutroRevealed(false)
    }
    setFeedbackError(''); setNoteDismissed(false)
  }
  const finishStory = () => { setStory('closed'); setNoteReady(true); if (!received) setNoteDismissed(false) }
  const next = () => {
    if (story === 'before') { if (line < before.length - 1) setLine(line + 1); else setStory('offered') }
  }
  const returnLetter = () => { setLine(0); setStory('after') }
  const keepLetter = async () => {
    if (!draft.trim() || letterBusy) return
    setLetterBusy(true); setLetterError(''); attemptedLetter.current = draft
    try { await saveRoomNote('private-letter', { id: letterId, content: draft }, letterIdentity); setDraft(''); attemptedLetter.current = null; setLetterId(crypto.randomUUID()); setLetterIdentity(getSubmissionIdentity()); setStory('kept') }
    catch (error) { setLetterError(error instanceof Error ? error.message : 'Your words are still here. Please try again.') }
    finally { setLetterBusy(false) }
  }
  const rate = (value: number) => {
    if (received || feedbackBusy) return
    setRating(value); setRatingBusy(true); setFeedbackError('')
    const revision = ++lastRating.current
    queue.current = queue.current.catch(() => {}).then(() => saveRoomNote('feedback', { id: feedbackId, rating: value }, feedbackIdentity)).catch(error => { if (revision === lastRating.current) setFeedbackError(error.message) }).finally(() => { if (revision === lastRating.current) setRatingBusy(false) })
  }
  const sendFeedback = async () => {
    if (feedbackBusy || (!rating && !message.trim())) return
    setFeedbackBusy(true); setFeedbackError('')
    try { await queue.current; await saveRoomNote('feedback', { id: feedbackId, rating, message, sealed: true }, feedbackIdentity); setReceived(true) }
    catch (error) { setFeedbackError(error instanceof Error ? error.message : 'Your note is still here. Please try again.') }
    finally { setFeedbackBusy(false) }
  }
  const backdropFilter = reading ? 'blur(2px) brightness(1)' : modal ? 'blur(4px) brightness(.62)' : activeCharacter !== null ? 'blur(0px) brightness(.96)' : 'blur(0px) brightness(1)'
  const faces = characters.map(({ face }) => {
    const point = scenePointToViewport({ x: face.left, y: face.top }, projection.scene)
    return { left: point.x, top: point.y, width: face.width * projection.scene.width, height: face.height * projection.scene.height }
  })
  const bodies = friends.map((item, i) => {
    const point = scenePointToViewport({ x: item.x / 100 - characters[i].width / 2, y: item.y / 100 - characters[i].height / 2 }, projection.scene)
    return { left: point.x, top: point.y, width: characters[i].width * projection.scene.width, height: characters[i].height * projection.scene.height }
  })
  const dialogue = friend !== null ? friends[friend].line : story === 'before' ? before[line] : story === 'offered' ? offeredLine : story === 'after' ? <>I’ll keep this one safe.<br />And if another one happens to appear… I won’t complain.</> : 'Orion will keep this one safe too.'
  const dialogueActions = friend !== null ? <button onClick={() => setFriend(null)}>Close</button> : story === 'before' ? <button onClick={next}>Continue</button> : story === 'offered' ? <button onClick={() => setStory('viewer')}>Read the letter</button> : story === 'after' ? <><button onClick={() => { setLetterError(''); setStory('compose') }}>Write something ♡</button><button onClick={finishStory}>Maybe another time</button></> : undefined
  return <section ref={room} data-mobile={mobile} className={`final-room${active ? ' is-active' : ''}${showNote ? ' is-note-open' : ''}${activeCharacter !== null ? ' is-talking' : ''}`} aria-label="The final room" aria-hidden={!active && !reading} onKeyDown={event => { if (event.key === 'Escape' && !modal) { if (showNote && !feedbackBusy) setNoteDismissed(true); setFriend(null); setStory('closed') } }}>
    <div className="scene-scroll" ref={scroller} inert={!active || modal || reading || showNote}>
      <motion.div ref={plane} className="final-scene-plane" style={{ width: sceneW, height: sceneH, top: mobile && w > h ? 0 : (h - sceneH) / 2 }} animate={{ filter: backdropFilter }} transition={{ duration: reduced ? .1 : .25 }}>
        <motion.img className="room-entry-anchor" src={roomEntry} alt="" aria-hidden="true" onError={() => { setReady(true); onReady() }} onLoad={event => { const image = event.currentTarget; setImageSize({ width: image.naturalWidth, height: image.naturalHeight }); void image.decode().catch(() => {}).then(() => { setReady(true); onReady() }) }} initial={{ opacity: 0 }} animate={{ opacity: ready ? 1 : 0 }} transition={{ duration: reduced ? .15 : 3 }} />
        {active && <div className="room-object-layer">
          {friends.map((item, index) => <button key={item.name} className={`friend-spot character-spot${activeCharacter === index ? ' is-speaking' : ''}${swipeHint ? ' is-inviting' : ''}`} style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${characters[index].width * 100}%`, height: `${characters[index].height * 100}%` }} aria-label={index === 1 ? 'Orion' : `Talk to ${item.name}`} aria-expanded={activeCharacter === index} onClick={() => openCharacter(index)}>
            <span className="character-cue" aria-hidden="true">…</span>
          </button>)}
          {(story === 'offered') && <motion.button className="orion-kept-letter scene-prop" aria-label="Read the letter Orion was keeping" style={position(orion.x / 100,.48,.075,.145)} initial={{ opacity: 0, y: -8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .8 }} onClick={() => setStory('viewer')}><img src={art.letter} alt="" /><span>A letter for Claire</span></motion.button>}
        </div>}
      </motion.div>
    </div>
    {active && <div className="final-room-interface" inert={modal}>
      {swipeHint && mobile && sceneW > w + 80 && !focused && <p className="scene-swipe-hint">Take your time. Swipe to look around.</p>}
      <AnimatePresence mode="wait">
        {activeCharacter !== null && <CharacterDialogue key={friends[activeCharacter].name} character={friends[activeCharacter].name} anchor={characters[activeCharacter].anchor} placement={characters[activeCharacter].placement} scene={projection.scene} viewport={projection.viewport} faces={faces} speakerFace={faces[activeCharacter]} bodies={bodies} controls={projection.controls} mobile={mobile} reduced={reduced} dialogue={dialogue} actions={dialogueActions} onClose={story === 'kept' ? undefined : () => { setFriend(null); setStory('closed') }} />}
      </AnimatePresence>
      <AnimatePresence>
        {showNote && <PaperDialog key="author-note" label="A tiny note from Claire" onClose={() => { if (!feedbackBusy) setNoteDismissed(true) }} className="author-note-dialog" fitVisualViewport><aside className="author-note">
          {received ? <div className="author-receipt" role="status" aria-live="polite">
            <p className="author-filed">Filed for review. ♡<br /><span>No promises.</span></p>
            <motion.p className="author-afterword" aria-hidden={!outroRevealed} initial={{ opacity: 0 }} animate={{ opacity: outroRevealed ? 1 : 0 }} transition={{ duration: .5 }}>Will this little place keep changing?<br />Guess we’ll find out.</motion.p>
          </div> : <>
            <button className="author-note-close" aria-label="Close Claire’s note" disabled={feedbackBusy} onClick={() => setNoteDismissed(true)}>×</button>
            <h2>A tiny note from Claire</h2>
            <p>I could have just sent you an invitation.<br />But that felt a little too ordinary.</p>
            <p>So I made you this little place instead —<br />mostly because I thought it would be more fun this way.</p>
            <p className="author-business">Anyway. Very important business now:</p>
            <p className="rating-question">How was your stay?</p>
            <div className="experience-stars" role="group" aria-label="How was your stay?" onMouseLeave={() => setHoverRating(null)}>{[1,2,3,4,5].map(value => <button key={value} aria-label={`${value} ${value===1?'star':'stars'}`} aria-pressed={rating===value} disabled={feedbackBusy} className={value <= (hoverRating ?? rating ?? 0) ? 'is-chosen' : ''} onMouseEnter={() => setHoverRating(value)} onFocus={() => setHoverRating(value)} onBlur={() => setHoverRating(null)} onClick={() => rate(value)}>★</button>)}</div>
            {ratingBusy && <span className="room-sr-only" role="status">Saving your stars…</span>}
            <label className="author-message-label" htmlFor="author-message">Anything else for the author? <span>· optional</span></label>
            <textarea className="author-message" id="author-message" placeholder="complaints, compliments, bribes…" maxLength={8000} value={message} onChange={e => setMessage(e.target.value)} disabled={feedbackBusy} />
            <small className="author-message-note">I’ll read whatever you leave here.</small>
            <button className="author-submit paper-action" disabled={feedbackBusy || (!rating && !message.trim())} onClick={() => void sendFeedback()}>{feedbackBusy ? 'Filing…' : 'File it ♡'}</button>
            {feedbackError && <p className="room-form-error" role="alert">{feedbackError}</p>}
            <footer className="author-footnote"><p><em>Official notice:</em><br />The author is not currently accepting revision requests.<br />Exceptions may be made if properly motivated.</p><p>What counts as “motivation” will remain classified. :)</p></footer>
          </>}
        </aside></PaperDialog>}
      </AnimatePresence>
      {noteReady && !showNote && !focused && friend === null && <button className="author-note-reopen" aria-label="Open Claire’s note" onClick={reopenNote}><svg viewBox="0 0 24 20" width="21" height="18" aria-hidden="true"><path d="M2 3h20v14H2zM2 3l10 8L22 3" /></svg><span>Claire’s note</span></button>}
      <button className="saved-letter" aria-label="Read Claire's letter again" onClick={() => { setStory('closed'); setFriend(null); onReadLetter() }}><img src={`${import.meta.env.BASE_URL}media/sealed.webp`} alt="" /><span>Claire’s letter</span></button>
    </div>}
    <AnimatePresence>
      {active && story === 'viewer' && <LetterViewer src={art.letter} onClose={returnLetter} />}
      {active && story === 'compose' && <PaperDialog label="For Claire" onClose={() => { if (!letterBusy) finishStory() }} className="private-letter-composer"><div className="private-writing-paper"><h2>For Claire</h2><label className="room-sr-only" htmlFor="private-letter-content">Your private letter to Claire</label><textarea id="private-letter-content" maxLength={12000} placeholder={'Write whatever you want.\nIt doesn’t have to be perfect.'} value={draft} disabled={letterBusy} onChange={e=>{ const value=e.target.value; if (attemptedLetter.current !== null && attemptedLetter.current !== value) { setLetterId(crypto.randomUUID()); setLetterIdentity(getSubmissionIdentity()); attemptedLetter.current=null; setLetterError('') }; setDraft(value) }} /><div className="private-letter-actions"><button className="paper-action" disabled={letterBusy||!draft.trim()} onClick={() => void keepLetter()}>{letterBusy?'Keeping it safe…':'Keep it here ♡'}</button><button disabled={letterBusy} onClick={finishStory}>Not now</button></div>{letterError && <p className="room-form-error" role="alert">{letterError}</p>}</div></PaperDialog>}
    </AnimatePresence>
  </section>
}
