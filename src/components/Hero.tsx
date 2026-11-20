import { motion, useReducedMotion, useMotionValue, useSpring, useTransform } from 'motion/react'
import type { MouseEvent } from 'react'

const ease = [0.22, 1, 0.36, 1] as const

export default function Hero() {
  const reduce = useReducedMotion()

  const enter = (delay: number) =>
    reduce
      ? { initial: false as const, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, delay, ease },
        }

  // the board floats and leans with the pointer — a framed screenshot reads
  // flat, the same object reads as a physical thing in the room
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const rotateX = useSpring(useTransform(my, [0, 1], [7, -7]), { stiffness: 130, damping: 17 })
  const rotateY = useSpring(useTransform(mx, [0, 1], [-7, 7]), { stiffness: 130, damping: 17 })
  const scaleX = useSpring(useTransform(mx, [0, 1], [0.98, 1.02]), { stiffness: 130, damping: 17 })
  const scaleY = useSpring(useTransform(my, [0, 1], [1.02, 0.98]), { stiffness: 130, damping: 17 })

  const onMove = (e: MouseEvent<HTMLElement>) => {
    if (reduce) return
    const r = e.currentTarget.getBoundingClientRect()
    mx.set(r.width ? (e.clientX - r.left) / r.width : 0.5)
    my.set(r.height ? (e.clientY - r.top) / r.height : 0.5)
  }
  const onLeave = () => {
    if (reduce) return
    mx.set(0.5)
    my.set(0.5)
  }

  return (
    <section id="hero" className="hero">
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-glow" aria-hidden="true" />
      </div>

      <div className="hero-grid">
        <div className="hero-copy">
          <motion.p {...enter(0)} className="hero-meta">
            Senior Data Analyst · AI Architect · Hyderabad
          </motion.p>

          <motion.h1 {...enter(0.08)} className="hero-headline">
            Messy data in.
            <br />
            <span className="hero-headline-em">Decisions out.</span>
          </motion.h1>

          <motion.p {...enter(0.16)} className="hero-lede">
            Senior Data Analyst at Lloyds. I build the pipelines, dashboards and
            agents that turn raw records into something a team can act on.
          </motion.p>

          <motion.div {...enter(0.24)} className="hero-actions">
            <a href="#projects" className="hero-cta">
              View the work
              <span className="hero-cta-icon" aria-hidden="true">→</span>
            </a>
            <a href="/resume.pdf" target="_blank" rel="noreferrer" className="hero-link">
              Résumé <span aria-hidden="true">↗</span>
            </a>
          </motion.div>
        </div>

        <motion.figure
          {...enter(0.3)}
          className="hero-map"
          style={{ rotateX, rotateY, scaleX, scaleY }}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
        >
          <motion.div
            className="hero-map-float"
            animate={reduce ? { y: 0 } : { y: [0, -9, 0] }}
            transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="hero-map-bar">
              <span className="hero-map-live" aria-hidden="true" />
              <span className="hero-map-label">Mānacitra · live infrastructure map</span>
              <a
                href={import.meta.env.BASE_URL + 'manacitra.html'}
                className="hero-map-open"
                target="_blank"
                rel="noreferrer"
              >
                Full screen ↗
              </a>
            </div>
            <div className="hero-map-frame">
              <iframe
                src={import.meta.env.BASE_URL + 'manacitra.html?view=model&quiet=1'}
                title="Mānacitra — live map of the projects and services I run"
                loading="lazy"
                className="hero-map-iframe"
              />
            </div>
            <figcaption className="hero-map-caption">
              Every node is a service I built and operate. Click one to open it.
            </figcaption>
          </motion.div>
        </motion.figure>
      </div>
    </section>
  )
}
