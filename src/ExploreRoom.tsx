import { useEffect, useRef, useState } from 'react'
import { createRoom, type RoomScene, type Inspection } from './room/scene'
import { roomObjects } from './room/objects'

export default function ExploreRoom({ active, blocked, reduced, mobile, onReady, onFriend, onReadLetter }: {
  active: boolean; blocked: boolean; reduced: boolean; mobile: boolean
  onReady: () => void; onFriend: (index: number) => void; onReadLetter: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<RoomScene | null>(null)
  const markers = useRef(new Map<string, HTMLButtonElement>())
  const [ready, setReady] = useState(false), [error, setError] = useState(false), [attempt, setAttempt] = useState(0)
  const [hint, setHint] = useState(true), [inspected, setInspected] = useState<Inspection>(null), [history, setHistory] = useState(0)
  const callbacks = useRef({ onReady, onFriend, onReadLetter })
  callbacks.current = { onReady, onFriend, onReadLetter }
  useEffect(() => {
    const controller = new AbortController()
    setError(false); setReady(false); setInspected(null); setHistory(0)
    void createRoom(host.current!, markers.current, {
      ready() { if (!controller.signal.aborted) { setReady(true); callbacks.current.onReady() } },
      inspect(item) {
        if (controller.signal.aborted) return
        setInspected(item)
        if (item?.friendIndex !== undefined) callbacks.current.onFriend(item.friendIndex)
      },
      interact() { if (!controller.signal.aborted) setHint(false) },
      history(count) { if (!controller.signal.aborted) setHistory(count) },
      error(error) { if (!controller.signal.aborted) { console.warn('Explore Room unavailable', error); setError(true); callbacks.current.onReady() } },
    }, reduced, controller.signal).then(value => {
      if (controller.signal.aborted) value.dispose()
      else { scene.current = value; value.setActive(false) }
    }).catch(error => {
      if (!controller.signal.aborted) { console.warn('Explore Room could not start', error); setError(true); callbacks.current.onReady() }
    })
    return () => { controller.abort(); scene.current = null }
  }, [reduced, attempt])
  useEffect(() => { scene.current?.setActive(active && !blocked && ready && !error) }, [active, blocked, ready, error])
  useEffect(() => {
    if (!active || !ready || !hint) return
    const timer = window.setTimeout(() => setHint(false), 6500)
    return () => clearTimeout(timer)
  }, [active, ready, hint])
  const open = () => {
    if (inspected?.id === 'claire-envelope') callbacks.current.onReadLetter()
    if (inspected?.openEvent) window.dispatchEvent(new CustomEvent(inspected.openEvent, { detail: { objectId: inspected.id } }))
  }
  return <section className={`explore-room${active && ready && !error ? ' is-visible' : ''}`} aria-label="A room to explore" aria-hidden={!active} inert={!active}>
    <div className="explore-canvas" ref={host} />
    {ready && !error && <>
      <div className="room-markers" inert={blocked}>
        {roomObjects.map(item => <button key={item.id} ref={element => { if (element) markers.current.set(item.id, element); else markers.current.delete(item.id) }} hidden className={`room-marker${item.movable ? ' is-prop' : ''}`} aria-label={item.label} title={item.label} onClick={() => scene.current?.inspect(item.id)}><span aria-hidden="true" /></button>)}
      </div>
      <p className={`explore-hint${hint ? ' is-visible' : ''}`} aria-live="polite">Take your time. {mobile ? 'Swipe' : 'Drag'} to explore.</p>
      {inspected && !blocked && <div className="room-inspection" role="status">
        <span>{inspected.label}</span>
        {inspected.movable && <small>Hold and drag to move</small>}
        {(inspected.id === 'claire-envelope' || inspected.openEvent) && <button onClick={open}>{inspected.id === 'claire-envelope' ? 'Read again' : 'Open'}</button>}
        <button aria-label="Return to exploring" onClick={() => scene.current?.leaveInspection()}>Return</button>
      </div>}
      <div className="room-tools">
        {history > 0 && <button onClick={() => scene.current?.undo()} aria-label="Undo last room change" title="Command / Control + Z">Undo</button>}
        <button onClick={() => { scene.current?.reset(); setHint(false) }} aria-label="Restore the room">Restore room</button>
      </div>
    </>}
    {error && active && <div className="room-retry" role="status"><p>The room needs another moment.</p><button onClick={() => setAttempt(value => value + 1)}>Try again</button><button onClick={onReadLetter}>Claire’s letter</button></div>}
  </section>
}
