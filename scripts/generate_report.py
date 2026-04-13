#!/usr/bin/env python3
"""
Generate a Progress & Analytics PDF from JSON (same shape as /api/analytics/progress + profile).

Usage:
  python3 scripts/generate_report.py --input payload.json --output report.pdf
  cat payload.json | python3 scripts/generate_report.py --output report.pdf

Environment:
  PROGRESS_REPORT_PYTHON is not used here; callers invoke this script directly.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )
except ImportError as e:
    print("reportlab is required: pip install reportlab", file=sys.stderr)
    raise SystemExit(1) from e


def _txt(s: Any) -> str:
    if s is None:
        return ""
    return escape(str(s))


def _num(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _build_story(payload: dict[str, Any]) -> list:
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        name="ReportTitle",
        parent=styles["Heading1"],
        fontSize=18,
        spaceAfter=12,
        textColor=colors.HexColor("#1e293b"),
    )
    h2 = ParagraphStyle(
        name="H2",
        parent=styles["Heading2"],
        fontSize=13,
        spaceBefore=14,
        spaceAfter=8,
        textColor=colors.HexColor("#334155"),
    )
    body = ParagraphStyle(
        name="Body",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569"),
    )
    small = ParagraphStyle(
        name="Small",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#64748b"),
    )

    profile = payload.get("profile") or {}
    analytics = payload.get("analytics") or {}
    generated = payload.get("generatedAt") or datetime.now(timezone.utc).isoformat()

    name = profile.get("full_name") or profile.get("email") or "Learner"
    email = profile.get("email") or ""

    story: list = []
    story.append(Paragraph(_txt("Progress & Analytics Report"), title_style))
    story.append(Paragraph(_txt(f"Learner: {name}"), body))
    if email:
        story.append(Paragraph(_txt(f"Email: {email}"), body))
    story.append(Paragraph(_txt(f"Generated: {generated}"), small))
    story.append(Spacer(1, 0.15 * inch))

    xp = int(_num(profile.get("xp"), 0))
    streak = int(_num(profile.get("streak"), 0))
    level = int(_num(profile.get("level"), 0))
    prof_skills = int(_num(analytics.get("proficientSkillsCount"), 0))
    skills_tracked = int(_num(analytics.get("skillsTracked"), 0))
    xp7 = int(_num(analytics.get("xpEarnedLast7Days"), 0))

    roadmaps = analytics.get("roadmaps") or []
    avg_path = 0.0
    if roadmaps:
        avg_path = sum(_num(r.get("progressPercent"), 0) for r in roadmaps) / max(len(roadmaps), 1)

    story.append(Paragraph(_txt("Summary"), h2))
    summary_data = [
        ["Metric", "Value"],
        ["Total XP", str(xp)],
        ["Level", str(level)],
        ["Current streak", f"{streak} days"],
        ["XP from assessments (last 7 days)", str(xp7)],
        ["Proficient skills", str(prof_skills)],
        ["Skills on profile", str(skills_tracked)],
        ["Avg. roadmap progress (all active)", f"{round(avg_path)}%"],
    ]
    t = Table(summary_data, colWidths=[3.2 * inch, 2.2 * inch])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 0.12 * inch))

    goal_labels = {
        "skill-mastery": "Skill mastery",
        "job-readiness": "Job readiness",
        "certification": "Certification",
    }

    story.append(Paragraph(_txt("Active learning roadmaps"), h2))
    if not roadmaps:
        story.append(Paragraph(_txt("No roadmaps yet — create one from the dashboard."), body))
    else:
        for idx, rm in enumerate(roadmaps, start=1):
            title = rm.get("title") or rm.get("display_title") or "Roadmap"
            desc = (rm.get("description") or "")[:500]
            goal = goal_labels.get(str(rm.get("goal")), str(rm.get("goal") or ""))
            pct = int(_num(rm.get("progressPercent"), 0))
            covered = rm.get("topicsCovered") or []
            remaining = rm.get("topicsRemaining") or []
            quizzes = rm.get("quizzes") or []

            story.append(Paragraph(_txt(f"{idx}. {title}"), ParagraphStyle(name="RM", parent=h2, fontSize=11, spaceBefore=8)))
            story.append(Paragraph(_txt(f"Goal: {goal} · Progress: {pct}%"), body))
            if desc:
                story.append(Paragraph(_txt(desc), body))

            story.append(
                Paragraph(
                    _txt(f"Topics covered ({len(covered)})"),
                    ParagraphStyle(name=f"SubCov{idx}", parent=body, fontName="Helvetica-Bold"),
                )
            )
            if not covered:
                story.append(Paragraph(_txt("None yet."), body))
            else:
                for tpc in covered[:40]:
                    story.append(
                        Paragraph(
                            f"• {_txt(tpc.get('title', ''))} ({_txt(tpc.get('status', ''))})",
                            body,
                        )
                    )
                if len(covered) > 40:
                    story.append(Paragraph(_txt(f"… and {len(covered) - 40} more"), small))

            story.append(
                Paragraph(
                    _txt(f"Topics remaining ({len(remaining)})"),
                    ParagraphStyle(name=f"SubRem{idx}", parent=body, fontName="Helvetica-Bold"),
                )
            )
            if not remaining:
                story.append(Paragraph(_txt("None — you are at the finish line for topics listed."), body))
            else:
                for tpc in remaining[:40]:
                    story.append(Paragraph("• " + _txt(tpc.get("title", "")), body))
                if len(remaining) > 40:
                    story.append(Paragraph(_txt(f"… and {len(remaining) - 40} more"), small))

            story.append(
                Paragraph(
                    _txt(f"Quizzes & checkpoints ({len(quizzes)})"),
                    ParagraphStyle(name=f"SubQz{idx}", parent=body, fontName="Helvetica-Bold"),
                )
            )
            if not quizzes:
                story.append(Paragraph(_txt("No checkpoints in this bundle."), body))
            else:
                q_title_style = ParagraphStyle(
                    name=f"QzTitle{idx}",
                    parent=body,
                    fontName="Helvetica-Bold",
                    fontSize=9,
                    leading=12,
                )
                for q in quizzes[:25]:
                    story.append(Paragraph(_txt(q.get("title", "Checkpoint")), q_title_style))
                    purpose = (q.get("purpose") or "")[:800]
                    if purpose:
                        story.append(Paragraph(_txt(purpose), body))
                if len(quizzes) > 25:
                    story.append(Paragraph(_txt(f"… and {len(quizzes) - 25} more checkpoints"), small))

            story.append(Spacer(1, 0.08 * inch))

    story.append(Paragraph(_txt("Time allotted vs time spent by topic"), h2))
    rows = analytics.get("moduleTimeRows") or []
    if not rows:
        story.append(Paragraph(_txt("No module time data yet."), body))
    else:
        data = [["Topic", "Allotted (h)", "Spent (h)"]]
        for r in rows:
            data.append(
                [
                    str(r.get("topic", ""))[:60],
                    f"{_num(r.get('allottedHours'), 0):.1f}",
                    f"{_num(r.get('spentHours'), 0):.1f}",
                ]
            )
        tt = Table(data, repeatRows=1, colWidths=[3.0 * inch, 1.2 * inch, 1.2 * inch])
        tt.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.append(tt)

    story.append(Paragraph(_txt("Learning trend (last 4 weeks)"), h2))
    trend = analytics.get("weeklyTrend") or []
    if not trend:
        story.append(Paragraph(_txt("No weekly activity in range."), body))
    else:
        data = [["Week", "XP (assessments)", "Modules completed"]]
        for w in trend:
            data.append(
                [
                    str(w.get("week", "")),
                    str(int(_num(w.get("xp"), 0))),
                    str(int(_num(w.get("courses"), 0))),
                ]
            )
        wt = Table(data, repeatRows=1, colWidths=[2.2 * inch, 1.5 * inch, 1.8 * inch])
        wt.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                ]
            )
        )
        story.append(wt)

    story.append(Paragraph(_txt("Skill distribution (relative strength)"), h2))
    dist = analytics.get("skillDistribution") or []
    dist = [s for s in dist if _num(s.get("value"), 0) > 0]
    if not dist:
        story.append(Paragraph(_txt("No skills on profile yet."), body))
    else:
        data = [["Skill", "Weight"]]
        for s in dist:
            data.append([str(s.get("name", ""))[:48], str(int(_num(s.get("value"), 0)))])
        st = Table(data, repeatRows=1, colWidths=[3.5 * inch, 1.0 * inch])
        st.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                ]
            )
        )
        story.append(st)

    story.append(Paragraph(_txt("Time spent learning (by roadmap)"), h2))
    alloc = analytics.get("timeAllocation") or []
    if not alloc:
        story.append(Paragraph(_txt("No logged time by roadmap yet."), body))
    else:
        data = [["Roadmap / activity", "Hours", "%"]]
        for a in alloc:
            data.append(
                [
                    str(a.get("name", ""))[:50],
                    f"{_num(a.get('hours'), 0):.1f}",
                    f"{int(_num(a.get('percentage'), 0))}",
                ]
            )
        at = Table(data, repeatRows=1, colWidths=[3.0 * inch, 0.9 * inch, 0.7 * inch])
        at.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                ]
            )
        )
        story.append(at)

    story.append(Paragraph(_txt("Learning goals (monthly signals)"), h2))
    goals = analytics.get("goals") or []
    if not goals:
        story.append(Paragraph(_txt("No goals populated yet."), body))
    else:
        goal_head = ParagraphStyle(
            name="GoalHead",
            parent=body,
            fontName="Helvetica-Bold",
        )
        for g in goals:
            label = g.get("label", "")
            prog = int(_num(g.get("progress"), 0))
            detail = (g.get("detail") or "")[:400]
            story.append(Paragraph(_txt(f"{label} — {prog}%"), goal_head))
            if detail:
                story.append(Paragraph(_txt(detail), body))
            story.append(Spacer(1, 0.06 * inch))

    flags = analytics.get("flags") or {}
    story.append(Spacer(1, 0.1 * inch))
    story.append(
        Paragraph(
            _txt(
                "Data sources: "
                f"module completion track={'on' if flags.get('module_completion_track_available') else 'off'}, "
                f"assessment performance={'on' if flags.get('assessment_performance_available') else 'off'}."
            ),
            small,
        )
    )

    return story


def generate_pdf_bytes(payload: dict[str, Any]) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=0.65 * inch,
        leftMargin=0.65 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.65 * inch,
        title="Progress Report",
    )
    doc.build(_build_story(payload))
    return buf.getvalue()


def main() -> None:
    ap = argparse.ArgumentParser(description="Build Progress & Analytics PDF from JSON payload.")
    ap.add_argument("--input", "-i", help="JSON file (default: stdin)")
    ap.add_argument("--output", "-o", help="PDF file (default: stdout in binary mode)")
    args = ap.parse_args()

    if args.input:
        raw = Path(args.input).read_text(encoding="utf-8")
    else:
        raw = sys.stdin.read()

    payload = json.loads(raw)
    pdf = generate_pdf_bytes(payload)

    if args.output:
        Path(args.output).write_bytes(pdf)
    else:
        sys.stdout.buffer.write(pdf)


if __name__ == "__main__":
    main()
