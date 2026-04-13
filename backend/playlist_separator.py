"""Resolve a YouTube playlist URL into individual watch URLs.

Uses ``yt-dlp`` (no YouTube Data API key). Works for public / unlisted playlists
you can open in a browser; private or region-locked items may be skipped or fail.
"""

from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

import yt_dlp

# 11-char ids are video ids; playlist ids from ``list=`` are typically longer.
_PLAYLIST_ID_QUERY_RE = re.compile(r"^[a-zA-Z0-9_-]{10,}$")
_VIDEO_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{11}$")

_YDL_OPTS: dict = {
    "quiet": True,
    "no_warnings": True,
    "extract_flat": "in_playlist",
    "skip_download": True,
    "ignoreerrors": True,
    "socket_timeout": 30,
}


def extract_playlist_id(url_or_id: str) -> str | None:
    """
    Return the playlist id from a URL's ``list=`` query param, or a bare playlist id
    string (never an 11-character video id).
    """
    s = (url_or_id or "").strip()
    if not s:
        return None
    if "://" not in s and "youtube.com" not in s and "youtu.be" not in s:
        if _VIDEO_ID_RE.match(s):
            return None
        if _PLAYLIST_ID_QUERY_RE.match(s):
            return s
        return None
    parsed = urlparse(s if "://" in s else f"https://{s}")
    qs = parse_qs(parsed.query)
    if "list" in qs and qs["list"]:
        pid = qs["list"][0].strip()
        if pid and _PLAYLIST_ID_QUERY_RE.match(pid):
            return pid
    return None


def _canonical_watch_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def _video_id_from_entry(entry: dict | None) -> str | None:
    if not entry or not isinstance(entry, dict):
        return None
    vid = entry.get("id")
    if isinstance(vid, str) and len(vid) == 11 and re.match(r"^[a-zA-Z0-9_-]{11}$", vid):
        return vid
    url = entry.get("url")
    if isinstance(url, str) and "watch?v=" in url:
        q = parse_qs(urlparse(url).query).get("v", [None])[0]
        if isinstance(q, str) and len(q) == 11:
            return q
    return None


def playlist_to_video_urls(playlist_url: str, *, ydl_opts: dict | None = None) -> list[str]:
    """
    Given a playlist link (or any URL yt-dlp treats as a playlist), return ordered
    ``https://www.youtube.com/watch?v=…`` strings.

    Raises:
        ValueError: empty input, yt-dlp returned no metadata, or no videos were found.
        yt_dlp.utils.DownloadError: hard failures from yt-dlp (network, blocked, etc.).
    """
    raw = (playlist_url or "").strip()
    if not raw:
        raise ValueError("Playlist URL is empty")

    opts = {**_YDL_OPTS, **(ydl_opts or {})}

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(raw, download=False)

    if info is None or not isinstance(info, dict):
        raise ValueError(
            "Could not load that URL (playlist missing, private, or unavailable from this network)."
        )

    entries = info.get("entries")
    out: list[str] = []
    seen: set[str] = set()

    if entries:
        for entry in entries:
            vid = _video_id_from_entry(entry)
            if vid and vid not in seen:
                seen.add(vid)
                out.append(_canonical_watch_url(vid))
        if out:
            return out

    # Single video (no playlist) or flat extract missed entries
    vid = info.get("id")
    if isinstance(vid, str) and len(vid) == 11 and re.match(r"^[a-zA-Z0-9_-]{11}$", vid):
        return [_canonical_watch_url(vid)]

    raise ValueError(
        "No videos found. Use a playlist URL with list=…, or check that the playlist is accessible."
    )


__all__ = [
    "extract_playlist_id",
    "playlist_to_video_urls",
]
