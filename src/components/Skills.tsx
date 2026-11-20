import { motion } from 'motion/react'
import skills from '../data/skills'

const ease = [0.22, 1, 0.36, 1] as const

// Preserve the source order of categories, group the names under each.
const groups = skills.reduce<{ name: string; items: string[] }[]>((acc, s) => {
  const group = acc.find(g => g.name === s.category)
  if (group) group.items.push(s.name)
  else acc.push({ name: s.category, items: [s.name] })
  return acc
}, [])

export default function Skills() {
  return (
    <section id="skills" className="section">
      <div className="sec-head">
        <span className="sec-num">02</span>
        <h2 className="sec-title">Stack</h2>
        <span className="sec-note">{skills.length} tools in daily use</span>
      </div>

      <div className="skill-groups">
        {groups.map((g, i) => (
          <motion.div
            key={g.name}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, delay: i * 0.05, ease }}
            className="skill-group"
          >
            <h3 className="skill-group-name">{g.name}</h3>
            <p className="skill-group-list">
              {g.items.map((name, j) => (
                <span key={name}>
                  {j > 0 && <span className="skill-group-sep" aria-hidden="true">·</span>}
                  {name}
                </span>
              ))}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
