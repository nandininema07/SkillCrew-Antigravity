/**
 * Roadmap.sh–style weekly syllabi per role archetype.
 * Archie selects a track from the user's target role string; later from API + Nova.
 */

export type RoleArchetype =
  | 'fullstack'
  | 'frontend'
  | 'backend'
  | 'data'
  | 'devops'
  | 'leadership'
  | 'generic'

export interface WeeklyTimelineEntry {
  week: number
  /** Short theme line */
  title: string
  /** Topics / skills for this week (like roadmap.sh nodes) */
  topics: string[]
}

export interface WeeklyTimelineResult {
  archetype: RoleArchetype
  archetypeLabel: string
  /** Human-readable phase groupings for the syllabus */
  phases: { name: string; weekStart: number; weekEnd: number }[]
  weeks: WeeklyTimelineEntry[]
  totalWeeks: number
}

const ROLE_PATTERNS: { archetype: RoleArchetype; label: string; patterns: RegExp[] }[] = [
  {
    archetype: 'fullstack',
    label: 'Full-stack web',
    patterns: [/full[\s-]?stack/i, /mern/i, /mevn/i, /next\.?js/i, /react.*node/i],
  },
  {
    archetype: 'frontend',
    label: 'Frontend',
    patterns: [/front[\s-]?end/i, /react developer/i, /ui engineer/i, /web developer/i],
  },
  {
    archetype: 'backend',
    label: 'Backend',
    patterns: [/back[\s-]?end/i, /api engineer/i, /server/i, /\bgolang\b/i, /java developer/i],
  },
  {
    archetype: 'data',
    label: 'Data & ML',
    patterns: [/data scientist/i, /ml engineer/i, /machine learning/i, /analytics/i, /data engineer/i],
  },
  {
    archetype: 'devops',
    label: 'DevOps / SRE',
    patterns: [/devops/i, /sre/i, /platform engineer/i, /cloud engineer/i, /kubernetes/i],
  },
  {
    archetype: 'leadership',
    label: 'Leadership',
    patterns: [/lead/i, /manager/i, /director/i, /vp/i, /head of/i, /corporate/i, /executive/i],
  },
]

export function detectRoleArchetype(rawTargetRole: string): RoleArchetype {
  const s = rawTargetRole.trim()
  for (const { archetype, patterns } of ROLE_PATTERNS) {
    if (patterns.some((p) => p.test(s))) return archetype
  }
  return 'generic'
}

/** Full-stack: comprehensive path similar to popular roadmap.sh guides. */
function timelineFullstack(): WeeklyTimelineEntry[] {
  return [
    { week: 1, title: 'Web foundations', topics: ['HTML5 semantic', 'CSS3 layout (Flexbox/Grid)', 'JS syntax & types'] },
    { week: 2, title: 'Browser & DOM', topics: ['DOM API', 'Events & delegation', 'Forms & validation'] },
    { week: 3, title: 'Modern JS', topics: ['ES modules', 'Async/await', 'Fetch & HTTP basics'] },
    { week: 4, title: 'Tooling', topics: ['Git workflow', 'npm/pnpm', 'DevTools & debugging'] },
    { week: 5, title: 'Node runtime', topics: ['Node.js basics', 'CommonJS vs ESM', 'fs & path'] },
    { week: 6, title: 'HTTP & APIs', topics: ['REST design', 'Status codes', 'Express or Fastify intro'] },
    { week: 7, title: 'Data layer', topics: ['SQL basics', 'PostgreSQL', 'Indexes & joins'] },
    { week: 8, title: 'ORM & migrations', topics: ['Prisma/Drizzle or ORM', 'Schema migrations', 'Seeding'] },
    { week: 9, title: 'Frontend framework I', topics: ['React (or Vue) setup', 'Components & props', 'JSX'] },
    { week: 10, title: 'Frontend framework II', topics: ['State (hooks)', 'Routing', 'Data fetching patterns'] },
    { week: 11, title: 'Auth', topics: ['Sessions vs JWT', 'Password hashing', 'OAuth2 concepts'] },
    { week: 12, title: 'Testing', topics: ['Unit tests (Vitest/Jest)', 'API integration tests', 'Mocking'] },
    { week: 13, title: 'Quality & DX', topics: ['ESLint/Prettier', 'TypeScript on the stack', 'Env & secrets'] },
    { week: 14, title: 'Containers & deploy', topics: ['Docker basics', 'CI pipeline (GitHub Actions)', 'Deploy to Vercel/Railway/Fly'] },
    { week: 15, title: 'Full-stack project I', topics: ['Auth + CRUD app', 'Pagination', 'Error handling'] },
    { week: 16, title: 'Capstone & polish', topics: ['Performance', 'Security checklist', 'Observability basics', 'Portfolio demo'] },
  ]
}

