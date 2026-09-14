import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const links = [
  { href: '#about', label: 'Origin' },
  { href: '#experience', label: 'Experience' },
  { href: '#skills', label: 'Stack' },
  { href: '#projects', label: 'Projects' },
  { href: '#manacitra', label: 'Manacitra' },
  { href: '#blog', label: 'Blog' },
  { href: '#work', label: 'Work' },
  { href: '#contact', label: 'Contact' },
]

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    const stored = localStorage.getItem('theme') as 'dark' | 'light' | null
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
  }

  return { theme, toggle }
}

function NavLinkList({ activeSection, onNavigate, itemClass }: { activeSection: string; onNavigate: () => void; itemClass: string }) {
  return (
    <ul className={itemClass}>
      {links.map(l => (
        <li key={l.href}>
          <a
            href={l.href}
            className={`navbar-link${activeSection === l.href.slice(1) ? ' active' : ''}`}
            onClick={onNavigate}
          >
            {l.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

function SectionObserver({ onActive }: { onActive: (id: string) => void }) {
  useEffect(() => {
    const ids = links.map(l => l.href.slice(1))
    const observer = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) onActive(e.target.id)
        }
      },
      { rootMargin: '-40% 0px -55% 0px' }
    )
    const observed = new Set<string>()
    let timer: ReturnType<typeof setTimeout>
    let retries = 0

    function scan() {
      for (const id of ids) {
        if (observed.has(id)) continue
        const el = document.getElementById(id)
        if (el) {
          observer.observe(el)
          observed.add(id)
        }
      }
      if (observed.size < ids.length && retries < 50) {
        retries++
        timer = setTimeout(scan, 150)
      }
    }
    scan()

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [onActive])
  return null
}

export default function Navbar() {
  const [visible, setVisible] = useState(false)
  const [activeSection, setActiveSection] = useState('about')
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => {
      const about = document.getElementById('about')
      if (!about) return
      setVisible(about.getBoundingClientRect().top < window.innerHeight * 0.8)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    const onClick = (e: MouseEvent) => { if (navRef.current && !navRef.current.contains(e.target as Node)) setMobileOpen(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick) }
  }, [mobileOpen])

  return (
    <>
      <SectionObserver onActive={setActiveSection} />
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            className="nav-wrap"
          >
            <nav className="navbar" ref={navRef} aria-label="Main navigation">
              <div className="navbar-brand">SDA</div>
              <div className="nav-group">
                <NavLinkList activeSection={activeSection} onNavigate={() => setMobileOpen(false)} itemClass="navbar-links" />
                <div className="nav-divider" />
                <button
                  onClick={toggle}
                  className="theme-toggle"
                  aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                  {theme === 'dark' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  )}
                </button>
              </div>
              <button
                className="hamburger"
                onClick={() => setMobileOpen(o => !o)}
                aria-expanded={mobileOpen}
                aria-label="Toggle navigation menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
            </nav>
            <AnimatePresence>
              {mobileOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                  className="nav-mobile"
                >
                  <NavLinkList activeSection={activeSection} onNavigate={() => setMobileOpen(false)} itemClass="nav-mobile-links" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
