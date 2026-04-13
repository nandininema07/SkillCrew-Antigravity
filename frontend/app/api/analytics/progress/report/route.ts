import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { createClient } from '@/lib/supabase/server'
import { fetchProgressAnalytics } from '@/lib/server/progress-analytics'
import { NextResponse } from 'next/server'

const execFileAsync = promisify(execFile)

function resolveGenerateReportScript(): string | null {
  const candidates = [
    join(process.cwd(), 'scripts', 'generate_report.py'),
    join(process.cwd(), '..', 'scripts', 'generate_report.py'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 500 })
    }

    const analytics = await fetchProgressAnalytics(supabase, user.id)
    const payload = {
      generatedAt: new Date().toISOString(),
      profile,
      analytics,
    }

    const scriptPath = resolveGenerateReportScript()
    if (!scriptPath) {
      return NextResponse.json(
        { error: 'Report script not found (expected scripts/generate_report.py at repo root).' },
        { status: 500 },
      )
    }

    const stamp = Date.now()
    const tmpJson = join(tmpdir(), `progress-report-${user.id}-${stamp}.json`)
    const tmpPdf = join(tmpdir(), `progress-report-${user.id}-${stamp}.pdf`)

    await writeFile(tmpJson, JSON.stringify(payload), 'utf8')

    const pythonBin = process.env.PROGRESS_REPORT_PYTHON ?? 'python3'

    try {
      await execFileAsync(pythonBin, [scriptPath, '--input', tmpJson, '--output', tmpPdf], {
        maxBuffer: 25 * 1024 * 1024,
        timeout: 120_000,
      })
    } catch (err) {
      console.error('generate_report.py:', err)
      await unlink(tmpJson).catch(() => {})
      await unlink(tmpPdf).catch(() => {})
      return NextResponse.json(
        {
          error:
            'Could not generate PDF. Ensure Python 3 and reportlab are installed (`pip install reportlab`). Optionally set PROGRESS_REPORT_PYTHON to your interpreter (e.g. backend venv).',
        },
        { status: 503 },
      )
    }

    const pdf = await readFile(tmpPdf)
    await unlink(tmpJson).catch(() => {})
    await unlink(tmpPdf).catch(() => {})

    const safeDate = new Date().toISOString().slice(0, 10)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="skillcrew-progress-report-${safeDate}.pdf"`,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
