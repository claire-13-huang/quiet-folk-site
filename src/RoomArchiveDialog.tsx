import { useEffect, useRef, useState } from 'react'
import { PaperDialog } from './LetterViewer'
import { manageRoomNote } from './roomApi'
import { type ArchivedNote, type NoteKind, type ArchiveEdit } from './roomArchive'

export function RoomArchiveDialog({ notes, selected, edits, onDraft, storageError, privateDraft, feedbackDraft, onSelect, onChange, onDelete, onCompose, onClose }: {notes:ArchivedNote[];selected:string|null;edits:Record<string,ArchiveEdit>;onDraft:(id:string,value:ArchiveEdit|null)=>void;storageError:string;privateDraft:boolean;feedbackDraft:boolean;onSelect:(id:string|null)=>void;onChange:(note:ArchivedNote)=>void;onDelete:(id:string)=>void;onCompose:(kind:NoteKind)=>void;onClose:()=>void}) {
  const [current,setCurrent]=useState<ArchivedNote|null>(()=>notes.find(n=>n.id===selected)||null)
  const [editing,setEditing]=useState(!!(selected&&edits[selected])),[content,setContent]=useState(''),[rating,setRating]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[deleting,setDeleting]=useState(false)
  const operation=useRef<{id:string;payload:string}|null>(null)
  useEffect(()=>{ if(current) {const draft=edits[current.id];setContent(draft?.content??current.content);setRating(draft?.rating??current.rating);if(draft)setEditing(true);operation.current=draft?.operation||null} },[current])
  const open=async(note:ArchivedNote)=>{
    setCurrent(note);onSelect(note.id);setEditing(!!edits[note.id]);setDeleting(false);setError('');setBusy(true)
    try { const result=await manageRoomNote(note.kind,{id:note.id,action:'read'},note.identity)
      if(result.deleted){onDelete(note.id);setCurrent(null);onSelect(null)}
      else {const fresh={...note,revision:result.revision,content:note.kind==='private-letter'?result.content||'':result.message||'',rating:result.rating??null};setCurrent(fresh);onChange(fresh)}
    } catch(e){setError(e instanceof Error?e.message:'This file could not be opened.')} finally{setBusy(false)}
  }
  useEffect(()=>{const note=notes.find(n=>n.id===selected);if(note)void open(note)},[])
  const change=async(action:'edit'|'delete')=>{
    if(!current||busy)return
    const revision=action==='edit'?(edits[current.id]?.revision??current.revision):current.revision
    const payload=JSON.stringify({action,content,rating,revision})
    if(operation.current?.payload!==payload)operation.current={id:crypto.randomUUID(),payload}
    if(action==='edit')onDraft(current.id,{content,rating,revision,operation:operation.current})
    setBusy(true);setError('')
    try {const result=await manageRoomNote(current.kind,{id:current.id,action,revision,operation_id:operation.current.id,...(action==='edit'?(current.kind==='private-letter'?{content}:{message:content,rating}):{})},current.identity)
      if(result.deleted){onDelete(current.id);setCurrent(null);onSelect(null);setDeleting(false)}
      else {const next={...current,revision:result.revision,content:current.kind==='private-letter'?result.content||'':result.message||'',rating:result.rating??null,savedAt:Date.now()};onChange(next);setCurrent(next);setEditing(false)}
      onDraft(current.id,null);operation.current=null
    }catch(e){setError(e instanceof Error?e.message:'Your words are still here. Please try again.')}finally{setBusy(false)}
  }
  return <PaperDialog label="Kept here" className="room-archive-dialog" fitVisualViewport onClose={()=>{if(!busy)onClose()}}><section className="private-writing-paper room-archive-paper">
    <button className="author-note-close" aria-label="Close saved letters" disabled={busy} onClick={onClose}>×</button>
    <h2>{current?(current.kind==='private-letter'?'Your letter':'Your note'):'Kept here'}</h2>
    {current?<>
      {editing?<>
        {current.kind==='feedback'&&<div className="experience-stars" role="group" aria-label="Edit your rating">{[1,2,3,4,5].map(v=><button key={v} aria-label={`${v} ${v===1?'star':'stars'}`} aria-pressed={rating===v} disabled={busy} className={v<=(rating||0)?'is-chosen':''} onClick={()=>{setRating(v);onDraft(current.id,{content,rating:v,revision:edits[current.id]?.revision??current.revision})}}>★</button>)}</div>}
        <label className="room-sr-only" htmlFor="archive-content">Edit your saved words</label><textarea id="archive-content" value={content} maxLength={current.kind==='private-letter'?12000:8000} disabled={busy} onChange={e=>{setContent(e.target.value);onDraft(current.id,{content:e.target.value,rating,revision:edits[current.id]?.revision??current.revision})}} />
        <div className="private-letter-actions"><button className="paper-action" disabled={busy||(!content.trim()&&(current.kind==='private-letter'||!rating))} onClick={()=>void change('edit')}>{busy?'Keeping it safe…':'Save changes ♡'}</button><button disabled={busy} onClick={()=>{setContent(current.content);setRating(current.rating);setEditing(false);onDraft(current.id,null)}}>Cancel</button></div>
      </>:<><p className="archived-content">{current.content||'Only stars, this time.'}</p>{current.rating&&<p className="archived-rating" aria-label={`${current.rating} out of five stars`}>{'★'.repeat(current.rating)}</p>}
        {deleting?<div className="archive-delete-confirm"><p>Delete this file?</p><button className="paper-action" disabled={busy} onClick={()=>void change('delete')}>Delete</button><button className="paper-action" disabled={busy} onClick={()=>setDeleting(false)}>Keep it</button></div>:<div className="private-letter-actions"><button disabled={busy} onClick={()=>{setEditing(true);onDraft(current.id,{content:current.content,rating:current.rating,revision:current.revision})}}>Edit</button><button disabled={busy} onClick={()=>setDeleting(true)}>Delete</button><button disabled={busy} onClick={()=>{setCurrent(null);onSelect(null);setError('')}}>Back</button></div>}
      </>}
    </>:<>
      {notes.map(note=><button className="archive-entry" key={note.id} onClick={()=>void open(note)}><span>{note.kind==='private-letter'?'Your letter':'Your note'}</span><small>{new Date(note.savedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</small></button>)}
      {privateDraft&&<button className="archive-entry" onClick={()=>onCompose('private-letter')}>Continue your letter</button>}
      {feedbackDraft&&<button className="archive-entry" onClick={()=>onCompose('feedback')}>Continue your note</button>}
      <div className="private-letter-actions"><button onClick={()=>onCompose('private-letter')}>Write something ♡</button><button onClick={()=>onCompose('feedback')}>Leave a note</button></div>
    </>}
    {(error||storageError)&&<p className="room-form-error" role="alert">{error||storageError}</p>}
  </section></PaperDialog>
}
