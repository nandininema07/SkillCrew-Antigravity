/**
 * End-of-track capstone: mission copy + curated study links keyed off roadmap text.
 */

export type CapstoneStudyLink = {
  title: string
  url: string
  description: string
}

const CORE_LINKS: CapstoneStudyLink[] = [
  {
    title: 'How to plan a coding project',
    url: 'https://www.freecodecamp.org/news/how-to-plan-a-coding-project-a-programming-planning-guide/',
    description: 'Break work into milestones, define scope, and ship iteratively without thrash.',
  },
  {
    title: 'System design primer (GitHub)',
    url: 'https://github.com/donnemartin/system-design-primer',
    description: 'High-level patterns for APIs, data stores, caching, and scaling — useful for portfolio depth.',
  },
  {
    title: 'Write a strong README',
    url: 'https://readme.so/',
    description: 'Clear setup, architecture diagram, and demo instructions make your capstone hire-ready.',
  },
]

const TOPIC_LINKS: { match: RegExp; links: CapstoneStudyLink[] }[] = [
  {
    match: /python|pandas|numpy|jupyter/i,
    links: [
      {
        title: 'pandas documentation',
        url: 'https://pandas.pydata.org/docs/',
        description: 'Official user guide for data cleaning, joins, and time series in Python.',
      },
      {
        title: 'Real Python — tutorials',
        url: 'https://realpython.com/',
        description: 'Practical articles from fundamentals to testing and packaging.',
      },
    ],
  },
  {
    match: /machine learning|ml\b|deep learning|pytorch|tensorflow|scikit/i,
    links: [
      {
        title: 'scikit-learn user guide',
        url: 'https://scikit-learn.org/stable/user_guide.html',
        description: 'End-to-end modeling workflow: preprocessing, metrics, and pipelines.',
      },
      {
        title: 'fast.ai course',
        url: 'https://course.fast.ai/',
        description: 'Applied deep learning with a focus on getting models working quickly.',
      },
    ],
  },
  {
    match: /sql|postgres|mysql|database|db\b/i,
    links: [
      {
        title: 'SQLBolt — interactive SQL',
        url: 'https://sqlbolt.com/',
        description: 'Hands-on lessons if you need to tighten queries for your capstone dataset.',
      },
      {
        title: 'PostgreSQL documentation',
        url: 'https://www.postgresql.org/docs/current/',
        description: 'Reference for schema design, indexing, and robust data modeling.',
      },
    ],
  },
  {
    match: /react|next\.?js|frontend|typescript|javascript/i,
    links: [
      {
        title: 'React — Learn',
        url: 'https://react.dev/learn',
        description: 'Official guide to components, state, and effects for a polished UI.',
      },
      {
        title: 'Next.js docs',
        url: 'https://nextjs.org/docs',
        description: 'Routing, data fetching, and deployment when your capstone is a web app.',
      },
    ],
  },
  {
    match: /api|rest|backend|fastapi|node|express|django|flask/i,
    links: [
      {
        title: 'REST API tutorial',
        url: 'https://restfulapi.net/',
        description: 'Resource modeling, status codes, and versioning for a clean public API.',
      },
      {
        title: 'OWASP API Security Top 10',
        url: 'https://owasp.org/www-project-api-security/',
        description: 'Harden auth, rate limits, and input validation before you ship.',
      },
    ],
  },
  {
    match: /data engineer|etl|spark|airflow|pipeline|warehouse|dbt/i,
    links: [
      {
        title: 'Apache Spark documentation',
        url: 'https://spark.apache.org/docs/latest/',
        description: 'Distributed processing when your capstone ingests or transforms large data.',
      },
      {
        title: 'dbt documentation',
        url: 'https://docs.getdbt.com/docs/introduction',
        description: 'Transform data in the warehouse with tested, documented SQL models.',
      },
    ],
  },
]

function dedupeByUrl(links: CapstoneStudyLink[]): CapstoneStudyLink[] {
  const seen = new Set<string>()
  const out: CapstoneStudyLink[] = []
  for (const L of links) {
    const k = L.url.split('#')[0]
    if (seen.has(k)) continue
    seen.add(k)
    out.push(L)
  }
  return out
}

export type CapstoneBriefInput = {
  direction: string
  trackTitle: string
  roleSubtitle: string
  roadmapMode: 'skills' | 'job_ready'
  recommendedJobTitle?: string | null
}

export type CapstoneBrief = {
  headline: string
  mission: string
  deliverables: string[]
  qualityBar: string[]
  studyLinks: CapstoneStudyLink[]
}

export function buildCapstoneBrief(input: CapstoneBriefInput): CapstoneBrief {
  const haystack = `${input.direction}\n${input.trackTitle}\n${input.roleSubtitle}`.toLowerCase()
  const role = input.recommendedJobTitle?.trim()
  const headline =
    input.roadmapMode === 'job_ready'
      ? 'Capstone: role-aligned portfolio piece'
      : 'Capstone: integrated build across your track'

  const missionParts = [
    `Design and ship one cohesive project that reflects your "${input.trackTitle}" track`,
    role ? `with a clear line of sight to ${role}.` : 'and the skills spelled out in your milestones.',
  ]

  const mission =
    input.roadmapMode === 'job_ready'
      ? `${missionParts.join(' ')} Treat it like evidence for interviews: problem statement, tradeoffs, metrics, and a demo a reviewer can run in under ten minutes.`
      : `${missionParts.join(' ')} Combine at least two major ideas from earlier weeks (for example ingestion + visualization, or API + auth + tests) so the result is closer to a real product slice than a tutorial exercise.`

  const deliverables =
    input.roadmapMode === 'job_ready'
      ? [
          'One-page brief: user/job story, constraints, and success criteria.',
          'Working demo (local or deployed) with reproducible setup steps.',
          'Short architecture note: main components, data flow, and what you would improve next.',
          'Reflection: what you validated, what failed, and what you learned about the role.',
        ]
      : [
          'Repository with clear README, license, and runnable setup (env file template if secrets are needed).',
          'Automated tests or checks for the riskiest logic (even a small suite is enough if it is meaningful).',
          'Observable quality: logging or basic monitoring where it fits your stack.',
          '5-minute walkthrough (written or Loom-style script): problem → approach → demo → next steps.',
        ]

  const qualityBar = [
    'Scope is small enough to finish, but technically non-trivial for your level.',
    'Another developer could onboard from your docs without DMing you questions.',
    'You can explain tradeoffs (speed vs. correctness, SQL vs. NoSQL, sync vs. async) in plain language.',
  ]

  const extra: CapstoneStudyLink[] = []
  for (const row of TOPIC_LINKS) {
    if (row.match.test(haystack)) extra.push(...row.links)
  }

  const studyLinks = dedupeByUrl([...CORE_LINKS, ...extra]).slice(0, 8)

  return { headline, mission, deliverables, qualityBar, studyLinks }
}
