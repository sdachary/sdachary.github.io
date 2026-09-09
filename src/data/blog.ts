export interface BlogPost {
  slug: string
  title: string
  date: string
  tags: string[]
  body: string
}

const posts: BlogPost[] = [
  {
    slug: 'sampada-web-push',
    title: 'Web Push Notifications for Sampada',
    date: '2026-09-04',
    tags: ['sampada', 'web-push', 'infrastructure'],
    body: `
      <p>Sampada now sends browser push notifications — real-time alerts for transaction goals, bill reminders, and net worth milestones. The implementation spans the full stack: VAPID key generation, encrypted secret management with SOPS+age, a push subscription API, Sidekiq delivery jobs, and a service worker that handles the push event.</p>
      <p>The trickiest part was the Docker image. Sampada's code is baked into the container image, not volume-mounted. Adding the <code>webpush</code> gem meant a full image rebuild on oradb — the first build took 5+ hours because of native extensions. The solution: install the gem in the running container for immediate effect, then rebuild the image in the background for persistence.</p>
      <p>Secrets management: VAPID keys are generated with Node.js ECDSA P-256, encrypted with SOPS+age (age1w3nwuv...), committed as <code>secrets.enc.env</code>, and decrypted at deploy time via <code>deploy.sh</code>. The age key lives on oradb at <code>~/.config/sops/age/keys.txt</code> — same pattern used across all acharylab services.</p>
      <p>Lesson: OpenSSL 3.0 breaks the <code>webpush</code> gem's key generation (<code>pkeys are immutable</code>). Workaround: generate keys with Node.js crypto, store them encrypted, and skip the gem's generate method entirely.</p>
    `,
  },
  {
    slug: 'indra-redeploy',
    title: 'Indra Returns: n8n on Render',
    date: '2026-09-04',
    tags: ['indra', 'n8n', 'infrastructure'],
    body: `
      <p>Indra — the automation mesh connecting Sampada, Chitragupta, Vishwakarma, and other services — is back online. The previous Render free-tier instance was auto-suspended and deleted in August. This time: pinned to <code>n8nio/n8n:2.37.10</code> (latest stable), connected to self-hosted Supabase PostgreSQL, and backed by a 7-minute keep-alive cron job.</p>
      <p>The repo had three issues to fix before deploy: the Dockerfile pinned n8n 1.87.0 while render.yaml referenced 1.12.0 (version mismatch), the <code>sdachary/n8n-automated-backup</code> repo didn't exist (Auto Sync workflow would 404), and the README still said "NOT DEPLOYED." All resolved in one commit.</p>
      <p>The Auto Sync workflow exports all n8n workflows every minute via the n8n API and commits them to GitHub. It's a one-line insurance policy — if someone accidentally deletes a workflow, it's in the backup repo within 60 seconds.</p>
      <p>Next step: wire up the Kanak→Ledger sync, OCI monitoring, and Telegram bot relay workflows that make Indra the central nervous system of the acharylab fleet.</p>
    `,
  },
  {
    slug: 'indra-open-source',
    title: 'Indra Is Now an Open-Source n8n Template',
    date: '2026-09-09',
    tags: ['indra', 'n8n', 'open-source', 'infrastructure'],
    body: `
      <p>Indra — my n8n automation template — is now open source and self-serve. After the Render free tier deleted the instance (again), I stopped treating it as a one-off deploy and rebuilt the repo as a template anyone can fork and run in minutes.</p>
      <p>The three artifacts that make it work: a Dockerfile pinned to <code>n8nio/n8n:2.38.4</code> with a healthcheck, a 13-line <code>render.yaml</code> with zero per-user values, and an interactive <code>setup.sh</code> that guides you through Supabase or Neon, validates every input, and generates a dashboard-ready env file.</p>
      <p>Config lives in the Render dashboard, not GitHub — so the template carries no secrets by design. In the process I swept the entire git history clean with <code>git-filter-repo</code>: a leaked Supabase host, a GitHub PAT, internal IDs, and stale URLs are all gone. Continuous integration runs gitleaks + hadolint + config validation, and a nightly workflow auto-upgrades n8n behind a healthcheck gate.</p>
      <p>The lesson: a free-tier instance you provision once is a liability. A template with CI, healthcheck-gated upgrades, and git-history hygiene is an asset that keeps regenerating.</p>
    `,
  },
  {
    slug: 'darpan-scan-engine',
    title: 'Building Darpan: An AI Privacy Auditor',
    date: '2026-07-10',
    tags: ['darpan', 'ai', 'security', 'privacy'],
    body: `
      <p>Darpan started as a web scanner that read pages the way a security engineer would. When India's DPDP Act gained traction, the same engine found a sharper job: auditing sites for privacy-compliance gaps — is consent captured before any tracking starts? Are data-handling practices actually disclosed? What PII leaves the browser at all?</p>
      <p>The architecture is uncomplicated: a Cloudflare Worker crawls the target, extracts DOM + JS, sends it to Gemini for analysis, and stores findings in D1. The AI handles what would've been 200 lines of heuristic rules in a single prompt: <code>Analyze this page for consent flows, PII leakage, data retention disclosures, and third-party trackers. Be specific about what you find and how to fix it.</code></p>
      <p>The killer feature turned out to be scheduled audits and PDF reports. You set a URL, pick daily/weekly scans, and get a Slack-ready compliance PDF in your inbox. Built with <strong>ponytail</strong> discipline — the cron handler is 40 lines, the PDF generator wraps html2canvas+jsPDF in a React portal.</p>
      <p>Lessons: AI audits hallucinate findings about 15% of the time, so every finding needs a "confidence" field. Also, rate limiting matters — you can't crawl a production site every 5 minutes without asking.</p>
    `,
  },
  {
    slug: 'sampada-multi-tenant',
    title: 'Sampada Goes Multi-Tenant',
    date: '2026-06-28',
    tags: ['sampada', 'architecture', 'infra'],
    body: `
      <p>Sampada, the personal finance app, got a full multi-tenant refactor. The old model was single-user — great for me, useless for anyone else. The new model: BYO database with API keys, isolated schemas in Postgres, and Rack::Attack rate limiting.</p>
      <p>The migration touched 16 database migrations, the entire auth flow, and every controller. The hardest part was preserving backward compatibility — existing users shouldn't notice the change. Solution: a <code>current_tenant</code> method that checks API key header first, falls back to session-based user, and defaults to the original single-tenant path.</p>
      <p>Deployed on <strong>oradb</strong> (140.245.227.176) with Docker + host Redis + Nginx nip.io proxy at <code>sampada.140.245.227.176.nip.io</code>. The multi-stage Docker build reduced image size from 1.2GB to 480MB.</p>
    `,
  },
  {
    slug: 'mcp-hub-architecture',
    title: 'Building MCP Hub: The AI Router',
    date: '2026-06-20',
    tags: ['mcp-hub', 'architecture', 'ai'],
    body: `
      <p>MCP Hub started as a simple proxy — route prompts to the cheapest available AI model. It grew into something bigger: a skill engine, a workflow orchestrator, a code-review-graph analyzer, and a memory system.</p>
      <p>The architecture is a Python FastAPI server with plugin-based tool registration. Skills are versioned Markdown files with execution metadata. The evolution engine analyzes execution results and auto-improves skills over time.</p>
      <p>The most-used feature is <code>detect_changes</code> — before I edit any repo, this tool tells me what functions I'll affect, what tests might break, and how many tokens I'll save by understanding the code graph first. It's saved me hours of context window waste.</p>
      <p>Running on <strong>oradev</strong> (68.233.97.153), wired into my local coding agents over an SSH tunnel (<code>ssh -fNL 3001:localhost:3000 oradev</code>). Multi-provider model routing sits on top, so agents fail over between providers instead of dying when one route goes stale.</p>
    `,
  },
  {
    slug: 'ponytail-philosophy',
    title: 'Why I Ship Less Code Now',
    date: '2026-06-15',
    tags: ['philosophy', 'engineering'],
    body: `
      <p>I started using <strong>ponytail</strong> — a development philosophy that asks one question before every line of code: "Does this need to exist?"</p>
      <p>The ladder: YAGNI first, then check the codebase (it probably already has what you need), then standard library, then native platform features, then existing dependencies, then one line, then — only then — the minimum code that works.</p>
      <p>The results surprised me. A feature I'd normally estimate at 200 lines became 40. A bug fix that would've touched 3 files was a single guard in a shared function. The code I do write is more correct because I spend more time understanding the problem and less time typing.</p>
      <p>Counterintuitive insight: being lazy about writing code makes you more diligent about reading it. You can't find the one-line fix in a function you haven't traced.</p>
    `,
  },
]

export default posts
