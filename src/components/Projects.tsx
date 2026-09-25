import { useEffect, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import type { Project } from '../data/types'

const ease = [0.32, 0.72, 0, 1] as const

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease } },
}

function isFeatured(p: Project) {
  return p.status_key === 'live' || p.status_key === 'open-source'
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'projects.json')
      .then(r => r.ok ? r.json() : [])
      .then(d => { setProjects(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) return (
    <section id="projects" className="section section-alt">
      <div className="section-header"><h2 className="section-title">Projects</h2></div>
      <div className="projects-bento">
        {[1,2,3].map(i => <div key={i} className="project-card" style={{ opacity: 0.3, height: 180 }} />)}
      </div>
    </section>
  )

  if (error) return (
    <section id="projects" className="section section-alt">
      <div className="section-header"><h2 className="section-title">Projects</h2></div>
      <p className="activity-desc">Failed to load projects.</p>
    </section>
  )

  if (projects.length === 0) return null

  const sorted = [...projects]
    .filter(p => p.slug !== 'manacitra')
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <section id="projects" className="section section-alt" style={{ overflow: 'hidden' }}>
      <div className="section-header">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          className="section-title"
        >Projects</motion.h2>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="projects-bento"
      >
        {sorted.map((p, i) => {
          const featured = isFeatured(p)
          const statusClass = `status-${p.status_key || 'local'}`

          return (
            <motion.div
              key={p.slug || i}
              variants={item}
              className={`project-card${featured ? ' featured' : ''}`}
            >
              <div>
                <div className={`status-badge ${statusClass}`}>{p.status}</div>
                <h3 className="project-name">{p.name}</h3>
                <p className="project-desc">{p.description}</p>
              </div>
              <div>
                {(p.live_url || p.github_url) && (
                  <a href={p.live_url || p.github_url || ''} target="_blank" rel="noreferrer" className="project-link">
                    {p.live_url ? 'Visit' : 'Source'} →
                  </a>
                )}
              </div>
            </motion.div>
          )
        })}
      </motion.div>
    </section>
  )
}