function timelineFrontend(): WeeklyTimelineEntry[] {
  return [
    { week: 1, title: 'Core web', topics: ['HTML/CSS', 'Responsive design', 'Accessibility basics'] },
    { week: 2, title: 'JS deep dive', topics: ['Closures', 'this', 'Event loop'] },
    { week: 3, title: 'DOM mastery', topics: ['Virtual DOM concepts', 'Performance patterns'] },
    { week: 4, title: 'Tooling', topics: ['Vite/Webpack', 'Git', 'Package managers'] },
    { week: 5, title: 'React/Vue core', topics: ['Components', 'Props/state', 'Effects'] },
    { week: 6, title: 'Routing & data', topics: ['SPA routing', 'Loaders', 'Caching'] },
    { week: 7, title: 'Styling at scale', topics: ['CSS Modules/Tailwind', 'Design tokens', 'Dark mode'] },
    { week: 8, title: 'Testing UI', topics: ['Vitest + RTL', 'E2E with Playwright'] },
    { week: 9, title: 'Advanced patterns', topics: ['Composition', 'Performance (memo, lists)', 'Suspense'] },
    { week: 10, title: 'Ship', topics: ['Bundle analysis', 'Core Web Vitals', 'Production deploy'] },
  ]
}

function timelineBackend(): WeeklyTimelineEntry[] {
  return [
    { week: 1, title: 'Languages & runtime', topics: ['Pick stack (Node/Go/Java)', 'Runtime model'] },
    { week: 2, title: 'HTTP & APIs', topics: ['REST', 'Idempotency', 'Versioning'] },
    { week: 3, title: 'Databases', topics: ['SQL', 'Transactions', 'Migrations'] },
    { week: 4, title: 'AuthN/Z', topics: ['JWT, sessions', 'RBAC', 'OAuth2'] },
    { week: 5, title: 'Caching & queues', topics: ['Redis', 'Message queues', 'Background jobs'] },
    { week: 6, title: 'Observability', topics: ['Structured logging', 'Metrics', 'Tracing'] },
    { week: 7, title: 'Testing', topics: ['Unit', 'Contract tests', 'Load testing intro'] },
    { week: 8, title: 'Security', topics: ['OWASP API', 'Secrets', 'Rate limiting'] },
    { week: 9, title: 'Deploy & ops', topics: ['Docker', 'CI/CD', 'Blue/green'] },
    { week: 10, title: 'Capstone API', topics: ['Design doc', 'Implementation', 'Runbooks'] },
  ]
}

function timelineData(): WeeklyTimelineEntry[] {
  return [
    { week: 1, title: 'Math & stats', topics: ['Probability', 'Distributions', 'Hypothesis testing'] },
    { week: 2, title: 'Python & tools', topics: ['NumPy', 'Pandas', 'Jupyter'] },
    { week: 3, title: 'SQL for analytics', topics: ['Joins', 'Window functions', 'CTE'] },
    { week: 4, title: 'Visualization', topics: ['Matplotlib/Plotly', 'Storytelling'] },
    { week: 5, title: 'ML foundations', topics: ['Supervised learning', 'Train/test split', 'Metrics'] },
    { week: 6, title: 'Models', topics: ['Linear/logistic', 'Trees', 'Ensembles'] },
    { week: 7, title: 'Feature work', topics: ['Encoding', 'Imputation', 'Pipelines'] },
    { week: 8, title: 'Deep learning intro', topics: ['Neural nets', 'Framework intro', 'GPU basics'] },
    { week: 9, title: 'MLOps lite', topics: ['Experiment tracking', 'Model registry', 'Batch inference'] },
    { week: 10, title: 'Ethics & deploy', topics: ['Bias', 'Monitoring', 'Presentation'] },
  ]
}

