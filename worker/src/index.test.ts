import { describe, it, expect } from 'vitest'
import worker, { isRateLimited, isRateLimitedLocal, type Env } from './index'

function mockKv(): Env['RATE_LIMIT'] {
  const store = new Map<string, string>()
  return {
    async get(key: string) { return store.get(key) ?? null },
    async put(key: string, value: string) { store.set(key, value) },
  }
}

const ENV: Env = {
  NOTION_TOKEN: 'test-token',
  NOTION_DATABASE_ID: 'test-db',
  RATE_LIMIT: mockKv(),
}

// `Origin` is a forbidden header name, so the Request constructor strips it in
// the test runtime. Cloudflare and browsers do send it, so mock the request.
function post(body: Record<string, unknown>, ip: string, origin = 'https://sdachary.github.io'): Request {
  const headers = new Map<string, string>([
    ['Content-Type', 'application/json'],
    ['CF-Connecting-IP', ip],
    ['Origin', origin],
  ])
  return {
    method: 'POST',
    headers: { get: (key: string) => headers.get(key) ?? null },
    json: async () => body,
  } as unknown as Request
}

const valid = { name: 'Recruiter', email: 'hire@example.com', message: 'Hello there' }

describe('contact worker', () => {
  it('accepts a honeypot submission without writing', async () => {
    const res = await worker.fetch(post({ ...valid, website: 'spam.example' }, '10.0.0.1'), ENV)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('rejects a bad email and an oversized message', async () => {
    const badEmail = await worker.fetch(post({ ...valid, email: 'not-an-email' }, '10.0.0.2'), ENV)
    expect(badEmail.status).toBe(400)
    const huge = await worker.fetch(post({ ...valid, message: 'x'.repeat(5001) }, '10.0.0.3'), ENV)
    expect(huge.status).toBe(400)
  })

  it('rejects a request from an unknown origin', async () => {
    const res = await worker.fetch(post(valid, '10.0.0.4', 'https://evil.example'), ENV)
    expect(res.status).toBe(403)
  })

  it('allows a subdomain of the pages host', async () => {
    const res = await worker.fetch(post({ ...valid, website: 'bot' }, '10.0.0.7', 'https://www.sdachary.github.io'), ENV)
    expect(res.status).toBe(200)
  })

  it('counts requests per ip in kv', async () => {
    const env: Env = { RATE_LIMIT: mockKv() }
    for (let i = 0; i < 5; i++) expect(await isRateLimited(env, '10.1.0.1')).toBe(false)
    expect(await isRateLimited(env, '10.1.0.1')).toBe(true)
    // another ip has its own budget
    expect(await isRateLimited(env, '10.1.0.2')).toBe(false)
  })

  it('falls back to the local counter without a kv binding', async () => {
    expect(isRateLimitedLocal('10.2.0.1', 1000)).toBe(false)
    for (let i = 0; i < 4; i++) expect(isRateLimitedLocal('10.2.0.1', 1000 + i)).toBe(false)
    expect(isRateLimitedLocal('10.2.0.1', 1005)).toBe(true)
    // window slides
    expect(isRateLimitedLocal('10.2.0.1', 1000 + 11 * 60 * 1000)).toBe(false)
  })

  it('returns 429 once the ip budget is spent', async () => {
    const env: Env = { ...ENV, RATE_LIMIT: mockKv() }
    const ip = '10.0.0.6'
    for (let i = 0; i < 5; i++) {
      const res = await worker.fetch(post({ ...valid, website: 'bot' }, ip), env)
      expect(res.status).toBe(200)
    }
    const blocked = await worker.fetch(post({ ...valid, website: 'bot' }, ip), env)
    expect(blocked.status).toBe(429)
  })
})
