"""Lesson routes. The store uses the Admin SDK (no security rules), so every route checks
here who is calling: owner-only routes answer 404/403 to anyone else, and joining applies
the same checks as the old join_lesson() SQL function."""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError

from app.auth import CurrentUser, get_current_user
from app.deps import get_llm, get_store
from app.llm.base import LLMError, LLMProvider
from app.schemas import (
    EndLessonResponse,
    GenerateRequest,
    JoinRequest,
    JoinResponse,
    LessonReportData,
    MaterialOut,
    Materials,
    MemberCountResponse,
    RegenerateResponse,
    TermReportRow,
)
from app.services.materials import generate_materials
from app.services.report import build_report
from app.services.term_report import term_report
from app.store import REQUIRED_PURPOSES, MaterialExists, Store

log = logging.getLogger("echodev.lessons")
router = APIRouter(prefix="/lessons", tags=["lessons"])

LLM_FAILED = (
    "Não foi possível gerar o resumo e o quiz agora. "
    "A aula continua encerrada; use 'Tentar de novo'."
)


async def _owned_lesson(store: Store, lesson_id: str, user: CurrentUser) -> dict[str, Any]:
    lesson = await store.get_lesson(lesson_id)
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aula não encontrada.")
    if lesson.get("teacher_id") != user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Somente o professor da aula pode fazer isso."
        )
    return lesson


def _draft(content: Any) -> dict[str, Any]:
    return {"content": content, "status": "rascunho", "approved_at": None}


async def _save_drafts(
    store: Store, lesson_id: str, materials: Materials, existing: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Create new drafts or overwrite existing (non-approved) ones. Never touches approved."""
    by_kind = {m["kind"]: m for m in existing}
    contents = {
        "resumo": materials.resumo.model_dump(),
        "quiz": [q.model_dump() for q in materials.quiz],
        "glossario": {"termos": [g.model_dump() for g in materials.glossario]},
    }
    saved: list[dict[str, Any]] = []
    for kind, content in contents.items():
        current = by_kind.get(kind)
        if current and current["status"] == "aprovado":
            saved.append(current)  # never overwrite what the teacher approved
            continue
        if current:
            saved.append(await store.update_material(lesson_id, kind, _draft(content)))
            continue
        try:
            saved.append(await store.create_material(lesson_id, kind, content))
        except MaterialExists:
            # A concurrent request (double click) created it first: update it, unless approved.
            found = await store.get_material(lesson_id, kind)
            if found and found["status"] != "aprovado":
                found = await store.update_material(lesson_id, kind, _draft(content))
            if found:
                saved.append(found)
    return saved


def _out(rows: list[dict[str, Any]]) -> list[MaterialOut]:
    out: list[MaterialOut] = []
    for r in rows:
        try:
            out.append(
                MaterialOut(id=r["id"], kind=r["kind"], status=r["status"], content=r["content"])
            )
        except ValidationError:
            # Edited by the teacher in the browser (rules, not Pydantic, guard those writes):
            # the response is informative only, the page reads materials from Firestore.
            log.warning("material %s skipped in the response: does not match the schema", r["id"])
    return out


def _known(body: GenerateRequest | None) -> list[str]:
    return body.known_terms if body else []


@router.post("/join", response_model=JoinResponse)
async def join_lesson(
    body: JoinRequest,
    user: CurrentUser = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> JoinResponse:
    """Join by the short code. Error details are codes the web app maps to messages."""
    profile = await store.get_profile(user.id)
    if not profile:
        raise HTTPException(status.HTTP_409_CONFLICT, "profile_missing")
    if profile.get("role") == "professor":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "teacher_cannot_join")
    if not set(REQUIRED_PURPOSES) <= await store.active_consents(user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "consent_required")
    code = body.code.strip().upper()
    lesson = await store.find_lesson_by_code(code)
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "invalid_code")
    if lesson.get("status") == "encerrada":
        raise HTTPException(status.HTTP_409_CONFLICT, "lesson_ended")
    await store.add_member(lesson["id"], str(profile["pseudonym_id"]), code)
    return JoinResponse(lesson_id=lesson["id"], title=str(lesson.get("title") or code))


@router.get("/{lesson_id}/member-count", response_model=MemberCountResponse)
async def member_count(
    lesson_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> MemberCountResponse:
    await _owned_lesson(store, str(lesson_id), user)
    return MemberCountResponse(count=await store.count_members(str(lesson_id)))


@router.get("/{lesson_id}/term-report", response_model=list[TermReportRow])
async def lesson_term_report(
    lesson_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> list[TermReportRow]:
    await _owned_lesson(store, str(lesson_id), user)
    return term_report(await store.list_term_events(str(lesson_id)))


@router.post("/{lesson_id}/end", response_model=EndLessonResponse)
async def end_lesson(
    lesson_id: UUID,
    body: GenerateRequest | None = None,
    user: CurrentUser = Depends(get_current_user),
    store: Store = Depends(get_store),
    llm: LLMProvider = Depends(get_llm),
) -> EndLessonResponse:
    """Idempotent: ends the lesson, snapshots the report and creates draft materials once."""
    lesson_id = str(lesson_id)  # validated as UUID by FastAPI; strings from here on
    lesson = await _owned_lesson(store, lesson_id, user)

    if lesson.get("status") != "encerrada":
        await store.update_lesson(lesson_id, {"status": "encerrada", "ended_at": datetime.now(UTC)})

    utterances = await store.list_utterances(lesson_id)
    existing_report = await store.get_report(lesson_id)
    if existing_report and not utterances:
        report = LessonReportData.model_validate(existing_report)
    else:
        report = build_report(utterances)
        await store.set_report(lesson_id, report.model_dump())

    existing = await store.list_materials(lesson_id)
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
        materials = await generate_materials(llm, [u["text"] for u in utterances], _known(body))
    except LLMError as exc:
        log.warning("LLM failed for lesson %s: %s", lesson_id, exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, LLM_FAILED) from exc

    saved = await _save_drafts(store, lesson_id, materials, existing)
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
    body: GenerateRequest | None = None,
    user: CurrentUser = Depends(get_current_user),
    store: Store = Depends(get_store),
    llm: LLMProvider = Depends(get_llm),
) -> RegenerateResponse:
    lesson_id = str(lesson_id)  # validated as UUID by FastAPI; strings from here on
    lesson = await _owned_lesson(store, lesson_id, user)
    if lesson.get("status") != "encerrada":
        raise HTTPException(status.HTTP_409_CONFLICT, "Encerre a aula antes de gerar o material.")

    existing = await store.list_materials(lesson_id)
    if any(m["status"] == "aprovado" for m in existing):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Já existe material aprovado. Descarte-o antes de gerar de novo.",
        )
    utterances = await store.list_utterances(lesson_id)
    if not utterances:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A transcrição desta aula não está mais disponível (ela é apagada em 24 horas).",
        )
    try:
        materials = await generate_materials(llm, [u["text"] for u in utterances], _known(body))
    except LLMError as exc:
        log.warning("LLM failed for lesson %s: %s", lesson_id, exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, LLM_FAILED) from exc

    saved = await _save_drafts(store, lesson_id, materials, existing)
    return RegenerateResponse(lesson_id=lesson_id, materials=_out(saved))
