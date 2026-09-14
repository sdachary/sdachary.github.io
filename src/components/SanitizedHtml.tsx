import { createElement, useMemo, type ReactNode } from 'react'

// Blog bodies are hand-authored HTML in src/data/blog.ts (trusted, static
// content). Rendering still goes through a whitelist so no raw HTML ever
// reaches the live document: arbitrary tags, event handlers, and javascript:
// links are dropped at parse time.
const ALLOWED = new Set(['P', 'CODE', 'STRONG', 'EM', 'BR', 'A', 'UL', 'OL', 'LI', 'H3', 'H4'])
const SAFE_HREF = /^(https?:|mailto:|#|\/)/i

function sanitizeNode(node: ChildNode, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent
  if (node.nodeType !== Node.ELEMENT_NODE) return null
  const el = node as Element
  const tag = el.tagName.toUpperCase()
  if (!ALLOWED.has(tag)) return null

  const props: Record<string, unknown> = { key }
  if (tag === 'A') {
    const href = el.getAttribute('href')
    if (href && SAFE_HREF.test(href)) props.href = href
  }

  const children = Array.from(el.childNodes)
    .map((c, i) => sanitizeNode(c, i))
    .filter((n): n is ReactNode => n !== null && n !== '')
  return children.length === 0
    ? createElement(tag.toLowerCase(), props)
    : createElement(tag.toLowerCase(), props, ...children)
}

export default function SanitizedHtml({ html }: { html: string }) {
  return useMemo(() => {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
    return <>{Array.from(doc.body.childNodes).map((c, i) => sanitizeNode(c, i))}</>
  }, [html])
}