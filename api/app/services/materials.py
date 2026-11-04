"""Summary + quiz generation: sanitize -> (chunk if long) -> LLM -> extract JSON -> validate,
with exactly one corrective retry on validation failure."""

import asyncio
import json
import re
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from app.llm import prompts
from app.llm.base import LLMError, LLMProvider
from app.schemas import ChunkNotes, Materials
from app.services.sanitize import sanitize

MAX_DIRECT_CHARS = 40_000
CHUNK_CHARS = 30_000
CHUNK_CONCURRENCY = 3

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def extract_json(text: str) -> object:
    """Accepts plain JSON, JSON inside code fences, or JSON surrounded by extra text."""
    cleaned = _FENCE.sub("", text.strip())
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("nenhum objeto JSON encontrado na resposta")
    return json.loads(cleaned[start : end + 1])


M = TypeVar("M", bound=BaseModel)


async def _ask(provider: LLMProvider, model: type[M], user: str, schema: dict, kind: str) -> M:
    prompt = user
    last_error = ""
    for attempt in range(2):
        raw = await provider.complete_json(
            system=prompts.SYSTEM, user=prompt, schema=schema, kind=kind
        )
        try:
            return model.model_validate(extract_json(raw))
        except (ValueError, ValidationError) as exc:
            last_error = str(exc)[:2000]
            if attempt == 0:
                prompt = user + prompts.RETRY_SUFFIX.format(error=last_error)
    raise LLMError(f"Resposta do modelo inválida após nova tentativa: {last_error[:300]}")


def split_chunks(text: str, size: int = CHUNK_CHARS) -> list[str]:
    """Splits on line boundaries so sentences stay whole."""
    chunks: list[str] = []
    current: list[str] = []
    length = 0
    for line in text.splitlines():
        if current and length + len(line) + 1 > size:
            chunks.append("\n".join(current))
            current, length = [], 0
        current.append(line)
        length += len(line) + 1
    if current:
        chunks.append("\n".join(current))
    return chunks


async def generate_materials(provider: LLMProvider, sentences: list[str]) -> Materials:
    transcript = sanitize("\n".join(s.strip() for s in sentences if s.strip()))
    if len(transcript) > MAX_DIRECT_CHARS:
        chunks = split_chunks(transcript)
        notes: list[str] = [prompts.COMBINED_HEADER]
        # Blocks are independent: summarize a few at a time instead of one by one, so a
        # long lesson fits in the host's request time limit.
        limit = asyncio.Semaphore(CHUNK_CONCURRENCY)

        async def one(i: int, chunk: str) -> ChunkNotes:
            async with limit:
                return await _ask(
                    provider,
                    ChunkNotes,
                    prompts.CHUNK_TASK.format(index=i, total=len(chunks), chunk=chunk),
                    prompts.CHUNK_SCHEMA,
                    "chunk_notes",
                )

        results = await asyncio.gather(*(one(i, c) for i, c in enumerate(chunks, start=1)))
        for i, n in enumerate(results, start=1):
            notes.append(
                f"Bloco {i}:\nTópicos: {'; '.join(n.topicos)}\nTermos: {', '.join(n.termos)}\n"
                f"Código citado: {' | '.join(n.exemplos_de_codigo) or 'nenhum'}"
            )
        transcript = "\n\n".join(notes)
    return await _ask(
        provider,
        Materials,
        prompts.MATERIALS_TASK.format(transcript=transcript),
        prompts.MATERIALS_SCHEMA,
        "materials",
    )
