"""Teacher-only lesson routes. Every DB call uses the caller's own token (RLS applies):
if the caller is not the owner, PostgREST returns nothing and we answer 403/404."""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import CurrentUser, get_current_user, get_http
from app.config import Settings, get_settings
from app.deps import get_llm
from app.llm.base import LLMError, LLMProvider
from app.schemas import (
    EndLessonResponse,
    LessonReportData,
    MaterialOut,
    Materials,
    RegenerateResponse,
)
from app.services.materials import generate_materials
from app.services.report import build_report
from app.supabase_rest import SupabaseError, UserRest

log = logging.getLogger("echodev.lessons")
router = APIRouter(prefix="/lessons", tags=["lessons"])

LLM_FAILED = (
    "Não foi possível gerar o resumo e o quiz agora. "
    "A aula continua encerrada; use 'Tentar de novo'."
)


def _rest(user: CurrentUser, http: httpx.AsyncClient, settings: Settings) -> UserRest:
    return UserRest(http, settings, user.token)


async def _owned_lesson(rest: UserRest, lesson_id: str, user: CurrentUser) -> dict[str, Any]:
    try:
        rows = await rest.select(
            "lessons", {"id": f"eq.{lesson_id}", "select": "id,teacher_id,status"}
        )
    except SupabaseError as exc:
        if exc.status in (400, 404):  # e.g. malformed uuid
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Aula não encontrada.") from exc
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Falha ao consultar o banco.") from exc
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aula não encontrada.")
    if rows[0]["teacher_id"] != user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Somente o professor da aula pode fazer isso."
        )
    return rows[0]


async def _utterances(rest: UserRest, lesson_id: str) -> list[dict[str, Any]]:
    return await rest.select_all(
        "utterances",
        {
            "lesson_id": f"eq.{lesson_id}",
            "select": "seq,text,terms,wpm,created_at",
            "order": "seq.asc",
        },
    )


async def _materials(rest: UserRest, lesson_id: str) -> list[dict[str, Any]]:
    return await rest.select(
        "lesson_materials",
        {"lesson_id": f"eq.{lesson_id}", "select": "id,kind,status,content", "order": "kind.desc"},
    )


async def _save_drafts(
    rest: UserRest, lesson_id: str, materials: Materials, existing: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Insert new drafts or overwrite existing (non-approved) ones. Never touches approved."""
    now = datetime.now(UTC).isoformat()
    by_kind = {m["kind"]: m for m in existing}
    contents = {
        "resumo": materials.resumo.model_dump(),
        "quiz": [q.model_dump() for q in materials.quiz],
    }
    saved: list[dict[str, Any]] = []
    for kind, content in contents.items():
        current = by_kind.get(kind)
        values = {"content": content, "status": "rascunho", "approved_at": None, "updated_at": now}
        if current and current["status"] == "aprovado":
            saved.append(current)  # never overwrite what the teacher approved
            continue
        if current:
            rows = await rest.update("lesson_materials", {"id": f"eq.{current['id']}"}, values)
        else:
            # Plain insert: an upsert would need UPDATE rights on lesson_id/kind (not granted).
            try:
                rows = await rest.insert(
                    "lesson_materials", {"lesson_id": lesson_id, "kind": kind, "content": content}
                )
            except SupabaseError as exc:
                if exc.status != 409:
                    raise
                # A concurrent request (double click) inserted it first: update that row,
                # unless it is already approved.
                found = await rest.select(
                    "lesson_materials",
                    {
                        "lesson_id": f"eq.{lesson_id}",
                        "kind": f"eq.{kind}",
                        "select": "id,kind,status,content",
                    },
                )
                if not found or found[0]["status"] == "aprovado":
                    saved.extend(found)
                    continue
                rows = await rest.update("lesson_materials", {"id": f"eq.{found[0]['id']}"}, values)
        saved.extend(rows)
    return saved


def _out(rows: list[dict[str, Any]]) -> list[MaterialOut]:
    return [
        MaterialOut(id=r["id"], kind=r["kind"], status=r["status"], content=r["content"])
        for r in rows
    ]


@router.post("/{lesson_id}/end", response_model=EndLessonResponse)
async def end_lesson(
    lesson_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    http: httpx.AsyncClient = Depends(get_http),
    settings: Settings = Depends(get_settings),
    llm: LLMProvider = Depends(get_llm),
) -> EndLessonResponse:
    """Idempotent: ends the lesson, snapshots the report and creates draft materials once."""
    lesson_id = str(lesson_id)  # validated as UUID by FastAPI; strings from here on
    rest = _rest(user, http, settings)
    lesson = await _owned_lesson(rest, lesson_id, user)

    if lesson["status"] != "encerrada":
        await rest.update(
            "lessons",
            {"id": f"eq.{lesson_id}"},
            {"status": "encerrada", "ended_at": datetime.now(UTC).isoformat()},
        )

    utterances = await _utterances(rest, lesson_id)
    existing_report = await rest.select(
        "lesson_reports", {"lesson_id": f"eq.{lesson_id}", "select": "data"}
    )
    if existing_report and not utterances:
        report = LessonReportData.model_validate(existing_report[0]["data"])
    else:
        report = build_report(utterances)
        await rest.upsert(
            "lesson_reports",
            {"lesson_id": lesson_id, "data": report.model_dump()},
            on_conflict="lesson_id",
        )

    existing = await _materials(rest, lesson_id)
    if existing:
        return EndLessonResponse(
            lesson_id=lesson_id,
            status="encerrada",
            materials_status="existente",
            materials=_out(existing),
            report=report,
        )
    if not utterances:
        return EndLessonResponse(
            lesson_id=lesson_id,
            status="encerrada",
            materials_status="sem_transcricao",
            materials=[],
            report=report,
        )

    try:
        materials = await generate_materials(llm, [u["text"] for u in utterances])
    except LLMError as exc:
        log.warning("LLM failed for lesson %s: %s", lesson_id, exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, LLM_FAILED) from exc

    saved = await _save_drafts(rest, lesson_id, materials, existing)
    return EndLessonResponse(
        lesson_id=lesson_id,
        status="encerrada",
        materials_status="gerado",
        materials=_out(saved),
        report=report,
    )


@router.post("/{lesson_id}/materials/regenerate", response_model=RegenerateResponse)
async def regenerate_materials(
    lesson_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    http: httpx.AsyncClient = Depends(get_http),
    settings: Settings = Depends(get_settings),
    llm: LLMProvider = Depends(get_llm),
) -> RegenerateResponse:
    lesson_id = str(lesson_id)  # validated as UUID by FastAPI; strings from here on
    rest = _rest(user, http, settings)
    lesson = await _owned_lesson(rest, lesson_id, user)
    if lesson["status"] != "encerrada":
        raise HTTPException(status.HTTP_409_CONFLICT, "Encerre a aula antes de gerar o material.")

    existing = await _materials(rest, lesson_id)
    if any(m["status"] == "aprovado" for m in existing):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Já existe material aprovado. Descarte-o antes de gerar de novo.",
        )
    utterances = await _utterances(rest, lesson_id)
    if not utterances:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A transcrição desta aula não está mais disponível (ela é apagada em 24 horas).",
        )
    try:
        materials = await generate_materials(llm, [u["text"] for u in utterances])
    except LLMError as exc:
        log.warning("LLM failed for lesson %s: %s", lesson_id, exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, LLM_FAILED) from exc

    saved = await _save_drafts(rest, lesson_id, materials, existing)
    return RegenerateResponse(lesson_id=lesson_id, materials=_out(saved))
