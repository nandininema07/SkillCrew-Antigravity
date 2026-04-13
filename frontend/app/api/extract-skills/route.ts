import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Mock skill extraction - In production, this would use AI to extract skills from resume/LinkedIn
const COMMON_TECH_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP',
  'React', 'Vue.js', 'Angular', 'Next.js', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
  'HTML', 'CSS', 'Tailwind CSS', 'SASS', 'Bootstrap',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST APIs',
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD',
  'Git', 'GitHub', 'GitLab', 'Jira', 'Agile', 'Scrum',
  'Machine Learning', 'Data Science', 'TensorFlow', 'PyTorch',
  'iOS Development', 'Android Development', 'React Native', 'Flutter',
]

function extractSkillsFromText(text: string): { name: string; confidence: number }[] {
  const lowerText = text.toLowerCase()
  const extractedSkills: { name: string; confidence: number }[] = []

  for (const skill of COMMON_TECH_SKILLS) {
    if (lowerText.includes(skill.toLowerCase())) {
      // Count occurrences to estimate confidence
      const regex = new RegExp(skill.toLowerCase(), 'gi')
      const matches = lowerText.match(regex)
      const occurrences = matches ? matches.length : 0
      
      extractedSkills.push({
        name: skill,
        confidence: Math.min(0.5 + (occurrences * 0.1), 0.95),
      })
    }
  }

  return extractedSkills
}

function estimateLevel(confidence: number): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
  if (confidence >= 0.85) return 'expert'
  if (confidence >= 0.7) return 'advanced'
  if (confidence >= 0.5) return 'intermediate'
  return 'beginner'
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') || ''
    let text = ''
    let source: 'resume' | 'linkedin' = 'resume'

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      // For now, just read as text (in production, use a PDF parser)
      text = await file.text()
      source = 'resume'
    } else {
      // Handle LinkedIn URL or text
      const body = await request.json()
      text = body.text || body.linkedin_profile || ''
      source = body.source || 'linkedin'
    }

    if (!text) {
      return NextResponse.json({ error: 'No content to analyze' }, { status: 400 })
    }

    // Extract skills from text
    const extractedSkills = extractSkillsFromText(text)

    if (extractedSkills.length === 0) {
      return NextResponse.json({
        skills: [],
        message: 'No skills detected. Try adding some manually.',
      })
    }

    // Format skills with levels
    const skillsWithLevels = extractedSkills.map(skill => ({
      name: skill.name,
      level: estimateLevel(skill.confidence),
      confidence: skill.confidence,
      source,
    }))

    return NextResponse.json({
      skills: skillsWithLevels,
      message: `Found ${skillsWithLevels.length} skills`,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
