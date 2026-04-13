/**
 * Archie — certification suggestions by detected role archetype (mock; later from API).
 */

import { detectRoleArchetype, type RoleArchetype } from '@/lib/archie-weekly-timelines'

export interface ArchieCertificationSuggestion {
  id: string
  name: string
  provider: string
  /** Short focus area */
  focus: string
  archieRationale: string
  /** Rough prep hint */
  prepHint?: string
}

function titleCaseRole(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

const BY_ARCHETYPE: Record<RoleArchetype, ArchieCertificationSuggestion[]> = {
  fullstack: [
    {
      id: 'meta-frontend',
      name: 'Meta Front-End Developer',
      provider: 'Meta / Coursera',
      focus: 'HTML, CSS, JavaScript, React',
      archieRationale:
        'Signals client-side depth for full-stack interviews; pairs well with a Node/API project in your Job ready track.',
      prepHint: '≈8–12 weeks part-time',
    },
    {
      id: 'aws-dev',
      name: 'AWS Certified Developer – Associate',
      provider: 'Amazon Web Services',
      focus: 'Deploy, serverless, cloud-native apps',
      archieRationale:
        'Hiring teams often treat cloud delivery as a differentiator; aligns with your deploy & ship weeks.',
      prepHint: '≈6–10 weeks',
    },
    {
      id: 'psm1',
      name: 'Professional Scrum Master I',
      provider: 'Scrum.org',
      focus: 'Agile delivery, team flow',
      archieRationale: 'Lightweight cert that complements technical depth when targeting product-led companies.',
      prepHint: '≈2–4 weeks',
    },
  ],
  frontend: [
    {
      id: 'meta-frontend',
      name: 'Meta Front-End Developer',
      provider: 'Meta / Coursera',
      focus: 'React, UI patterns, accessibility',
      archieRationale: 'Strong external validation for UI-heavy roles; maps to your framework and polish weeks.',
      prepHint: '≈8–12 weeks part-time',
    },
    {
      id: 'iwdc',
      name: 'JavaScript Institute certifications',
      provider: 'JS Institute',
      focus: 'Core JS (levels)',
      archieRationale: 'Optional micro-credential if you want a quick benchmark before deeper system design prep.',
      prepHint: '≈3–6 weeks',
    },
    {
      id: 'a11y',
      name: 'IAAP WAS (Web Accessibility)',
      provider: 'IAAP',
      focus: 'WCAG, inclusive UI',
      archieRationale: 'Differentiator for design-system and enterprise frontend roles.',
      prepHint: '≈4–8 weeks',
    },
  ],
  backend: [
    {
      id: 'aws-dev',
      name: 'AWS Certified Developer – Associate',
      provider: 'Amazon Web Services',
      focus: 'APIs, data stores, ops basics',
      archieRationale: 'Common filter for backend + cloud roles; reinforces your API and deploy milestones.',
      prepHint: '≈6–10 weeks',
    },
    {
      id: 'k8s-cka',
      name: 'Certified Kubernetes Administrator (CKA)',
      provider: 'CNCF / Linux Foundation',
      focus: 'Clusters, workloads, troubleshooting',
      archieRationale: 'Useful if your target leans platform/backend SRE; skip if the role is pure app-layer.',
      prepHint: '≈8–12 weeks',
    },
    {
      id: 'oracle-java',
      name: 'Oracle Certified Professional: Java SE Developer',
      provider: 'Oracle',
      focus: 'Java language & APIs',
      archieRationale: 'Pick up only when your stack or job posts emphasize Java/Kotlin JVM backends.',
      prepHint: '≈6–10 weeks',
    },
  ],
  data: [
    {
      id: 'gcp-ml',
      name: 'Google Cloud Professional ML Engineer',
      provider: 'Google Cloud',
      focus: 'ML on GCP, pipelines, production',
      archieRationale: 'Strong for ML engineer loops; complements experiment tracking and MLOps topics.',
      prepHint: '≈10–14 weeks',
    },
    {
      id: 'tensorflow',
      name: 'TensorFlow Developer Certificate',
      provider: 'TensorFlow / DeepLearning.AI',
      focus: 'Modeling with TensorFlow',
      archieRationale: 'Practical signal for hands-on ML; good alongside portfolio projects.',
      prepHint: '≈6–10 weeks',
    },
    {
      id: 'databricks',
      name: 'Databricks Data Engineer Associate',
      provider: 'Databricks',
      focus: 'Spark, Delta Lake, pipelines',
      archieRationale: 'Relevant for data engineering-heavy JDs; pair with SQL and orchestration depth.',
      prepHint: '≈6–10 weeks',
    },
  ],
  devops: [
    {
      id: 'k8s-cka',
      name: 'Certified Kubernetes Administrator (CKA)',
      provider: 'CNCF / Linux Foundation',
      focus: 'Kubernetes operations',
      archieRationale: 'Core credential for platform/DevOps tracks; aligns with your cluster and deploy milestones.',
      prepHint: '≈8–12 weeks',
    },
    {
      id: 'terraform',
      name: 'HashiCorp Terraform Associate',
      provider: 'HashiCorp',
      focus: 'IaC, modules, state',
      archieRationale: 'Fast win that matches Terraform-heavy teams; complements CI/CD work.',
      prepHint: '≈4–8 weeks',
    },
    {
      id: 'aws-saa',
      name: 'AWS Solutions Architect – Associate',
      provider: 'Amazon Web Services',
      focus: 'Well-architected cloud design',
      archieRationale: 'Broad cloud literacy; useful when roles span networking, IAM, and cost-aware design.',
      prepHint: '≈8–12 weeks',
    },
  ],
  leadership: [
    {
      id: 'psm1',
      name: 'Professional Scrum Master I',
      provider: 'Scrum.org',
      focus: 'Scrum, facilitation',
      archieRationale: 'Lightweight agile literacy signal for EM/TPM paths without a heavy PMP time sink.',
      prepHint: '≈2–4 weeks',
    },
    {
      id: 'pmp',
      name: 'Project Management Professional (PMP)',
      provider: 'PMI',
      focus: 'Program & risk management',
      archieRationale: 'Consider when job posts explicitly ask for PMP or large program ownership.',
      prepHint: '≈3–5 months',
    },
    {
      id: 'shrm',
      name: 'SHRM-CP or PHR (HR-adjacent)',
      provider: 'SHRM / HRCI',
      focus: 'People operations context',
      archieRationale: 'Optional; only if you are pivoting toward people leadership or HR partnership-heavy roles.',
      prepHint: 'varies',
    },
  ],
  generic: [
    {
      id: 'gcp-digital',
      name: 'Google Digital Marketing & E-commerce',
      provider: 'Google',
      focus: 'Analytics, campaigns',
      archieRationale: 'Placeholder breadth cert when the role is ambiguous—refine after you lock a target title.',
      prepHint: '≈4–8 weeks',
    },
    {
      id: 'capm',
      name: 'Certified Associate in Project Management (CAPM)',
      provider: 'PMI',
      focus: 'Project basics',
      archieRationale: 'General execution literacy; upgrade to PMP if programs scale up.',
      prepHint: '≈2–3 months',
    },
    {
      id: 'linkedin-skill',
      name: 'Role-specific skill assessments',
      provider: 'LinkedIn / others',
      focus: 'Quick benchmarks',
      archieRationale: 'Use only as a nudge on profile; prioritize projects and Archie’s weekly path.',
      prepHint: 'hours–days',
    },
  ],
}

export interface ArchieCertificationsBundle {
  targetRole: string
  archetypeLabel: string
  intro: string
  items: ArchieCertificationSuggestion[]
}

export function buildCertificationsForTargetRole(rawTargetRole: string): ArchieCertificationsBundle {
  const targetRole = titleCaseRole(rawTargetRole) || 'Your Target Role'
  const archetype = detectRoleArchetype(rawTargetRole)
  const labelMap: Record<RoleArchetype, string> = {
    fullstack: 'Full-stack web',
    frontend: 'Frontend',
    backend: 'Backend',
    data: 'Data & ML',
    devops: 'DevOps / SRE',
    leadership: 'Leadership',
    generic: 'Professional skills',
  }
  const items = BY_ARCHETYPE[archetype]
  const intro = `Archie matched “${targetRole}” to a ${labelMap[archetype]} lens. These certifications are common signals employers recognize; prioritize 1–2 that match job posts you actually want, then align study blocks with your Skills and Job ready tabs.`

  return {
    targetRole,
    archetypeLabel: labelMap[archetype],
    intro,
    items,
  }
}
