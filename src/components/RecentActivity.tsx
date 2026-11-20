import { useEffect, useState, useRef } from 'react'
import { motion, useScroll } from 'motion/react'
import type { ActivityEntry } from '../data/types'

const ease = [0.22, 1, 0.36, 1] as const

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

function Head({ note }: { note: string }) {
  return (
    <div className="sec-head">
      <span className="sec-num">06</span>
      <h2 className="sec-title">Recent Activity</h2>
      <span className="sec-note">{note}</span>
    </div>
  )
}

export default function RecentActivity() {
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] })

  useEffect(() => {
    const base = import.meta.env.BASE_URL || '/'
    const url = (base.endsWith('/') ? base + 'activity.json' : base + '/activity.json')
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`activity fetch failed: ${r.status}`); return r.json() })
      .then(d => { setActivity([...d].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) return (
    <section id="activity" className="section section-alt section-divider">
      <Head note="Loading" />
      <div className="activity-wrap">
        {[1, 2, 3].map(i => <div key={i} className="activity-row">
          <div className="activity-date" />
          <div className="activity-card activity-card-skeleton" />
        </div>)}
      </div>
    </section>
  )

  if (error) return (
    <section id="activity" className="section section-alt section-divider">
      <Head note="Unavailable" />
      <p className="activity-empty">Failed to load recent activity.</p>
    </section>
  )

  if (activity.length === 0) return (
    <section id="activity" className="section section-alt section-divider">
      <Head note="Quiet" />
      <p className="activity-empty">Nothing logged yet — the daily sync will pick this up.</p>
    </section>
  )

  return (
    <section id="activity" className="section section-alt section-divider">
      <Head note={`Last ${activity.length} commits`} />

      <div className="activity-wrap" ref={sectionRef}>
        <motion.div className="activity-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />
        {activity.map((item, i) => (
          <motion.div
            key={`${item.phase}-${item.project}-${i}`}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, delay: Math.min(i, 6) * 0.03, ease }}
            className="activity-row"
          >
            <time className="activity-date">{item.date}</time>
            <div className="activity-body">
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
