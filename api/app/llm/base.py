from typing import Any, Protocol


class LLMError(Exception):
    """The model could not produce a usable answer (API failure, refusal, invalid output)."""


class LLMProvider(Protocol):
    name: str

    async def complete_json(
        self, *, system: str, user: str, schema: dict[str, Any], kind: str
    ) -> str:
        """Returns the raw text of a JSON answer. `kind` is "materials" or "chunk_notes"."""
        ...
