import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { motion } from 'framer-motion'

export function PaperDialog({ label, onClose, children, className = '' }: { label: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null), close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const elements = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea,a[href],input') || [])].filter(e => e.getClientRects().length)
      const first = elements[0], last = elements.at(-1)
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); if (previous?.isConnected) previous.focus() }
  }, [])
  return <motion.section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className={`room-paper-dialog ${className}`} initial={{ opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .985 }} transition={{ duration: .35 }}>{children}</motion.section>
}

export function LetterViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1)
  return <PaperDialog label="Colette’s first letter" onClose={onClose} className="first-letter-viewer">
    <header><span>Colette’s first letter</span><div className="letter-zoom"><button aria-label="Zoom out" disabled={zoom <= .75} onClick={() => setZoom(v => Math.max(.75, v - .25))}>−</button><button aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom(v => Math.min(3, v + .25))}>+</button></div></header>
    <div className="original-letter-scroll"><div className="original-letter-canvas" style={{ '--letter-zoom': zoom } as CSSProperties}><img src={src} alt="Colette’s original handwritten first letter to Claire" draggable={false} /></div></div>
    <button className="put-letter-back" onClick={onClose}>Put it back</button>
  </PaperDialog>
}
