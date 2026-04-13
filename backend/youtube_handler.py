"""Turn a list of YouTube watch URLs (e.g. from ``playlist_separator``) into Nova-ready transcript context.

Fetches captions per video via ``youtube_parser``, concatenates with per-video and global
char limits, then trims with ``nova_agent.syllabus_for_prompt`` for LLM payloads.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable

from nova_agent import syllabus_for_prompt
from playlist_separator import playlist_to_video_urls
from youtube_parser import YoutubeTranscriptBundle, extract_video_id, get_transcript_bundle
from youtube_transcript_api import YouTubeTranscriptApiException


@dataclass(frozen=True)
class YoutubeVideoTranscriptItem:
    """One video after a transcript fetch attempt."""

    url: str
    video_id: str | None
    ok: bool
    transcript_text: str
    error: str | None
    language_code: str | None
    char_count: int
    is_generated: bool | None


@dataclass
class NovaYoutubeContext:
    """Aggregated transcripts formatted for Nova / coach-style JSON context."""

    items: list[YoutubeVideoTranscriptItem]
    combined_text: str
    """Joined sections before the global Nova trim."""
    nova_prompt_text: str | None
    """Trimmed string safe to put in ``youtube_transcript_context`` (or merge with syllabus)."""
    source_urls: list[str] = field(default_factory=list)
    playlist_resolve_error: str | None = None
    """Set when ``from_playlist_url`` could not expand the playlist."""

    def for_nova_dict(self) -> dict[str, Any]:
        """
        Patch to merge into a learner or coach payload for Nova.

        Keys:
          - ``youtube_transcript_context``: trimmed transcript blob (omit if None)
          - ``youtube_transcript_meta``: counts and errors for the model / UI
        """
        meta: dict[str, Any] = {
            "video_count": len(self.source_urls),
            "transcripts_ok": sum(1 for i in self.items if i.ok),
            "transcripts_failed": sum(1 for i in self.items if not i.ok),
            "failed": [
                {"url": i.url, "video_id": i.video_id, "error": i.error}
                for i in self.items
                if not i.ok and i.error
            ],
        }
        if self.playlist_resolve_error:
            meta["playlist_error"] = self.playlist_resolve_error
        out: dict[str, Any] = {"youtube_transcript_meta": meta}
        if self.nova_prompt_text:
            out["youtube_transcript_context"] = self.nova_prompt_text
        return out


def _dedupe_urls_preserve_order(urls: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for u in urls:
        s = (u or "").strip()
        if not s:
            continue
        vid = extract_video_id(s)
        key = vid or s
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out


def _clip(s: str, max_chars: int) -> str:
    t = s.strip()
    if max_chars <= 0 or len(t) <= max_chars:
        return t
    return t[: max_chars - 1].rstrip() + "…"


def build_nova_youtube_context(
    video_urls: Iterable[str],
    *,
    languages: Iterable[str] = ("en", "en-US", "en-GB"),
    max_chars_per_video: int = 6000,
    max_chars_total_nova: int = 12000,
    include_failed_lines: bool = True,
) -> NovaYoutubeContext:
    """
    For each watch URL, fetch transcript text (one-by-one), build a single document,
    then trim for Nova via ``syllabus_for_prompt``.

    Videos without captions yield ``ok=False``; optionally a short placeholder line is
    still included in ``combined_text`` so the model knows something was skipped.
    """
    ordered = _dedupe_urls_preserve_order(list(video_urls))
    items: list[YoutubeVideoTranscriptItem] = []
    sections: list[str] = []

    for idx, url in enumerate(ordered, start=1):
        vid = extract_video_id(url)
        if not vid:
            msg = "Unrecognized YouTube URL"
            items.append(
                YoutubeVideoTranscriptItem(
                    url=url,
                    video_id=None,
                    ok=False,
                    transcript_text="",
                    error=msg,
                    language_code=None,
                    char_count=0,
                    is_generated=None,
                )
            )
            if include_failed_lines:
                sections.append(f"### Video {idx}\n{url}\n[{msg}]")
            continue

        try:
            bundle: YoutubeTranscriptBundle = get_transcript_bundle(
                url,
                languages=languages,
                preserve_formatting=False,
            )
            body = _clip(bundle.text, max_chars_per_video)
            items.append(
                YoutubeVideoTranscriptItem(
                    url=url,
                    video_id=bundle.video_id,
                    ok=True,
                    transcript_text=body,
                    error=None,
                    language_code=bundle.language_code,
                    char_count=len(body),
                    is_generated=bundle.is_generated,
                )
            )
            lang_note = f" ({bundle.language_code})" if bundle.language_code else ""
            gen_note = " auto-captions" if bundle.is_generated else ""
            sections.append(
                f"### Video {idx}{lang_note}{gen_note}\n"
                f"{url}\n\n"
                f"{body}"
            )
        except YouTubeTranscriptApiException as e:
            msg = str(e).split("\n")[0][:240]
            items.append(
                YoutubeVideoTranscriptItem(
                    url=url,
                    video_id=vid,
                    ok=False,
                    transcript_text="",
                    error=msg,
                    language_code=None,
                    char_count=0,
                    is_generated=None,
                )
            )
            if include_failed_lines:
                sections.append(f"### Video {idx}\n{url}\n[No transcript: {msg}]")
        except ValueError as e:
            msg = str(e)[:240]
            items.append(
                YoutubeVideoTranscriptItem(
                    url=url,
                    video_id=vid,
                    ok=False,
                    transcript_text="",
                    error=msg,
                    language_code=None,
                    char_count=0,
                    is_generated=None,
                )
            )
            if include_failed_lines:
                sections.append(f"### Video {idx}\n{url}\n[No transcript: {msg}]")

    combined = "\n\n".join(sections).strip()
    nova = syllabus_for_prompt(combined if combined else None, max_chars=max_chars_total_nova)

    return NovaYoutubeContext(
        items=items,
        combined_text=combined,
        nova_prompt_text=nova,
        source_urls=ordered,
        playlist_resolve_error=None,
    )


def build_nova_youtube_context_from_playlist_url(
    playlist_url: str,
    *,
    languages: Iterable[str] = ("en", "en-US", "en-GB"),
    max_chars_per_video: int = 6000,
    max_chars_total_nova: int = 12000,
    include_failed_lines: bool = True,
) -> NovaYoutubeContext:
    """
    Resolve a playlist page to watch URLs via ``playlist_to_video_urls``, then
    :func:`build_nova_youtube_context`.
    """
    try:
        urls = playlist_to_video_urls(playlist_url)
    except ValueError as e:
        return NovaYoutubeContext(
            items=[],
            combined_text="",
            nova_prompt_text=None,
            source_urls=[],
            playlist_resolve_error=str(e),
        )
    return build_nova_youtube_context(
        urls,
        languages=languages,
        max_chars_per_video=max_chars_per_video,
        max_chars_total_nova=max_chars_total_nova,
        include_failed_lines=include_failed_lines,
    )


__all__ = [
    "NovaYoutubeContext",
    "YoutubeVideoTranscriptItem",
    "build_nova_youtube_context",
    "build_nova_youtube_context_from_playlist_url",
]
