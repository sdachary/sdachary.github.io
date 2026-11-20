import { motion } from 'motion/react'

const ease = [0.22, 1, 0.36, 1] as const

export default function ManacitraSection() {
  return (
    <section id="manacitra" className="section section-divider manacitra-band">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease }}
        className="manacitra-band-inner"
      >
        <p className="manacitra-band-label"><span className="sec-num">04</span> Mānacitra</p>
        <p className="manacitra-band-text">
          The live map above is the real thing: every node is a service I run,
          wired together. Open it full screen to pan, zoom and click through.
        </p>
        <a
          href={import.meta.env.BASE_URL + 'manacitra.html'}
          target="_blank"
          rel="noreferrer"
          className="manacitra-band-link"
        >
          Open the map <span aria-hidden="true">↗</span>
        </a>
      </motion.div>
    </section>
  )
}
