"""Removes personal identifiers from transcript text before it reaches the LLM (pitfall 33)."""

import re

PLACEHOLDER = "[removido]"

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", re.UNICODE)
_URL = re.compile(r"\b(?:https?://|www\.)\S+", re.IGNORECASE)
# Brazilian and international phone numbers: optional +country, optional (area), 8-9 digits
# with optional separators. Requires at least 8 digits overall.
_PHONE = re.compile(
    r"(?<!\w)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}(?!\w)"
)


def sanitize(text: str) -> str:
    text = _EMAIL.sub(PLACEHOLDER, text)
    text = _URL.sub(PLACEHOLDER, text)
    text = _PHONE.sub(PLACEHOLDER, text)
    return text
