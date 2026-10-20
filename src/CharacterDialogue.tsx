import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useIsPresent } from 'framer-motion'

export type ScenePoint = { x: number; y: number }
export type SceneRect = { left: number; top: number; width: number; height: number }
export type Placement = 'above' | 'above-right' | 'above-left' | 'left' | 'right' | 'below'
export const scenePointToViewport = (point: ScenePoint, scene: SceneRect): ScenePoint => ({ x: scene.left + point.x * scene.width, y: scene.top + point.y * scene.height })
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))
const overlap = (a: SceneRect, b: SceneRect) => Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top))

export function CharacterDialogue({ character, anchor, placement, scene, viewport, faces, speakerFace, controls, dialogue, actions, onClose, mobile, reduced }: {
  character: string; anchor: ScenePoint; placement: Placement; scene: SceneRect; viewport: SceneRect; faces: SceneRect[]; speakerFace: SceneRect; controls: SceneRect[]
  dialogue: ReactNode; actions?: ReactNode; onClose?: () => void; mobile: boolean; reduced: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const present = useIsPresent()
  const [height, setHeight] = useState(190)
  const width = mobile ? Math.min(viewport.width * .88, 390) : Math.min(420, Math.max(330, viewport.width * .3), viewport.width - 32)
  useLayoutEffect(() => {
    const panel = ref.current
    if (!panel) return
    const measure = () => setHeight(panel.scrollHeight + panel.offsetHeight - panel.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    const panel = ref.current
    if (panel) setHeight(panel.scrollHeight + panel.offsetHeight - panel.clientHeight)
  }, [dialogue, actions, width])
  const projected = scenePointToViewport(anchor, scene)
  const point = { x: projected.x - viewport.left, y: projected.y - viewport.top }
  const maxHeight = Math.max(120, viewport.height - 32)
  const idealHeight = Math.min(height, maxHeight)
  const gap = 20
  const candidates: Record<Placement, ScenePoint> = {
    above: { x: point.x - width / 2, y: point.y - idealHeight - gap },
    'above-right': { x: point.x + gap, y: point.y - idealHeight - gap },
    'above-left': { x: point.x - width - gap, y: point.y - idealHeight - gap },
    left: { x: point.x - width - gap, y: point.y - idealHeight / 2 },
    right: { x: point.x + gap, y: point.y - idealHeight / 2 },
    below: { x: point.x - width / 2, y: point.y + gap },
  }
  const protectedFaces = faces.map(face => ({ ...face, left: face.left - viewport.left, top: face.top - viewport.top }))
  const protectedControls = controls.map(control => ({ ...control, left: control.left - viewport.left, top: control.top - viewport.top }))
  const speaker = { ...speakerFace, left: speakerFace.left - viewport.left, top: speakerFace.top - viewport.top }
  const positions = [placement, ...Object.keys(candidates).filter(key => key !== placement) as Placement[]].map(key => candidates[key])
  // A narrow landscape viewport can leave no room beside the original anchor.
  // Include the speaker's face edges before clamping; never trade that face for another.
  positions.push(
    { x: point.x - width / 2, y: speaker.top - idealHeight - gap },
    { x: point.x - width / 2, y: speaker.top + speaker.height + gap },
    { x: speaker.left - width - gap, y: point.y - idealHeight / 2 },
    { x: speaker.left + speaker.width + gap, y: point.y - idealHeight / 2 },
  )
  const obstacles = [...protectedFaces, ...protectedControls]
  const options = positions.flatMap((desired, index) => {
    const x = clamp(desired.x, 15, viewport.width - width - 15)
    const blocked = obstacles.filter(rect => rect.left < x + width + 3 && rect.left + rect.width > x - 3)
      .map(rect => ({ start: Math.max(16, rect.top - 6), end: Math.min(viewport.height - 16, rect.top + rect.height + 6) }))
      .filter(rect => rect.end > rect.start).sort((a, b) => a.start - b.start)
    const spaces: { start: number; end: number }[] = []
    let cursor = 16
    for (const rect of blocked) { if (rect.start > cursor) spaces.push({ start: cursor, end: rect.start }); cursor = Math.max(cursor, rect.end) }
    if (cursor < viewport.height - 16) spaces.push({ start: cursor, end: viewport.height - 16 })
    // On compact screens the paper can scroll within the clear space between
    // faces. Its text size and story remain unchanged.
    return spaces.filter(space => space.end - space.start >= Math.min(100, idealHeight)).map(space => {
      const availableHeight = Math.min(idealHeight, space.end - space.start)
      const y = clamp(desired.y, space.start, space.end - availableHeight)
      const anchorDistance = Math.hypot(Math.max(x - point.x, 0, point.x - x - width), Math.max(y - point.y, 0, point.y - y - availableHeight))
      const correction = Math.hypot(x - desired.x, y - desired.y)
      return { x, y, height: availableHeight, score: anchorDistance * 1.5 + correction * .1 + (idealHeight - availableHeight) + index * 4 }
    })
  })
  const fallback = positions.map((desired, index) => {
    const x = clamp(desired.x, 15, viewport.width - width - 15), y = clamp(desired.y, 16, viewport.height - idealHeight - 16)
    const rect = { left: x, top: y, width, height: idealHeight }
    return { x, y, height: idealHeight, score: overlap(rect, speaker) * 10000 + obstacles.reduce((sum, obstacle) => sum + overlap(rect, obstacle), 0) * 100 + index }
  })
  const selected = (options.length ? options : fallback).reduce((best, option) => option.score < best.score ? option : best)
  const panelHeight = selected.height
  const anchorInside = point.x >= selected.x && point.x <= selected.x + width && point.y >= selected.y && point.y <= selected.y + panelHeight
  const target = anchorInside ? { x: clamp(selected.x + width / 2, speaker.left, speaker.left + speaker.width), y: clamp(selected.y + panelHeight / 2, speaker.top, speaker.top + speaker.height) } : point
  const edge = { x: clamp(target.x, selected.x + 12, selected.x + width - 12), y: clamp(target.y, selected.y + 12, selected.y + panelHeight - 12) }
  const distance = Math.hypot(target.x - edge.x, target.y - edge.y)
  // Keep the connector a small local gesture; the scene anchor itself remains exact.
  const tail = { x: edge.x + (target.x - edge.x) * Math.min(1, 34 / Math.max(1, distance)), y: edge.y + (target.y - edge.y) * Math.min(1, 34 / Math.max(1, distance)) }
  return <motion.div className="character-dialogue-group" initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : 3 }} transition={{ duration: reduced ? .1 : .22 }}>
    <svg className="character-connector" width={viewport.width} height={viewport.height} aria-hidden="true"><path d={`M${edge.x} ${edge.y} L${tail.x} ${tail.y}`} /><circle cx={tail.x} cy={tail.y} r="1.5" /></svg>
    <section ref={ref} className="character-dialogue" role="dialog" aria-label={`${character}’s dialogue`} data-character={character} inert={!present} style={{ left: selected.x, top: selected.y, width, maxHeight: panelHeight }}>
      {onClose && <button className="character-dialogue-close" aria-label={`Close ${character}’s dialogue`} onClick={onClose}>×</button>}
      <span className="character-name">{character}</span>
      <div className="character-line">{dialogue}</div>
      {actions && <div className="character-actions">{actions}</div>}
    </section>
  </motion.div>
}
