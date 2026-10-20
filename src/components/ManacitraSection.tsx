import { motion } from 'framer-motion'

const ease = [0.32, 0.72, 0, 1] as const

export default function ManacitraSection() {
  return (
    <section id="manacitra" className="section section-alt section-divider section-clip">
      <div className="section-header">
        <h2 className="section-title">Manacitra</h2>
        <p
          className="activity-desc manacitra-desc"
        >
          Live infrastructure map of all projects — zones, services, and connections. Click a service to visit it, or open the map full-screen.
        </p>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease }}
        className="manacitra-frame"
      >
        <iframe
          src={import.meta.env.BASE_URL + 'manacitra.html'}
          title="Manacitra infrastructure map"
          loading="lazy"
          className="manacitra-iframe"
        />
        <a
          href={import.meta.env.BASE_URL + 'manacitra.html'}
          target="_blank"
          rel="noreferrer"
          className="project-link manacitra-open"
        >Open full screen ↗</a>
      </motion.div>
    </section>
  )
}
