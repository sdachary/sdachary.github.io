import { useState, useMemo } from 'react'
import { motion, type Variants } from 'framer-motion'
import posts from '../data/blog'
import SanitizedHtml from './SanitizedHtml'

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

const ease = [0.32, 0.72, 0, 1] as const

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
}

export default function Blog() {
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const allTags = [...new Set(posts.flatMap(p => p.tags))]
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return (activeFilter ? posts.filter(p => p.tags.includes(activeFilter)) : posts)
      .filter(p => !q || p.title.toLowerCase().includes(q) || p.tags.some(t => t.includes(q)) || p.body.toLowerCase().includes(q))
  }, [activeFilter, search])

  return (
    <section id="blog" className="section section-alt section-divider">
      <div className="section-header">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          className="section-title"
        >Blog</motion.h2>
      </div>

      <div className="blog-controls">
        <div className="blog-search-wrap">
          <input
            className="blog-search"
            placeholder="Search posts…"
            aria-label="Search blog posts"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="blog-filter">
          <button
            className={`blog-filter-btn ${activeFilter === null ? 'active' : ''}`}
            onClick={() => setActiveFilter(null)}
            aria-pressed={activeFilter === null}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              className={`blog-filter-btn ${activeFilter === tag ? 'active' : ''}`}
              onClick={() => setActiveFilter(tag)}
              aria-pressed={activeFilter === tag}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="blog-grid"
      >
        {filtered.length === 0 && (
          <p className="blog-empty">No posts match your search. Try a different query.</p>
        )}
        {filtered.map((post) => (
          <motion.article
            key={post.slug}
            variants={item}
            className="blog-post"
          >
            <div className="blog-meta">
              <time className="blog-date">{fmtDate(post.date)}</time>
              {post.tags.map(tag => (
                <span key={tag} className="blog-tag">{tag}</span>
              ))}
            </div>
            <h3 className="blog-title">
              <a id={post.slug} href={`#${post.slug}`} className="blog-title-link">{post.title}</a>
            </h3>
            <div className="blog-body"><SanitizedHtml html={post.body} /></div>
          </motion.article>
        ))}
      </motion.div>
    </section>
  )
}
