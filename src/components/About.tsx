import { motion } from 'framer-motion'

const paragraphs = [
  <>Started as an <strong>HR professional</strong>. Pivoted hard into data. Taught myself Python at nights, SQL on weekends. Shipped my first analytics dashboard before anyone asked me to.</>,
  <>Now <strong>6+ years</strong> into turning raw, messy data into decisions that moved businesses — from financial investment algorithms to retail sales intelligence. Building systems that scale.</>,
  <>But the day job wasn't enough. So I built an <strong>entire ecosystem from scratch</strong> — AI agents, cloud provisioners, financial engines, compute marketplaces.</>,
  <>The mission: <strong>sovereign, India-resident infrastructure</strong>. No foreign dependencies. No vendor lock-in. Just systems that last.</>,
]

const ease = [0.32, 0.72, 0, 1] as const

export default function About() {
  return (
    <section id="about" className="section about-grid">
      <div className="about-sticky">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease }}
          className="about-big-number"
          aria-hidden="true"
        >
          6+
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3, ease }}
          className="about-big-label"
        >
          Years of Impact
        </motion.div>
      </div>

      <div className="about-body">
        {paragraphs.map((p, i) => (
          <div className="about-clip-wrap" key={i}>
            <motion.p
              initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
              whileInView={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.15, ease }}
              className="about-text"
            >{p}</motion.p>
          </div>
        ))}
      </div>
    </section>
  )
}
