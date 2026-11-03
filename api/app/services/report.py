"""Report snapshot computed when a lesson ends. Stores numbers and term ids only, never text,
so it survives the 24 h transcript purge (pitfall 25)."""

import re
import unicodedata
from datetime import datetime
from typing import Any

from app.schemas import LessonReportData, PacePoint

LOOKAHEAD_SENTENCES = 3
# Phrases that usually introduce a definition. Accents matter ("e um" would match "and a").
_DEFINITION_MARKERS = re.compile(r"\b(significa|serve para|é um|é uma|quer dizer|ou seja)\b")


def _ts(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _norm(text: str) -> str:
    return unicodedata.normalize("NFC", text).lower()


def pace_by_minute(utterances: list[dict[str, Any]]) -> list[PacePoint]:
    """Average wpm per minute since the first sentence (timezone-aware datetimes)."""
    if not utterances:
        return []
    start = _ts(utterances[0]["created_at"])
    buckets: dict[int, list[int]] = {}
    for u in utterances:
        minute = int((_ts(u["created_at"]) - start).total_seconds() // 60)
        buckets.setdefault(minute, []).append(int(u.get("wpm") or 0))
    return [PacePoint(minute=m, wpm=round(sum(v) / len(v))) for m, v in sorted(buckets.items())]


def undefined_terms(utterances: list[dict[str, Any]]) -> list[str]:
    """Terms whose first mention is not followed by a definition marker (in the rest of that
    sentence or in the next 3 sentences). Heuristic, documented in docs/DECISIONS.md."""
    first: dict[str, tuple[int, int]] = {}
    for i, u in enumerate(utterances):
        for span in u.get("terms") or []:
            term_id = span.get("termId")
            if term_id and term_id not in first:
                first[term_id] = (i, int(span.get("end", 0)))

    result: list[str] = []
    for term_id, (i, end) in first.items():
        window = [utterances[i]["text"][end:]] + [
            u["text"] for u in utterances[i + 1 : i + 1 + LOOKAHEAD_SENTENCES]
        ]
        if not any(_DEFINITION_MARKERS.search(_norm(t)) for t in window):
            result.append(term_id)
    return result


def build_report(utterances: list[dict[str, Any]]) -> LessonReportData:
    pace = pace_by_minute(utterances)
    wpms = [int(u.get("wpm") or 0) for u in utterances]
    duration = 0
    if utterances:
        delta = _ts(utterances[-1]["created_at"]) - _ts(utterances[0]["created_at"])
        duration = int(delta.total_seconds() // 60) + 1
    fastest = sorted(pace, key=lambda p: (-p.wpm, p.minute))[:3]
    return LessonReportData(
        total_utterances=len(utterances),
        duration_minutes=duration,
        avg_wpm=round(sum(wpms) / len(wpms)) if wpms else 0,
        pace=pace,
        fastest=fastest,
        undefined_terms=undefined_terms(utterances),
    )
