import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useIsPresent } from 'framer-motion'

export type ScenePoint = { x: number; y: number }
export type SceneRect = { left: number; top: number; width: number; height: number }
export type Placement = 'above' | 'above-right' | 'above-left' | 'left' | 'right' | 'below'
export const scenePointToViewport = (point: ScenePoint, scene: SceneRect): ScenePoint => ({ x: scene.left + point.x * scene.width, y: scene.top + point.y * scene.height })
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))
const overlap = (a: SceneRect, b: SceneRect) => Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top))

export function CharacterDialogue({ character, anchor, placement, scene, viewport, faces, speakerFace, bodies, controls, dialogue, actions, onClose, mobile, reduced }: {
  character: string; anchor: ScenePoint; placement: Placement; scene: SceneRect; viewport: SceneRect; faces: SceneRect[]; speakerFace: SceneRect; bodies: SceneRect[]; controls: SceneRect[]
  dialogue: ReactNode; actions?: ReactNode; onClose?: () => void; mobile: boolean; reduced: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const present = useIsPresent()
  const [height, setHeight] = useState(190)
  const width = mobile ? Math.min(viewport.width * .88, 390) : Math.min(480, Math.max(390, viewport.width * .34), viewport.width - 32)
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
  // Prefer the middle of clear room space rather than a corner of the screen.
  positions.unshift({ x: (viewport.width - width) / 2, y: 24 }, { x: (viewport.width - width) / 2, y: (viewport.height - idealHeight) / 2 }, { x: (viewport.width - width) / 2, y: viewport.height - idealHeight - 24 })
  // A narrow landscape viewport can leave no room beside the original anchor.
  // Include the speaker's face edges before clamping; never trade that face for another.
  positions.push(
    { x: point.x - width / 2, y: speaker.top - idealHeight - gap },
    { x: point.x - width / 2, y: speaker.top + speaker.height + gap },
    { x: speaker.left - width - gap, y: point.y - idealHeight / 2 },
    { x: speaker.left + speaker.width + gap, y: point.y - idealHeight / 2 },
  )
  const protectedBodies = bodies.map(body => ({ ...body, left: body.left - viewport.left, top: body.top - viewport.top }))
  const obstacles = [...protectedBodies, ...protectedFaces, ...protectedControls]
  // Search clear areas at both viewport edges and beside every projected body.
  // This matters when a cropped phone view leaves only a narrow free strip.
  for (const x of [15, viewport.width - width - 15, ...protectedBodies.flatMap(body => [body.left - width - gap, body.left + body.width + gap])]) {
    positions.push({ x, y: point.y - idealHeight / 2 })
  }
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
    return spaces.filter(space => space.end - space.start >= Math.min(56, idealHeight)).map(space => {
      const availableHeight = Math.min(idealHeight, space.end - space.start)
      const y = clamp(desired.y, space.start, space.end - availableHeight)
      const anchorDistance = Math.hypot(Math.max(x - point.x, 0, point.x - x - width), Math.max(y - point.y, 0, point.y - y - availableHeight))
      const correction = Math.hypot(x - desired.x, y - desired.y)
      return { x, y, height: availableHeight, score: Math.abs(x + width / 2 - viewport.width / 2) * .5 + anchorDistance * .3 + correction * .05 + (idealHeight - availableHeight) * .5 + index * 2 }
    })
  })
  const fallback = positions.map((desired, index) => {
    const x = clamp(desired.x, 15, viewport.width - width - 15), y = clamp(desired.y, 16, viewport.height - idealHeight - 16)
    const rect = { left: x, top: y, width, height: idealHeight }
    return { x, y, height: idealHeight, score: overlap(rect, speaker) * 10000 + obstacles.reduce((sum, obstacle) => sum + overlap(rect, obstacle), 0) * 100 + index }
  })
  const selected = (options.length ? options : fallback).reduce((best, option) => option.score < best.score ? option : best)
  const panelHeight = selected.height
  return <motion.div className="character-dialogue-group" initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : 3 }} transition={{ duration: reduced ? .1 : .32 }}>
    <section ref={ref} className="character-dialogue" role="dialog" aria-label={`${character}’s dialogue`} data-character={character} data-compact={panelHeight < 180} inert={!present} style={{ left: selected.x, top: selected.y, width, maxHeight: panelHeight }}>
      {onClose && <button className="character-dialogue-close" aria-label={`Close ${character}’s dialogue`} onClick={onClose}>×</button>}
      <span className="character-name">{character}</span>
      <div className="character-line">{dialogue}</div>
      {actions && <div className="character-actions">{actions}</div>}
    </section>
  </motion.div>
}
