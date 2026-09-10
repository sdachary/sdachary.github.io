import { useState } from 'react'
import { motion } from 'framer-motion'

const links = [
  { href: 'mailto:deepakachary246@gmail.com', label: 'deepakachary246@gmail.com' },
  { href: 'https://www.linkedin.com/in/sdeepakachary/', label: 'LinkedIn' },
  { href: 'https://x.com/sdeepakachary', label: 'Twitter/X' },
  { href: 'https://github.com/sdachary', label: 'GitHub' },
]

const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL

const ease = [0.32, 0.72, 0, 1] as const

export default function Contact() {
  const year = new Date().getFullYear()
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus('sending')
    const form = e.currentTarget
    const data = new FormData(form)
    try {
      if (!WEBHOOK_URL) { setStatus('error'); return }
      const body = Object.fromEntries(data.entries())
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) { setStatus('success'); form.reset() }
      else setStatus('error')
    } catch { setStatus('error') }
  }

  return (
    <section id="contact" className="section section-alt section-divider" style={{ position: 'relative' }}>
      <div className="contact-bg-text" aria-hidden="true">DEEPAK</div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100 }}>
        <div className="section-header">
          <h2 className="section-title">Let's Connect</h2>
        </div>

        <div className="contact-grid">
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease }}
              className="contact-headline"
            >
              READY<br />TO BUILD<br />TOGETHER?
            </motion.h2>

            <nav className="contact-links" aria-label="Contact links">
              {links.map((l, i) => (
                <motion.a
                  key={i}
                  href={l.href}
                  target={l.href.startsWith('http') ? '_blank' : undefined}
                  rel={l.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.2 + i * 0.08, ease }}
                  className="contact-link"
                >
                  → {l.label}
                </motion.a>
              ))}
            </nav>
          </div>

          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2, ease }}
            className="contact-form"
            aria-label="Contact form"
          >
            <div className="contact-form-label">Send a message</div>
            <div className="contact-form-fields">
              <input name="name" placeholder="Your Name" aria-label="Your Name" required className="contact-input" />
              <input name="email" type="email" placeholder="Your Email" aria-label="Your Email" required className="contact-input" />
              <textarea name="message" placeholder="Tell me about your project..." aria-label="Your Message" required rows={4} className="contact-input" style={{ resize: 'vertical', minHeight: 100 }} />
              <button type="submit" disabled={status === 'sending'} className="contact-btn">
                {status === 'sending' ? 'Sending…' : 'Send Message →'}
              </button>
              <div aria-live="polite">
                {status === 'success' && (
                  <p className="contact-success">✓ Message sent! I'll get back to you soon.</p>
                )}
                {status === 'error' && (
                  <p className="contact-error">✗ Something went wrong. Try emailing directly at deepakachary246@gmail.com</p>
                )}
              </div>
            </div>
          </motion.form>
        </div>

        <footer className="contact-footer">
          <div className="contact-footer-text">© {year} S Deepak Achary</div>
          <div className="contact-footer-text">Hyderabad, India — Built with intent.</div>
        </footer>
      </div>
    </section>
  )
}
