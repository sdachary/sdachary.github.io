interface BlogPost {
  slug: string
  title: string
  date: string
  tags: string[]
  body: string
}

const posts: BlogPost[] = [
  {
    slug: 'sampada-serverless-migration',
    title: 'Sampada Left the Single VM',
    date: '2026-11-20',
    tags: ['sampada', 'infra', 'migration', 'scalability'],
    body: `
      <p>Sampada just left the single VM. The refactor was boring on purpose: extract the long-lived state, split the runtime, and move the pieces that deserved serverless treatment to managed functions. The goal was simple: better scalability without giving up the boring parts.</p>
      <p>The migration from oradb to serverless was mostly data-shape work, not architecture theater. The tricky bit was the migration path itself: dual-run the old and new backends against the same database until writes had drained, then cut over. Zero downtime, no dual-schema permanent debt.</p>
      <p>Infra follow-through: Mailrelay moved to Resend for transactional mail, and the Cloudflare config was rebuilt around the new function topology so edge caching and bot rules could finally be expressed properly. Content pipelines that used to queue on a single worker now queue on managed queues.</p>
      <p>Lesson: a single VM is a fine product and a lousy platform. The migration cost was mostly tests we should have written before the first deploy.</p>
    `,
  },
  {
    slug: 'notion-to-github-projects',
    title: 'The Board Moved Houses',
    date: '2026-11-20',
    tags: ['ops', 'notion', 'github', 'migration'],
    body: `
      <p>The task board is no longer Notion. The move to GitHub Projects went live on 2026-11-19, and the old workspace is retired.</p>
      <p>The reason was boring and correct: a task board is only as good as the thing that reads it. Notion was a second brain bolted onto a first class repo. GitHub Projects puts the board next to the code, the issues, the pull requests and the runs, so there is no sync layer between "what we decided" and "what we shipped".</p>
      <p>The migration itself was mostly a cutover. Open cards were imported, the source was closed, and the autonomy loop that used to read the Notion board now reads GitHub directly. Nothing about the loop changed except the address.</p>
      <p>Lesson: write down where the brain lives, or the brain quietly moves somewhere you no longer control.</p>
    `,
  },
  {
    slug: 'hero-floating-board',
    title: 'The Board, Floating',
    date: '2026-11-20',
    tags: ['portfolio', 'manacitra', 'design', '3d'],
    body: `
      <p>The hero used to be a framed screenshot of the switchboard. Same object, flat picture, nothing alive in it.</p>
      <p>Now the hero embeds the board itself via <code>?view=model&amp;quiet=1</code>, and the scene floats. It leans with the pointer through pointer-tracked springs, breathes on its own, and stays quiet: no rail, no search, no legend, no zoom hint. The frame only carries the live dot, a one-line label, and an open-in-fullscreen link.</p>
      <p>Quiet mode is the product decision, not an afterthought. A hero that has to render a search box and a detail card is a hero that is already crowded. The board should show the design. The chrome is for the page.</p>
      <p>Behind it: the three.js scene got a lighting pass that treats the dark board like a physical object, low ambient fill, strong key with a rim, exposure headroom, so the graphite reads as graphite instead of a black box and the indigo stops being decorative and starts being light.</p>
    `,
  },
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
