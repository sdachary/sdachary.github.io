import { motion } from 'framer-motion'

const ease = [0.32, 0.72, 0, 1] as const

export default function Hero() {
  return (
    <section id="hero" className="hero">
      <div className="hero-bg" aria-hidden="true" />

      <div className="hero-content">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease }}
          className="hero-location"
        >
          S Deepak Achary — Hyderabad, India
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease }}
          className="hero-headline"
        >
          DATA TELLS <em>STORIES.</em>
          <br />I BUILD SYSTEMS.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6, ease }}
          className="hero-tagline"
        >
          Senior Data Analyst &nbsp;·&nbsp; AI Architect &nbsp;·&nbsp; Solopreneur
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8, ease }}
          className="hero-actions"
        >
          <a href="/resume.pdf" target="_blank" rel="noreferrer" className="hero-cta" aria-label="Download resume PDF">
            Download Resume
            <span className="hero-cta-icon" aria-hidden="true">↓</span>
          </a>
          <a href="#work" className="hero-link">Work With Me →</a>
        </motion.div>
      </div>
    </section>
  )
}
