export interface Skill {
  category: string
  name: string
}

export interface Experience {
  company: string
  role: string
  period: string
  desc: string
}

export interface Project {
  name: string
  slug: string
  status: string
  status_key: 'live' | 'progress' | 'local' | 'open-source'
  description: string
  tags?: string[]
  live_url?: string | null
  github_url?: string | null
  local?: boolean
  last_updated?: string | null
  github_remote?: string | null
}

export interface WorkTrack {
  role: string
  subtitle: string
  target: string
  desc: string
  cta: string
  href: string
  accent: string
}

export interface ActivityEntry {
  kind?: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'build' | 'perf' | 'test' | 'chore'
  phase: string
  project: string
  description: string
  date: string
  status: 'active' | 'completed' | 'blocked'
  count?: number
}
