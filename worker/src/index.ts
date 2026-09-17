export interface Env {
  NOTION_TOKEN?: string
  NOTION_DATABASE_ID?: string
}

const ALLOWED_ORIGINS = ['https://sdachary.github.io', 'http://localhost:5173', 'http://localhost:4173']

const NAME_FIELD = 'Name'
const EMAIL_FIELD = 'Email'
const MESSAGE_FIELD = 'Message'

const NOTION_API_URL = 'https://api.notion.com/v1/pages'

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

    const headers = corsHeaders(origin)

    try {
      const body: Record<string, unknown> = await request.json()
      const { name, email, message, website } = body as { name?: string; email?: string; message?: string; website?: string }

      // Honeypot: a real user never fills the hidden "website" field. Silently
      // accept so bots see success, but never write to Notion.
      if (typeof website === 'string' && website.length > 0) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }

      if (!name || !email || !message) {
        return new Response(JSON.stringify({ error: 'name, email, and message are required' }), {
          status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }

      const result = await appendToNotion(env, name, email, message)
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