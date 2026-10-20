import { getSubmissionIdentity } from './analytics'
export type NoteKind = 'private-letter' | 'feedback'
export type NoteIdentity = ReturnType<typeof getSubmissionIdentity>
export type ArchivedNote = { id: string; kind: NoteKind; identity: NoteIdentity; revision: number; content: string; rating: number | null; savedAt: number }
export type ArchiveEdit = {content:string;rating:number|null;revision:number;operation?:{id:string;payload:string}}
export type RoomArchive = { version: 1; visitor: string; reached: boolean; authorReady: boolean; view: 'private' | 'feedback' | 'archive' | 'receipt' | 'closed' | null; selected: string | null; receiptId: string | null; notes: ArchivedNote[]; edits:Record<string,ArchiveEdit>; privateDraft: {id:string;identity:NoteIdentity;content:string}; feedbackDraft: {id:string;identity:NoteIdentity;message:string;rating:number|null} }
export const roomArchiveKey = 'quiet-folk-room-archive-v1'
export function readRoomArchive(): RoomArchive {
  const identity = getSubmissionIdentity()
  const blank: RoomArchive = { version:1, visitor:identity.visitor_id, reached:false, authorReady:false, view:null, selected:null, receiptId:null, notes:[], edits:{}, privateDraft:{id:crypto.randomUUID(),identity,content:''}, feedbackDraft:{id:crypto.randomUUID(),identity,message:'',rating:null} }
  const raw = localStorage.getItem(roomArchiveKey)
  if (!raw) return blank
  const saved = JSON.parse(raw) as RoomArchive
  if (saved.version !== 1 || saved.visitor !== identity.visitor_id || !Array.isArray(saved.notes) || !saved.privateDraft?.id || !saved.feedbackDraft?.id) throw new Error('The saved file could not be opened in this browser.')
  return {...saved,edits:saved.edits||{}}
}
export function newRoomArchive(): RoomArchive {
  const identity=getSubmissionIdentity()
  return {version:1,visitor:identity.visitor_id,reached:false,authorReady:false,view:null,selected:null,receiptId:null,notes:[],edits:{},privateDraft:{id:crypto.randomUUID(),identity,content:''},feedbackDraft:{id:crypto.randomUUID(),identity,message:'',rating:null}}
}
export function returnsToFinalRoom() {
  try { return readRoomArchive().reached } catch { return false }
}
export function writeRoomArchive(value: RoomArchive) { localStorage.setItem(roomArchiveKey,JSON.stringify(value)) }
