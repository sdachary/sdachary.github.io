export interface Env {
  NOTION_TOKEN?: string
  NOTION_DATABASE_ID?: string
}

const ALLOWED_ORIGINS = ['https://sdachary.github.io', 'http://localhost:5173', 'http://localhost:4173']

const NAME_FIELD = 'Name'
const EMAIL_FIELD = 'Email'
const MESSAGE_FIELD = 'Message'

const NOTION_API_URL = 'https://api.notion.com/v1/pages'

// Trust-boundary limits: a contact form does not need a 10 KB "message".
const FIELD_MAX = { name: 100, email: 254, message: 5000 }
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const hits = new Map<string, number[]>()

// ponytail: in-memory per-isolate limiter. Move to KV or Durable Objects if
// real traffic ever needs a global budget across isolates.
export function isRateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    hits.set(ip, recent)
    return true
  }
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 10_000) {
    for (const [key, times] of hits) {
      if (times.every(t => now - t >= RATE_LIMIT_WINDOW_MS)) hits.delete(key)
    }
  }
  return false
}

function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

// The Pages site may be reached on a subdomain of the same GitHub Pages host.
function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9.-]+\.sdachary\.github\.io$/.test(origin)
}

function cleanField(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return null
  return trimmed
}

function corsHeaders(origin: string): Record<string, string> {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

async function appendToNotion(env: Env, name: string, email: string, message: string): Promise<{ ok: boolean; detail: string }> {
  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
    return { ok: false, detail: 'worker not configured (NOTION_TOKEN / NOTION_DATABASE_ID missing)' }
  }
  const res = await fetch(NOTION_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { database_id: env.NOTION_DATABASE_ID },
      properties: {
        [NAME_FIELD]: { title: [{ text: { content: name } }] },
        [EMAIL_FIELD]: { email },
        [MESSAGE_FIELD]: { rich_text: [{ text: { content: message } }] },
      },
    }),
  })
  const detail = await res.text()
  return { ok: res.ok, detail }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || ''
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    // Browser requests must come from the site. Requests with no Origin
    // (curl, server-to-server) are allowed but rate limited.
    if (origin && !isAllowedOrigin(origin)) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403, headers: { ...corsHeaders(''), 'Content-Type': 'application/json' },
      })
    }

    const headers = corsHeaders(origin)

    if (isRateLimited(clientIp(request))) {
      return new Response(JSON.stringify({ error: 'Too many requests, try again later' }), {
        status: 429,
        headers: { ...headers, 'Content-Type': 'application/json', 'Retry-After': '600' },
      })
    }

    try {
      const body: Record<string, unknown> = await request.json()
      const { name, email, message, website } = body as { name?: unknown; email?: unknown; message?: unknown; website?: unknown }

      // Honeypot: a real user never fills the hidden "website" field. Silently
      // accept so bots see success, but never write to Notion.
      if (typeof website === 'string' && website.length > 0) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }

      const cleanName = cleanField(name, FIELD_MAX.name)
      const cleanEmail = cleanField(email, FIELD_MAX.email)
      const cleanMessage = cleanField(message, FIELD_MAX.message)

      if (!cleanName || !cleanEmail || !cleanMessage || !EMAIL_RE.test(cleanEmail)) {
        return new Response(JSON.stringify({ error: 'name, valid email, and message are required' }), {
          status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }

      const result = await appendToNotion(env, cleanName, cleanEmail, cleanMessage)
      if (!result.ok) {
        console.error('Notion rejected:', result.detail)
        return new Response(JSON.stringify({ error: 'Notion rejected the submission' }), {
          status: 502, headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...headers, 'Content-Type': 'application/json' },
      })
    } catch {
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500, headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }
  },
}