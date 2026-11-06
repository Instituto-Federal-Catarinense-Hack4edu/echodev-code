"""Per-term aggregates for the teacher (replaces the old lesson_term_report SQL function).

Terms touched by fewer than `min_students` distinct students are left out; the minimum is
never below 3, whatever the caller passes. Pseudonyms are only counted, never returned.
"""

from collections import defaultdict
from typing import Any

from app.schemas import TermReportRow

MIN_STUDENTS = 3


def term_report(
    events: list[dict[str, Any]], min_students: int = MIN_STUDENTS
) -> list[TermReportRow]:
    minimum = max(min_students, MIN_STUDENTS)
    counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    students: dict[str, set[str]] = defaultdict(set)
    for e in events:
        term = e.get("term_id")
        kind = e.get("kind")
        if not isinstance(term, str) or kind not in ("tap", "doubt", "helped", "not_helped"):
            continue
        counts[term][kind] += 1
        if e.get("pseudonym_id"):
            students[term].add(str(e["pseudonym_id"]))
    rows = [
        TermReportRow(
            term_id=term,
            taps=c["tap"],
            students=len(students[term]),
            doubts=c["doubt"],
            helped=c["helped"],
            not_helped=c["not_helped"],
        )
        for term, c in counts.items()
        if len(students[term]) >= minimum
    ]
    return sorted(rows, key=lambda r: (-r.taps, r.term_id))