function timelineDevops(): WeeklyTimelineEntry[] {
  return [
    { week: 1, title: 'Linux & shell', topics: ['Bash', 'Processes', 'Permissions'] },
    { week: 2, title: 'Networking', topics: ['DNS', 'TLS', 'Load balancers'] },
    { week: 3, title: 'IaC', topics: ['Terraform basics', 'State', 'Modules'] },
    { week: 4, title: 'Containers', topics: ['Dockerfile', 'Multi-stage', 'Compose'] },
    { week: 5, title: 'Kubernetes', topics: ['Pods', 'Deployments', 'Services', 'Ingress'] },
    { week: 6, title: 'CI/CD', topics: ['Pipelines', 'Artifacts', 'GitOps intro'] },
    { week: 7, title: 'Observability', topics: ['Prometheus', 'Grafana', 'Logs'] },
    { week: 8, title: 'Security', topics: ['Secrets mgmt', 'IAM', 'Supply chain'] },
    { week: 9, title: 'Cloud', topics: ['VPC', 'S3/DBs', 'Cost controls'] },
    { week: 10, title: 'Reliability', topics: ['SLOs', 'On-call', 'Postmortems'] },
  ]
}

function timelineLeadership(): WeeklyTimelineEntry[] {
  return [
    { week: 1, title: 'Context & strategy', topics: ['Role expectations', 'Stakeholder map', 'Success metrics'] },
    { week: 2, title: 'Communication', topics: ['1:1s', 'Feedback models', 'Difficult conversations'] },
    { week: 3, title: 'Execution', topics: ['Prioritization', 'Roadmaps', 'RACI'] },
    { week: 4, title: 'People', topics: ['Hiring loop', 'Onboarding', 'Growth plans'] },
    { week: 5, title: 'Culture', topics: ['Psychological safety', 'Norms', 'Remote/hybrid'] },
    { week: 6, title: 'Data & decisions', topics: ['Metrics that matter', 'Narratives', 'Reviews'] },
    { week: 7, title: 'Influence', topics: ['Cross-functional work', 'Exec updates', 'Conflict'] },
    { week: 8, title: 'Capstone', topics: ['Personal leadership plan', '30‑60‑90', 'Peer feedback'] },
  ]
}

function timelineGeneric(): WeeklyTimelineEntry[] {
  return [
    { week: 1, title: 'Foundations', topics: ['Role expectations', 'Core vocabulary', 'Success metrics'] },
    { week: 2, title: 'Skills audit', topics: ['Gap analysis', 'Learning plan', 'Resources'] },
    { week: 3, title: 'Deep work I', topics: ['Guided practice', 'Mini projects', 'Quiz checkpoints'] },
    { week: 4, title: 'Deep work II', topics: ['Integration', 'Peer review', 'Iteration'] },
    { week: 5, title: 'Assessment', topics: ['Capstone', 'Portfolio', 'Next steps'] },
  ]
}

