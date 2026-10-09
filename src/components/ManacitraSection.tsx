import { motion } from 'framer-motion'
import { Relay } from '@lucasmarkes/hairline/react'

const ease = [0.32, 0.72, 0, 1] as const

export default function ManacitraSection() {
  return (
    <section id="manacitra" className="section section-alt section-divider" style={{ overflow: 'hidden' }}>
      <style>{`.relay-figure { --hairline-plate: var(--bg2); }`}</style>
      <div className="section-header">
        <motion.h2
          initial={{ opacity: 0, letterSpacing: '0.3em' }}
          whileInView={{ opacity: 1, letterSpacing: '-0.02em' }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease }}
          className="section-title"
        >Manacitra</motion.h2>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <Relay
            intensity={0.55}
            className="relay-figure"
            style={{ width: 200, flexShrink: 0, aspectRatio: '5/4' }}
            aria-label="Relay hairline figure"
          />
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease }}
            className="activity-desc"
            style={{ maxWidth: '38rem', flex: 1, minWidth: '20rem' }}
          >
            Live infrastructure map of all projects — zones, services, and connections. Click a service to visit it, or open the map full-screen.
          </motion.p>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease }}
        style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--line)' }}
      >
        <iframe
          src={import.meta.env.BASE_URL + 'manacitra.html'}
          title="Manacitra infrastructure map"
          loading="lazy"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: '#faf8f3' }}
        />
        <a
          href={import.meta.env.BASE_URL + 'manacitra.html'}
          target="_blank"
          rel="noreferrer"
          className="project-link"
          style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'rgba(247,245,240,0.9)', backdropFilter: 'blur(8px)', padding: '0.4rem 0.9rem', borderRadius: 8, fontSize: '0.78rem' }}
        >Open full screen ↗</a>
      </motion.div>
    </section>
  )
}
