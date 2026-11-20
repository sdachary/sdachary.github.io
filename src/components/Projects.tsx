import { useEffect, useState } from 'react'
import { motion, type Variants } from 'motion/react'
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
      <div className="sec-head"><span className="sec-num">03</span><h2 className="sec-title">Projects</h2><span className="sec-note">Loading</span></div>
      <div className="projects-bento">
        {[1,2,3].map(i => <div key={i} className="project-card project-card-skeleton" />)}
      </div>
    </section>
  )

  if (error) return (
    <section id="projects" className="section section-alt">
      <div className="sec-head"><span className="sec-num">03</span><h2 className="sec-title">Projects</h2><span className="sec-note">Unavailable</span></div>
      <p className="activity-empty">Failed to load projects.</p>
    </section>
  )

  if (projects.length === 0) return null

  const sorted = [...projects]
    .filter(p => p.slug !== 'manacitra')
    .sort((a, b) => a.name.localeCompare(b.name))
  const liveCount = sorted.filter(isFeatured).length

  return (
    <section id="projects" className="section section-alt section-clip">
      <div className="sec-head">
        <span className="sec-num">03</span>
        <h2 className="sec-title">Projects</h2>
        <span className="sec-note">{sorted.length} shipped, {liveCount} live</span>
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
          const href = p.live_url || p.github_url

          return (
            <motion.div
              key={p.slug || i}
              variants={item}
              className={`project-card${featured ? ' featured' : ''}`}
            >
              <div className={`status-badge ${statusClass}`}>{p.status}</div>
              {href ? (
                <h3 className="project-name">
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="project-name-link"
                    aria-label={`${p.name} — opens in a new tab`}
                  >
                    {p.name}
                    <span className="project-name-arrow" aria-hidden="true">↗</span>
                  </a>
                </h3>
              ) : (
                <h3 className="project-name">{p.name}</h3>
              )}
              <p className="project-desc">{p.description}</p>
            </motion.div>
          )
        })}
      </motion.div>
    </section>
  )
}
