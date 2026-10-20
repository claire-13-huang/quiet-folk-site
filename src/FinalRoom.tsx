import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { roomEntry } from './roomAssets'
import { interactionAssets as art } from './roomInteractionAssets'
import { LetterViewer, PaperDialog } from './LetterViewer'
import { saveRoomNote } from './roomApi'
import { getSubmissionIdentity } from './analytics'
import './room.css'

type Friend = { name: string; line: string; x: number; y: number }
type Story = 'closed' | 'before' | 'offered' | 'viewer' | 'after' | 'question' | 'compose' | 'kept'
const before = ['…oh.\nYou caught me.', 'I was keeping something safe.', 'Fine. You can read it.\nBut I’m taking it back afterwards.']
const after = ['I’ll keep it safe for Claire.', 'I’m kind of waiting for your next one too, hhh.']
const position = (u: number, v: number, width: number, height: number): CSSProperties => ({ left: `${u * 100}%`, top: `${v * 100}%`, width: `${width * 100}%`, height: `${height * 100}%` })

export default function FinalRoom({ active, reading, mobile, reduced, w, h, friends, onReady, onReadLetter }: { active: boolean; reading: boolean; mobile: boolean; reduced: boolean; w: number; h: number; friends: Friend[]; onReady: () => void; onReadLetter: () => void }) {
  const [ready, setReady] = useState(false), [story, setStory] = useState<Story>('closed'), [line, setLine] = useState(0), [friend, setFriend] = useState<number | null>(null)
  const [draft, setDraft] = useState(''), [letterId, setLetterId] = useState(() => crypto.randomUUID()), [letterBusy, setLetterBusy] = useState(false), [letterError, setLetterError] = useState('')
  const [noteReady, setNoteReady] = useState(false), [noteDismissed, setNoteDismissed] = useState(false), [feedbackOpen, setFeedbackOpen] = useState(false)
  const [rating, setRating] = useState<number | null>(null), [hoverRating, setHoverRating] = useState<number | null>(null), [message, setMessage] = useState(''), [feedbackBusy, setFeedbackBusy] = useState(false), [ratingBusy, setRatingBusy] = useState(false), [feedbackError, setFeedbackError] = useState(''), [received, setReceived] = useState(false)
  const [feedbackId] = useState(() => crypto.randomUUID()), [swipeHint, setSwipeHint] = useState(true)
  const [letterIdentity, setLetterIdentity] = useState(getSubmissionIdentity), [feedbackIdentity] = useState(getSubmissionIdentity)
  const scroller = useRef<HTMLDivElement>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve()), lastRating = useRef(0)
  const sceneW = Math.max(w, h * 1672 / 941), sceneH = sceneW * 941 / 1672
  const orion = friends[1]
  const focused = story !== 'closed', storyModal = story === 'viewer' || story === 'compose', modal = storyModal || feedbackOpen
  const showNote = noteReady && !noteDismissed && !focused && !feedbackOpen && !received && friend === null && active
  const attemptedLetter = useRef<string | null>(null)
  useLayoutEffect(() => { if (scroller.current) scroller.current.scrollLeft = Math.max(0, (sceneW - w) / 2) }, [sceneW, w])
  useEffect(() => { if (!active) return; setSwipeHint(true); const timer = setTimeout(() => setNoteReady(true), 45000); const hint = setTimeout(() => setSwipeHint(false), 8000); return () => { clearTimeout(timer); clearTimeout(hint) } }, [active])
  useEffect(() => {
    if (story !== 'kept') return
    const timer = setTimeout(() => { setStory('closed'); setNoteReady(true) }, 2300)
    return () => clearTimeout(timer)
  }, [story])
  useEffect(() => {
    if (!received || !feedbackOpen) return
    const timer = setTimeout(() => { setNoteDismissed(true); setFeedbackOpen(false) }, 1800)
    return () => clearTimeout(timer)
  }, [received, feedbackOpen])
  const closeFeedback = () => {
    if (feedbackBusy) return
    if (received) setNoteDismissed(true)
    setFeedbackOpen(false)
  }
  const openOrion = () => {
    setFriend(null); setLine(0); setStory('before')
    scroller.current?.scrollTo({ left: Math.max(0, sceneW * orion.x / 100 - w * .55), behavior: reduced ? 'auto' : 'smooth' })
  }
  const finishStory = () => { setStory('closed'); setNoteReady(true) }
  const next = () => {
    if (story === 'before') { if (line < before.length - 1) setLine(v => v + 1); else setStory('offered') }
    else if (story === 'after') { if (line < after.length - 1) setLine(v => v + 1); else setStory('question') }
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
  const backdropFilter = reading ? 'blur(2px) brightness(1)' : storyModal ? 'blur(4px) brightness(.62)' : feedbackOpen ? 'blur(0px) brightness(.9)' : focused ? 'blur(0px) brightness(.87)' : 'blur(0px) brightness(1)'
  return <section className={`final-room${active ? ' is-active' : ''}${showNote ? ' is-note-open' : ''}`} aria-label="The final room" aria-hidden={!active && !reading} onKeyDown={event => { if (event.key === 'Escape' && !modal) { setFriend(null); setStory('closed') } }}>
    <div className="scene-scroll" ref={scroller} inert={!active || modal || reading}>
      <motion.div className="final-scene-plane" style={{ width: sceneW, height: sceneH, top: (h - sceneH) / 2, transformOrigin: `${orion.x}% ${orion.y}%` }} animate={{ scale: focused ? 1.045 : 1, x: focused ? -w * .012 : 0, y: focused ? h * .01 : 0, filter: backdropFilter }} transition={{ duration: reduced ? .15 : .9 }}>
        <motion.img className="room-entry-anchor" src={roomEntry} alt="" aria-hidden="true" onError={() => { setReady(true); onReady() }} onLoad={event => { void event.currentTarget.decode().catch(() => {}).then(() => { setReady(true); onReady() }) }} initial={{ opacity: 0 }} animate={{ opacity: ready ? 1 : 0 }} transition={{ duration: reduced ? .15 : 3 }} />
        {active && <div className="room-object-layer">
          {friends.map((item, index) => <button key={item.name} className={`friend-spot${index === 1 ? ' orion-spot' : ''}`} style={{ left: `${item.x}%`, top: `${item.y}%` }} aria-label={index === 1 ? 'Orion' : `Talk to ${item.name}`} aria-expanded={index === 1 ? focused : friend === index} onClick={() => { if (index === 1) openOrion(); else { setStory('closed'); setFriend(index) } }}>
            {index !== 1 && <span className="friend-cue" aria-hidden="true" style={{ top: Math.max(0, 12 - (h - sceneH) / 2 - sceneH * (item.y / 100 - .16)) }}><svg viewBox="0 0 30 24"><path d="M5 2h20a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H14l-5 4v-4H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Z" /><circle cx="9" cy="10" r="1" /><circle cx="15" cy="10" r="1" /><circle cx="21" cy="10" r="1" /></svg><span>Talk</span></span>}
          </button>)}
          {(story === 'offered') && <motion.button className="orion-kept-letter scene-prop" aria-label="Read the letter Orion was keeping" style={position(orion.x / 100,.48,.075,.145)} initial={{ opacity: 0, y: -8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .8 }} onClick={() => setStory('viewer')}><img src={art.letter} alt="" /><span>A letter for Claire</span></motion.button>}
        </div>}
      </motion.div>
    </div>
    {active && <div className="final-room-interface" inert={modal}>
      {swipeHint && mobile && sceneW > w + 80 && !focused && <p className="scene-swipe-hint">Take your time. Swipe to look around.</p>}
      {friend !== null && <section className="olive-dialogue friend-dialogue" role="dialog" aria-label={`A wish from ${friends[friend].name}`}><span className="olive-name">{friends[friend].name}</span><p className="olive-line">{friends[friend].line}</p><button className="friend-close" onClick={() => setFriend(null)}>Close</button></section>}
      <AnimatePresence mode="wait">
        {(story === 'before' || story === 'after') && <motion.button key={story+line} className="orion-dialogue olive-dialogue" aria-label={`Orion: ${story === 'before' ? before[line] : after[line]}`} onClick={next} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .3 }}><span className="olive-name">Orion</span><p>{story === 'before' ? before[line] : after[line]}</p><span className="dialogue-hint">Continue</span></motion.button>}
        {story === 'offered' && <motion.div key="offered" className="orion-dialogue olive-dialogue" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><span className="olive-name">Orion</span><p>{before[2]}</p><button className="paper-action" onClick={() => setStory('viewer')}>Read the letter</button></motion.div>}
        {story === 'question' && <motion.section key="question" className="orion-dialogue olive-dialogue" aria-label="Orion’s question" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><span className="olive-name">Orion</span><p>Want to leave another one?</p><div className="orion-choices"><button onClick={() => { setLetterError(''); setStory('compose') }}>Maybe I have something to say ♡</button><button onClick={finishStory}>Not now</button></div></motion.section>}
        {story === 'kept' && <motion.section key="kept" className="orion-dialogue olive-dialogue" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><span className="olive-name">Orion</span><p>Orion will keep this one safe too.</p></motion.section>}
      </AnimatePresence>
      {focused && story !== 'kept' && <button className="orion-scene-close" aria-label="Close Orion’s story" onClick={finishStory}>×</button>}
      {showNote && <motion.aside className="author-note" aria-label="A tiny note from Claire" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}>
        <button className="author-note-close" aria-label="Close Claire’s note" disabled={feedbackBusy} onClick={() => setNoteDismissed(true)}>×</button>
          <h2>A tiny note from Claire</h2><p>I could have just sent you an invitation.<br />But that felt a little too ordinary.</p><p>So I made you a tiny place instead —<br />somewhere you could look around, touch things,<br />find little secrets, and leave something behind.</p>
          <p className="rating-question">How did it feel?</p><div className="experience-stars" role="group" aria-label="Rate this little place" onMouseLeave={() => setHoverRating(null)}>{[1,2,3,4,5].map(value => <button key={value} aria-label={`${value} ${value===1?'star':'stars'}`} aria-pressed={rating===value} disabled={feedbackBusy} className={value <= (hoverRating ?? rating ?? 0) ? 'is-chosen' : ''} onMouseEnter={() => setHoverRating(value)} onFocus={() => setHoverRating(value)} onBlur={() => setHoverRating(null)} onClick={() => rate(value)}>★</button>)}</div>
          {ratingBusy && <small className="rating-saved" role="status">Keeping your stars…</small>}{rating && !ratingBusy && !feedbackError && <small className="rating-saved" role="status">Your stars are kept.</small>}
          <button className="feedback-envelope" aria-expanded={feedbackOpen} onClick={() => setFeedbackOpen(true)}><img src={`${import.meta.env.BASE_URL}media/sealed.webp`} alt="" /><span>Leave a note</span></button>
          {feedbackError && <p className="room-form-error" role="alert">{feedbackError}</p>}
      </motion.aside>}
      <button className="saved-letter" aria-label="Read Claire's letter again" onClick={() => { setStory('closed'); setFriend(null); onReadLetter() }}><img src={`${import.meta.env.BASE_URL}media/sealed.webp`} alt="" /><span>Claire’s letter</span></button>
    </div>}
    <AnimatePresence>
      {active && feedbackOpen && <PaperDialog label="A note for Claire" onClose={closeFeedback} className="feedback-paper" fitVisualViewport>
        <div className="private-writing-paper">
          <button className="feedback-paper-close" aria-label="Close your note" disabled={feedbackBusy} onClick={closeFeedback}>×</button>
          <h2>For Claire</h2>
          {received ? <p className="note-received" role="status">Received.<br />I’ll read it soon. ♡</p> : <>
            <p className="feedback-paper-intro">You can leave me anything you want to say.<br />I’ll read it as soon as I see it, and I’ll reply.</p>
            <label className="room-sr-only" htmlFor="experience-note">Your note to Claire</label>
            <textarea id="experience-note" placeholder="Anything you want to say…" maxLength={8000} value={message} onChange={e => setMessage(e.target.value)} disabled={feedbackBusy} />
            <div className="private-letter-actions"><button className="paper-action" disabled={feedbackBusy || (!rating && !message.trim())} onClick={() => void sendFeedback()}>{feedbackBusy ? 'Sealing…' : 'Seal & send ♡'}</button></div>
            {feedbackError && <p className="room-form-error" role="alert">{feedbackError}</p>}
          </>}
        </div>
      </PaperDialog>}
      {active && story === 'viewer' && <LetterViewer src={art.letter} onClose={returnLetter} />}
      {active && story === 'compose' && <PaperDialog label="For Claire" onClose={() => { if (!letterBusy) finishStory() }} className="private-letter-composer"><div className="private-writing-paper"><h2>For Claire</h2><label className="room-sr-only" htmlFor="private-letter-content">Your private letter to Claire</label><textarea id="private-letter-content" maxLength={12000} placeholder={'Write whatever you want.\nIt doesn’t have to be perfect.'} value={draft} disabled={letterBusy} onChange={e=>{ const value=e.target.value; if (attemptedLetter.current !== null && attemptedLetter.current !== value) { setLetterId(crypto.randomUUID()); setLetterIdentity(getSubmissionIdentity()); attemptedLetter.current=null; setLetterError('') }; setDraft(value) }} /><div className="private-letter-actions"><button className="paper-action" disabled={letterBusy||!draft.trim()} onClick={() => void keepLetter()}>{letterBusy?'Keeping it safe…':'Keep it here ♡'}</button><button disabled={letterBusy} onClick={finishStory}>Not now</button></div>{letterError && <p className="room-form-error" role="alert">{letterError}</p>}</div></PaperDialog>}
    </AnimatePresence>
  </section>
}