function phasesFor(archetype: RoleArchetype, totalWeeks: number): { name: string; weekStart: number; weekEnd: number }[] {
  switch (archetype) {
    case 'fullstack':
      return [
        { name: 'Foundations (web + JS)', weekStart: 1, weekEnd: 4 },
        { name: 'Server & APIs', weekStart: 5, weekEnd: 8 },
        { name: 'Client framework & auth', weekStart: 9, weekEnd: 12 },
        { name: 'Ship & scale', weekStart: 13, weekEnd: 16 },
      ]
    case 'frontend':
      return [
        { name: 'Foundations', weekStart: 1, weekEnd: 4 },
        { name: 'Framework & UI', weekStart: 5, weekEnd: 8 },
        { name: 'Polish & ship', weekStart: 9, weekEnd: 10 },
      ]
    case 'backend':
      return [
        { name: 'Core API & data', weekStart: 1, weekEnd: 4 },
        { name: 'Scale & reliability', weekStart: 5, weekEnd: 8 },
        { name: 'Security & capstone', weekStart: 9, weekEnd: 10 },
      ]
    case 'data':
      return [
        { name: 'Analytics & SQL', weekStart: 1, weekEnd: 4 },
        { name: 'ML core', weekStart: 5, weekEnd: 8 },
        { name: 'Ops & ethics', weekStart: 9, weekEnd: 10 },
      ]
    case 'devops':
      return [
        { name: 'Foundations', weekStart: 1, weekEnd: 4 },
        { name: 'K8s & CI', weekStart: 5, weekEnd: 8 },
        { name: 'Prod readiness', weekStart: 9, weekEnd: 10 },
      ]
    case 'leadership':
      return [
        { name: 'Lead self & team', weekStart: 1, weekEnd: 4 },
        { name: 'Org & execution', weekStart: 5, weekEnd: 8 },
      ]
    default:
      return [{ name: 'Full syllabus', weekStart: 1, weekEnd: totalWeeks }]
  }
}

export function buildWeeklyTimeline(archetype: RoleArchetype): WeeklyTimelineResult {
  const labelMap: Record<RoleArchetype, string> = {
    fullstack: 'Full-stack web',
    frontend: 'Frontend',
    backend: 'Backend',
    data: 'Data & ML',
    devops: 'DevOps / SRE',
    leadership: 'Leadership',
    generic: 'Professional skills',
  }

  const builders: Record<RoleArchetype, () => WeeklyTimelineEntry[]> = {
    fullstack: timelineFullstack,
    frontend: timelineFrontend,
    backend: timelineBackend,
    data: timelineData,
    devops: timelineDevops,
    leadership: timelineLeadership,
    generic: timelineGeneric,
  }

  const weeks = builders[archetype]()
  const totalWeeks = weeks.length
  return {
    archetype,
    archetypeLabel: labelMap[archetype],
    phases: phasesFor(archetype, totalWeeks),
    weeks,
    totalWeeks,
  }
}

export function buildWeeklyTimelineForRoleString(rawTargetRole: string): WeeklyTimelineResult {
  return buildWeeklyTimeline(detectRoleArchetype(rawTargetRole))
}

const UPSKILL_WEEK_CAP = 8

function phasesClippedToMaxWeek(
  phases: { name: string; weekStart: number; weekEnd: number }[],
  maxWeek: number,
): { name: string; weekStart: number; weekEnd: number }[] {
  return phases
    .map((p) => ({
      name: p.name,
      weekStart: Math.max(1, p.weekStart),
      weekEnd: Math.min(p.weekEnd, maxWeek),
    }))
    .filter((p) => p.weekStart <= p.weekEnd)
}

/**
 * Shorter “upskill” sprint from the same archetype syllabus — core skill gaps only,
 * not the full job-ready / portfolio arc.
 */
export function buildUpskillWeeklyTimelineForRoleString(rawTargetRole: string): WeeklyTimelineResult {
  const full = buildWeeklyTimelineForRoleString(rawTargetRole)
  const n = Math.min(UPSKILL_WEEK_CAP, full.weeks.length)
  const weeks = full.weeks.slice(0, n).map((w, i) => ({ ...w, week: i + 1 }))
  const phases = phasesClippedToMaxWeek(full.phases, n)
  return {
    ...full,
    archetypeLabel: `${full.archetypeLabel} · upskill sprint`,
    phases,
    weeks,
    totalWeeks: n,
  }
}
