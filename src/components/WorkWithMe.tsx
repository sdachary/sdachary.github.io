import { motion } from 'framer-motion'
import type { WorkTrack } from '../data/types'

const tracks: WorkTrack[] = [
  {
    role: 'Hire Me',
    subtitle: 'Senior Data Analyst',
    target: 'Employers',
    desc: '6+ years of analytics experience. Python, SQL, GCP, Power BI. Built pipelines processing 100K+ records daily. I lead teams, drive data culture, and ship decisions — not just dashboards.',
    cta: 'View Resume →',
    href: '#contact',
    accent: 'var(--accent)',
  },
  {
    role: 'Commission Me',
    subtitle: 'AI Architect & Full-Stack Builder',
    target: 'Clients',
    desc: 'Need a SaaS prototype? An AI agent? A custom dashboard? I design, build, and deploy production-grade systems solo. No agency overhead. Just clean architecture and fast delivery.',
    cta: 'Start a Project →',
    href: '#contact',
    accent: 'var(--accent2)',
  },
]

const ease = [0.32, 0.72, 0, 1] as const

function Card({ data, side, accent }: { data: WorkTrack; side: 'left' | 'right'; accent: string }) {
  const borderColor = accent === 'var(--accent)' ? 'rgba(201,169,110,0.25)' : 'rgba(58,74,107,0.25)'
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay: side === 'left' ? 0 : 0.2, ease }}
    >
      <div className="dual-badge" style={{ color: accent, borderColor }}>
        For {data.target}
      </div>
      <h2 className="dual-title">{data.role}</h2>
      <div className="card-period" style={{ color: accent, fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>
        {data.subtitle}
      </div>
      <p className="card-desc" style={{ marginBottom: '2rem', fontSize: '0.95rem' }}>
        {data.desc}
      </p>
      <a href={data.href} className="project-link" style={{ borderColor, color: accent }}>
        {data.cta}
      </a>
    </motion.div>
  )
}

export default function WorkWithMe() {
  return (
    <section id="work" className="section section-alt section-divider-both">
      <div className="section-header">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          className="section-title"
        >How I Can Help</motion.h2>
      </div>

      <div className="dual-grid">
        <Card data={tracks[0]} side="left" accent="var(--accent)" />
        <div className="dual-vr" />
        <Card data={tracks[1]} side="right" accent="var(--accent2)" />
      </div>
    </section>
  )
}
