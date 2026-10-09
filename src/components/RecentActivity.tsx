import { useEffect, useState, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import type { ActivityEntry } from '../data/types'

const ease = [0.32, 0.72, 0, 1] as const

const statusLabel: Record<string, string> = { active: 'Active', completed: 'Done', blocked: 'Blocked' }
const statusClass: Record<string, string> = {
  active: 'status-progress',
  completed: 'status-live',
  blocked: 'status-local',
}
const kindLabel: Record<string, string> = {
  feature: 'feature', bugfix: 'bugfix', refactor: 'refactor', docs: 'docs',
  build: 'build', perf: 'perf', test: 'test', chore: 'chore',
}

export default function RecentActivity() {
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] })
  const railScale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.3, 1, 1, 0.3])

  useEffect(() => {
    const base = import.meta.env.BASE_URL || '/'
    const url = (base.endsWith('/') ? base + 'activity.json' : base + '/activity.json')
    fetch(url)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setActivity([...d].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) return (
    <section id="activity" className="section section-alt section-divider">
      <div className="section-header"><h2 className="section-title">Recent Activity</h2></div>
      <div className="activity-wrap"><div className="activity-rail" />
        {[1,2].map(i => <div key={i} className="activity-row">
          <div className="activity-dot" />
          <div className="activity-card" style={{ opacity: 0.3, height: 60, width: '100%' }} />
        </div>)}
      </div>
    </section>
  )

  if (error) return (
    <section id="activity" className="section section-alt section-divider">
      <div className="section-header"><h2 className="section-title">Recent Activity</h2></div>
      <p className="activity-desc">Failed to load recent activity.</p>
    </section>
  )

  if (activity.length === 0) return null

  return (
    <section id="activity" className="section section-alt section-divider">
      <div className="section-header">
        <motion.h2
          initial={{ opacity: 0, letterSpacing: '0.3em' }}
          whileInView={{ opacity: 1, letterSpacing: '-0.02em' }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease }}
          className="section-title"
        >Recent Activity</motion.h2>
      </div>

      <div className="activity-wrap" ref={sectionRef}>
        <motion.div className="activity-rail" style={{ scaleY: railScale, transformOrigin: 'top' }} />
        {activity.map((item, i) => (
          <motion.div
            key={`${item.phase}-${item.project}-${i}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.04, ease }}
            className="activity-row"
          >
            <div className="activity-dot" aria-hidden="true" />
            <time className="activity-date">{item.date}</time>
            <div className="activity-card">
              <div className="activity-meta">
                <span className="activity-project">{item.project}</span>
                {item.kind && <span className="activity-phase">{kindLabel[item.kind] || item.kind}</span>}
                <span className="activity-phase">{item.phase}</span>
                <span className={`status-badge ${statusClass[item.status] || ''}`}>
                  {statusLabel[item.status] || item.status}
                </span>
                {item.count && item.count > 1 && <span className="activity-count">+{item.count}</span>}
              </div>
              <p className="activity-desc">{item.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
