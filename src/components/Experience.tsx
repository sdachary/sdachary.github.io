import { motion } from 'motion/react'
import experience from '../data/experience'

const ease = [0.22, 1, 0.36, 1] as const

export default function Experience() {
  return (
    <section id="experience" className="section section-divider">
      <div className="sec-head">
        <span className="sec-num">01</span>
        <h2 className="sec-title">Experience</h2>
        <span className="sec-note">Nine years, three industries</span>
      </div>

      <div className="exp-list">
        {experience.map((exp, i) => {
          const [when, place] = exp.period.split('·').map(s => s.trim())
          // Dense roles read as a list, short ones stay prose.
          const points = exp.desc.split('. ').map((s, j, all) => (j < all.length - 1 ? s + '.' : s)).filter(Boolean)
          return (
            <motion.article
              key={exp.company}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.06, ease }}
              className="exp-row"
            >
              <div className="exp-when">
                <span className={when.includes('Present') ? 'exp-when-now' : undefined}>{when}</span>
                {place && <span className="exp-when-place">{place}</span>}
              </div>
              <div>
                <h3 className="exp-company">{exp.company}</h3>
                <p className="exp-role">{exp.role}</p>
                {points.length > 2 ? (
                  <ul className="exp-points">
                    {points.map(point => <li key={point}>{point}</li>)}
                  </ul>
                ) : (
                  <p className="exp-desc">{exp.desc}</p>
                )}
              </div>
            </motion.article>
          )
        })}
      </div>
    </section>
  )
}
