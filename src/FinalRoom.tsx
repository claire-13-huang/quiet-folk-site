import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { roomEntry } from './roomAssets'
import { interactionAssets as art } from './roomInteractionAssets'
import { LetterViewer, PaperDialog } from './LetterViewer'
import { CharacterDialogue, scenePointToViewport, type Placement, type SceneRect } from './CharacterDialogue'
import { saveRoomNote, manageRoomNote, RoomNoteError } from './roomApi'
import { getSubmissionIdentity } from './analytics'
import { readRoomArchive, newRoomArchive, writeRoomArchive, type RoomArchive, type ArchivedNote, type NoteKind } from './roomArchive'
import { RoomArchiveDialog } from './RoomArchiveDialog'
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
  const [loaded] = useState(() => { try { return {data:readRoomArchive(),error:''} } catch(error) { return {data:newRoomArchive(),error:error instanceof Error?error.message:'This browser could not keep your file.'} } })
  const [archive,setArchive] = useState(loaded.data), archiveRef=useRef(loaded.data)
  const [storageError,setStorageError]=useState(loaded.error), [archiveOpen,setArchiveOpen]=useState(loaded.data.view==='archive')
  const updateArchive = (change:(value:RoomArchive)=>RoomArchive) => {
    const next=change(archiveRef.current);archiveRef.current=next
    try {writeRoomArchive(next);setStorageError('')} catch {setStorageError('This browser could not keep your file after a refresh. Your words are still here.')}
    setArchive(next)
  }
  const remember = (note:ArchivedNote) => updateArchive(value=>({...value,notes:[note,...value.notes.filter(item=>item.id!==note.id)]}))
  const receiptOpenedAt=useRef(0),receiptPointerAllowed=useRef(false)
  const receiptRef=useCallback((node:HTMLElement|null)=>{if(node){receiptOpenedAt.current=performance.now();receiptPointerAllowed.current=false;node.focus()}},[])
  const closeReceipt=()=>{if(performance.now()-receiptOpenedAt.current<500)return;setNoteDismissed(true);updateArchive(value=>({...value,view:'closed'}))}
  const [recovering,setRecovering]=useState(loaded.data.reached)
  const [ready, setReady] = useState(false), [story, setStory] = useState<Story>(loaded.data.view==='private'?'compose':'closed'), [line, setLine] = useState(0), [friend, setFriend] = useState<number | null>(null)
  const [draft, setDraft] = useState(loaded.data.privateDraft.content), [letterId, setLetterId] = useState(loaded.data.privateDraft.id), [letterBusy, setLetterBusy] = useState(false), [letterError, setLetterError] = useState('')
  const [noteReady, setNoteReady] = useState(loaded.data.authorReady), [noteDismissed, setNoteDismissed] = useState(!['feedback','receipt'].includes(loaded.data.view||''))
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>()
  const [projection, setProjection] = useState(() => ({ scene: { left: 0, top: 0, width: w, height: h }, viewport: { left: 0, top: 0, width: w, height: h }, controls: [] as SceneRect[] }))
  const [rating, setRating] = useState<number | null>(loaded.data.feedbackDraft.rating), [hoverRating, setHoverRating] = useState<number | null>(null), [message, setMessage] = useState(loaded.data.feedbackDraft.message), [feedbackBusy, setFeedbackBusy] = useState(false), [ratingBusy, setRatingBusy] = useState(false), [feedbackError, setFeedbackError] = useState(''), [received, setReceived] = useState(!!loaded.data.receiptId), [outroRevealed, setOutroRevealed] = useState(false)
  const [feedbackId, setFeedbackId] = useState(loaded.data.feedbackDraft.id), [swipeHint, setSwipeHint] = useState(true)
  const [letterIdentity, setLetterIdentity] = useState(loaded.data.privateDraft.identity), [feedbackIdentity, setFeedbackIdentity] = useState(loaded.data.feedbackDraft.identity)
  const scroller = useRef<HTMLDivElement>(null), plane = useRef<HTMLDivElement>(null), room = useRef<HTMLElement>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve()), lastRating = useRef(0)
  const ratio = imageSize ? imageSize.width / imageSize.height : w / h
  const sceneW = Math.max(w, h * ratio), sceneH = sceneW / ratio
  const orion = friends[1]
  const focused = story !== 'closed', modal = story === 'viewer' || story === 'compose' || archiveOpen
  const storyDialogue = ['before', 'offered', 'after', 'kept'].includes(story)
  const activeCharacter = storyDialogue ? 1 : friend
  const selectedCharacter = useRef(activeCharacter)
  selectedCharacter.current = focused ? 1 : friend
  const showNote = noteReady && !noteDismissed && !focused && !archiveOpen && friend === null && active
  const attemptedLetter = useRef<string | null>(null)
  useEffect(()=>{
    if(!active&&!archiveRef.current.reached)return
    updateArchive(value=>({...value,reached:value.reached||active,authorReady:noteReady,view:archiveOpen?'archive':story==='compose'?'private':showNote?(received?'receipt':'feedback'):received&&noteDismissed?'closed':null,privateDraft:{id:letterId,identity:letterIdentity,content:draft},feedbackDraft:{id:feedbackId,identity:feedbackIdentity,message,rating}}))
  },[active,noteReady,archiveOpen,story,showNote,received,noteDismissed,letterId,letterIdentity,draft,feedbackId,feedbackIdentity,message,rating])
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
    return () => clearTimeout(reveal)
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
      setMessage(''); setReceived(false); setOutroRevealed(false); updateArchive(value=>({...value,receiptId:null}))
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
    try { await saveRoomNote('private-letter', { id: letterId, content: draft }, letterIdentity); remember({id:letterId,kind:'private-letter',identity:letterIdentity,revision:0,content:draft,rating:null,savedAt:Date.now()}); setDraft(''); attemptedLetter.current = null; setLetterId(crypto.randomUUID()); setLetterIdentity(getSubmissionIdentity()); setStory('kept') }
    catch (error) { setLetterError(error instanceof Error ? error.message : 'Your words are still here. Please try again.'); await recoverSavedDrafts() }
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
    try { await queue.current; await saveRoomNote('feedback', { id: feedbackId, rating, message, sealed: true }, feedbackIdentity); remember({id:feedbackId,kind:'feedback',identity:feedbackIdentity,revision:0,content:message,rating,savedAt:Date.now()}); updateArchive(value=>({...value,receiptId:feedbackId,view:'receipt'})); setReceived(true) }
    catch (error) { setFeedbackError(error instanceof Error ? error.message : 'Your note is still here. Please try again.'); await recoverSavedDrafts() }
    finally { setFeedbackBusy(false) }
  }
  const recoverSavedDrafts=async()=>{
    const value=archiveRef.current
    const candidates=[{kind:'private-letter' as const,id:value.privateDraft.id,identity:value.privateDraft.identity,content:value.privateDraft.content,rating:null}, {kind:'feedback' as const,id:value.feedbackDraft.id,identity:value.feedbackDraft.identity,content:value.feedbackDraft.message,rating:value.feedbackDraft.rating}].filter(note=>(note.content.trim()||note.rating)&&!value.notes.some(saved=>saved.id===note.id))
    for(const note of candidates){
      try{
        const result=await manageRoomNote(note.kind,{id:note.id,action:'read'},note.identity)
        if(result.deleted){
          if(note.kind==='private-letter'){setDraft('');setLetterId(crypto.randomUUID());setLetterIdentity(getSubmissionIdentity())}
          else{setMessage('');setRating(null);setFeedbackId(crypto.randomUUID());setFeedbackIdentity(getSubmissionIdentity())}
          continue
        }
        if(note.kind==='feedback'&&!result.sealed)continue
        const content=note.kind==='private-letter'?result.content||'':result.message||''
        remember({...note,revision:result.revision,content,rating:result.rating??null,savedAt:Date.now()})
        if(note.kind==='private-letter'){
          const current=archiveRef.current.privateDraft
          if(current.id===note.id&&current.content===content){setDraft('');setLetterId(crypto.randomUUID());setLetterIdentity(getSubmissionIdentity());setStory('closed');setArchiveOpen(true);updateArchive(saved=>({...saved,selected:note.id}));setLetterError('')}
          else if(current.id===note.id){setLetterId(crypto.randomUUID());setLetterIdentity(getSubmissionIdentity())}
        }else{
          const current=archiveRef.current.feedbackDraft
          if(current.id===note.id&&current.message===content&&current.rating===(result.rating??null)){setReceived(true);setNoteReady(true);setNoteDismissed(false);updateArchive(saved=>({...saved,receiptId:note.id}));setFeedbackError('')}
          else if(current.id===note.id){setFeedbackId(crypto.randomUUID());setFeedbackIdentity(getSubmissionIdentity())}
        }
      }catch(error){
        if(error instanceof RoomNoteError&&error.status===404)continue
        const text=error instanceof Error?error.message:'Your draft is here, but its saved status could not be checked.'
        if(note.kind==='private-letter')setLetterError(text);else setFeedbackError(text)
      }
    }
  }
  useEffect(()=>{if(!loaded.data.reached){setRecovering(false);return}void recoverSavedDrafts().finally(()=>setRecovering(false))},[])
  const openArchive=()=>{setStory('closed');setFriend(null);setArchiveOpen(true)}
  const composeArchived=(kind:NoteKind)=>{
    setArchiveOpen(false);setFriend(null)
    if(kind==='private-letter')setStory('compose')
    else{setStory('closed');setNoteReady(true);reopenNote()}
  }
  const deleteArchived=(id:string)=>{
    if(id===feedbackId){setMessage('');setRating(null);setFeedbackId(crypto.randomUUID());setFeedbackIdentity(getSubmissionIdentity())}
    updateArchive(value=>{const edits={...value.edits};delete edits[id];return {...value,notes:value.notes.filter(note=>note.id!==id),selected:null,edits}})
  }
  const hasArchive=!!archive.receiptId||archive.notes.length>0||!!draft.trim()||!!message.trim()||!!rating
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
  const actionsWithArchive=activeCharacter===1&&hasArchive?<>{dialogueActions}<button onClick={openArchive}>Kept here</button></>:dialogueActions
  return <section ref={room} data-mobile={mobile} className={`final-room${active ? ' is-active' : ''}${showNote ? ' is-note-open' : ''}${activeCharacter !== null ? ' is-talking' : ''}${received && noteDismissed ? ' is-file-closed' : ''}`} aria-label="The final room" aria-hidden={!active && !reading} onKeyDown={event => { if (event.key === 'Escape' && !modal) { if (showNote && !feedbackBusy) { if(received)closeReceipt();else setNoteDismissed(true) }; setFriend(null); setStory('closed') } }}>
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
        {activeCharacter !== null && <CharacterDialogue key={friends[activeCharacter].name} character={friends[activeCharacter].name} anchor={characters[activeCharacter].anchor} placement={characters[activeCharacter].placement} scene={projection.scene} viewport={projection.viewport} faces={faces} speakerFace={faces[activeCharacter]} bodies={bodies} controls={projection.controls} mobile={mobile} reduced={reduced} dialogue={dialogue} actions={actionsWithArchive} onClose={story === 'kept' ? undefined : () => { setFriend(null); setStory('closed') }} />}
      </AnimatePresence>
      <AnimatePresence>
        {showNote && received && <motion.section key="author-receipt" ref={receiptRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Filed for review" className="room-paper-dialog author-note-dialog author-confirmation-dialog" initial={{opacity:0,scale:.985}} animate={{opacity:1,scale:1}} exit={{opacity:0,transition:{duration:.55}}} transition={{duration:.35}} onPointerDownCapture={()=>{receiptPointerAllowed.current=performance.now()-receiptOpenedAt.current>=500}} onClick={event=>{event.stopPropagation();if(event.detail===0||receiptPointerAllowed.current)closeReceipt()}}>
          <aside className="author-note"><div className="author-receipt" role="status" aria-live="polite">
            <p className="author-filed">Filed for review. ♡</p>
            <p>I’ll be reading it.</p>
            <p className="author-promises">No promises.<br />Yet.</p>
            <motion.p className="author-afterword" aria-hidden={!outroRevealed} initial={{opacity:0}} animate={{opacity:outroRevealed?1:0}} transition={{duration:.5}}>Will this little place keep changing?<br /><br />Guess we’ll find out.</motion.p>
            <small className="author-close-hint">click anywhere to close the file</small>
          </div></aside>
        </motion.section>}
        {showNote && !received && <PaperDialog key="author-note" label="A tiny note from Claire" onClose={() => { if (!feedbackBusy) setNoteDismissed(true) }} className="author-note-dialog" fitVisualViewport><aside className="author-note">
            <button className="author-note-close" aria-label="Close Claire’s note" disabled={feedbackBusy||recovering} onClick={() => setNoteDismissed(true)}>×</button>
            <h2>A tiny note from Claire</h2>
            <p>Hey, baby.</p>
            <p>I could have just sent you an invitation.<br />But that felt a little too ordinary for you.</p>
            <p>So I made you this little place instead —<br />because apparently sending one normal message<br />was not dramatic enough. :)</p>
            <p className="author-business">Anyway. Very important business now:</p>
            <p className="rating-question">How was your stay?</p>
            <div className="experience-stars" role="group" aria-label="How was your stay?" onMouseLeave={() => setHoverRating(null)}>{[1,2,3,4,5].map(value => <button key={value} aria-label={`${value} ${value===1?'star':'stars'}`} aria-pressed={rating===value} disabled={feedbackBusy||recovering} className={value <= (hoverRating ?? rating ?? 0) ? 'is-chosen' : ''} onMouseEnter={() => setHoverRating(value)} onFocus={() => setHoverRating(value)} onBlur={() => setHoverRating(null)} onClick={() => rate(value)}>★</button>)}</div>
            {ratingBusy && <span className="room-sr-only" role="status">Saving your stars…</span>}
            <label className="author-message-label" htmlFor="author-message">Anything else for the author? <span>· optional</span></label>
            <textarea className="author-message" id="author-message" placeholder="complaints, compliments, bribes..." maxLength={8000} value={message} onChange={e => setMessage(e.target.value)} disabled={feedbackBusy||recovering} />
            <small className="author-message-note">I’ll read whatever you leave here.</small>
            <button className="author-submit paper-action" disabled={feedbackBusy || recovering || (!rating && !message.trim())} onClick={() => void sendFeedback()}>{feedbackBusy ? 'Filing…' : 'File it ♡'}</button>
            {feedbackError && <p className="room-form-error" role="alert">{feedbackError}</p>}
            <footer className="author-footnote"><p><em>Official notice:</em><br />The author is not currently accepting revision requests.<br />Exceptions may be made if properly motivated.</p><p>What counts as “motivation” will remain classified. :)</p></footer>
            {storageError&&<p className="room-form-error" role="alert">{storageError}</p>}
        </aside></PaperDialog>}
      </AnimatePresence>
      {noteReady && !received && !showNote && !focused && !archiveOpen && friend === null && <button className="author-note-reopen" aria-label="Open Claire’s note" onClick={reopenNote}><svg viewBox="0 0 24 20" width="21" height="18" aria-hidden="true"><path d="M2 3h20v14H2zM2 3l10 8L22 3" /></svg><span>Claire’s note</span></button>}
      <button className="saved-letter" aria-label="Read Claire's letter again" onClick={() => { setStory('closed'); setFriend(null); onReadLetter() }}><img src={`${import.meta.env.BASE_URL}media/sealed.webp`} alt="" /><span>Claire’s letter</span></button>
    </div>}
    <AnimatePresence>
      {active&&archiveOpen&&<RoomArchiveDialog notes={archive.notes} selected={archive.selected} storageError={storageError} edits={archive.edits} onDraft={(id,draft)=>updateArchive(value=>{const edits={...value.edits};if(draft)edits[id]=draft;else delete edits[id];return {...value,edits}})} privateDraft={!!draft.trim()} feedbackDraft={!received&&(!!message.trim()||!!rating)} onSelect={id=>updateArchive(value=>({...value,selected:id}))} onChange={remember} onDelete={deleteArchived} onCompose={composeArchived} onClose={()=>setArchiveOpen(false)} />}
      {active && story === 'viewer' && <LetterViewer src={art.letter} onClose={returnLetter} />}
      {active && story === 'compose' && <PaperDialog label="For Claire" onClose={() => { if (!letterBusy) finishStory() }} className="private-letter-composer"><div className="private-writing-paper"><h2>For Claire</h2><label className="room-sr-only" htmlFor="private-letter-content">Your private letter to Claire</label><textarea id="private-letter-content" maxLength={12000} placeholder={'Write whatever you want.\nIt doesn’t have to be perfect.'} value={draft} disabled={letterBusy||recovering} onChange={e=>{ const value=e.target.value; if (attemptedLetter.current !== null && attemptedLetter.current !== value) { setLetterId(crypto.randomUUID()); setLetterIdentity(getSubmissionIdentity()); attemptedLetter.current=null; setLetterError('') }; setDraft(value) }} /><div className="private-letter-actions"><button className="paper-action" disabled={letterBusy||recovering||!draft.trim()} onClick={() => void keepLetter()}>{letterBusy?'Keeping it safe…':'Keep it here ♡'}</button><button disabled={letterBusy||recovering} onClick={finishStory}>Not now</button></div>{letterError && <p className="room-form-error" role="alert">{letterError}</p>}{storageError&&<p className="room-form-error" role="alert">{storageError}</p>}</div></PaperDialog>}
    </AnimatePresence>
  </section>
}
