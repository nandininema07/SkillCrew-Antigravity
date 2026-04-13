"""Fetch YouTube video captions / transcripts (official or auto-generated).

Uses YouTube's timedcaption tracks via ``youtube-transcript-api``. This does **not**
run speech-to-text on the audio; it only returns text if YouTube exposes captions
for the video (manual or auto-generated).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import parse_qs, urlparse

from youtube_transcript_api import FetchedTranscript, YouTubeTranscriptApi
from youtube_transcript_api import YouTubeTranscriptApiException

# Typical 11-char YouTube video ID (alphanumeric, _, -)
_VIDEO_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{11}$")

# youtube.com/watch?v=ID, youtu.be/ID, shorts, embed, live, etc.
_URL_PATTERNS = [
    re.compile(r"(?:youtube\.com/watch\?.*[&?]v=)([a-zA-Z0-9_-]{11})"),
    re.compile(r"(?:youtu\.be/)([a-zA-Z0-9_-]{11})"),
    re.compile(r"(?:youtube\.com/embed/)([a-zA-Z0-9_-]{11})"),
    re.compile(r"(?:youtube\.com/v/)([a-zA-Z0-9_-]{11})"),
    re.compile(r"(?:youtube\.com/shorts/)([a-zA-Z0-9_-]{11})"),
    re.compile(r"(?:youtube\.com/live/)([a-zA-Z0-9_-]{11})"),
]


def extract_video_id(url_or_id: str) -> str | None:
    """
    Return the 11-character video id, or None if the string does not look like
    a valid id or a known YouTube URL format.
    """
    s = (url_or_id or "").strip()
    if not s:
        return None
    if _VIDEO_ID_RE.match(s):
        return s
    parsed = urlparse(s if "://" in s else f"https://{s}")
    host = (parsed.netloc or "").lower()
    if "youtube" not in host and "youtu.be" not in host:
        return None
    for pat in _URL_PATTERNS:
        m = pat.search(s)
        if m:
            return m.group(1)
    qs = parse_qs(parsed.query)
    if "v" in qs and qs["v"]:
        vid = qs["v"][0]
        if _VIDEO_ID_RE.match(vid):
            return vid
    return None


def _join_snippet_text(ft: FetchedTranscript, *, line_sep: str) -> str:
    parts = [s.text.strip() for s in ft.snippets if s.text and s.text.strip()]
    return line_sep.join(parts)


@dataclass(frozen=True)
class YoutubeTranscriptBundle:
    """Plain transcript plus metadata for LLM / storage."""

    text: str
    video_id: str
    language: str
    language_code: str
    is_generated: bool
    snippet_count: int
    char_count: int


def fetch_transcript(
    url_or_id: str,
    *,
    languages: Iterable[str] = ("en", "en-US", "en-GB"),
    preserve_formatting: bool = False,
) -> FetchedTranscript:
    """
    Download the transcript for a video. Raises ``InvalidVideoId`` or
    ``YouTubeTranscriptApiException`` subclasses if unavailable.

    :param url_or_id: Full YouTube URL or bare 11-character video id.
    :param languages: Preferred caption languages, first match wins.
    :param preserve_formatting: Keep limited HTML formatting from captions.
    """
    vid = extract_video_id(url_or_id)
    if not vid:
        raise ValueError(f"Not a valid YouTube URL or video id: {url_or_id!r}")

    api = YouTubeTranscriptApi()
    return api.fetch(vid, languages=languages, preserve_formatting=preserve_formatting)


def get_transcript_bundle(
    url_or_id: str,
    *,
    languages: Iterable[str] = ("en", "en-US", "en-GB"),
    preserve_formatting: bool = False,
    line_sep: str = "\n",
) -> YoutubeTranscriptBundle:
    """
    Fetch transcript and return a single string plus metadata.

    Example::

        bundle = get_transcript_bundle("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        print(bundle.text[:500])
    """
    ft = fetch_transcript(
        url_or_id,
        languages=languages,
        preserve_formatting=preserve_formatting,
    )
    text = _join_snippet_text(ft, line_sep=line_sep)
    return YoutubeTranscriptBundle(
        text=text,
        video_id=ft.video_id,
        language=ft.language,
        language_code=ft.language_code,
        is_generated=ft.is_generated,
        snippet_count=len(ft.snippets),
        char_count=len(text),
    )


def get_transcript_text(
    url_or_id: str,
    *,
    languages: Iterable[str] = ("en", "en-US", "en-GB"),
    preserve_formatting: bool = False,
    line_sep: str = "\n",
) -> str:
    """Convenience: return transcript body only."""
    return get_transcript_bundle(
        url_or_id,
        languages=languages,
        preserve_formatting=preserve_formatting,
        line_sep=line_sep,
    ).text


__all__ = [
    "YoutubeTranscriptBundle",
    "YouTubeTranscriptApiException",
    "extract_video_id",
    "fetch_transcript",
    "get_transcript_bundle",
    "get_transcript_text",
]
