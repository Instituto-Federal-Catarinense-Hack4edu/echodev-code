"""Pydantic models shared by the API and the generated TypeScript types (gen:api-types)."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

# ---------- LLM output ----------


class Resumo(BaseModel):
    titulo: str = Field(min_length=1, max_length=200)
    topicos: list[str] = Field(min_length=3, max_length=6)
    termos_chave: list[str] = Field(default_factory=list, max_length=30)


class QuizItem(BaseModel):
    pergunta: str = Field(min_length=1)
    tipo: Literal["conceito", "codigo"]
    codigo: str | None = None
    opcoes: list[str] = Field(min_length=4, max_length=4)
    correta: int = Field(ge=0, le=3)
    explicacao: str = Field(min_length=1)

    @model_validator(mode="after")
    def _code_needs_snippet(self) -> "QuizItem":
        if self.tipo == "codigo" and not (self.codigo and self.codigo.strip()):
            raise ValueError("questão do tipo 'codigo' precisa do campo 'codigo' preenchido")
        return self


class Materials(BaseModel):
    resumo: Resumo
    quiz: list[QuizItem] = Field(min_length=5, max_length=5)

    @model_validator(mode="after")
    def _two_code_questions(self) -> "Materials":
        if sum(1 for q in self.quiz if q.tipo == "codigo") < 2:
            raise ValueError("o quiz precisa de pelo menos 2 questões do tipo 'codigo'")
        return self


class ChunkNotes(BaseModel):
    """Intermediate summary of one block of a long transcript."""

    topicos: list[str] = Field(min_length=1, max_length=12)
    termos: list[str] = Field(default_factory=list, max_length=40)
    exemplos_de_codigo: list[str] = Field(default_factory=list, max_length=10)


# ---------- Report snapshot (no transcript text) ----------


class PacePoint(BaseModel):
    minute: int
    wpm: int


class LessonReportData(BaseModel):
    total_utterances: int
    duration_minutes: int
    avg_wpm: int
    pace: list[PacePoint]
    fastest: list[PacePoint]
    undefined_terms: list[str]


# ---------- API responses ----------

MaterialKind = Literal["resumo", "quiz"]
MaterialStatus = Literal["rascunho", "aprovado", "descartado"]


class MaterialOut(BaseModel):
    id: str
    kind: MaterialKind
    status: MaterialStatus
    content: Resumo | list[QuizItem]


class EndLessonResponse(BaseModel):
    lesson_id: str
    status: Literal["encerrada"]
    materials_status: Literal["gerado", "existente", "sem_transcricao"]
    materials: list[MaterialOut]
    report: LessonReportData


class RegenerateResponse(BaseModel):
    lesson_id: str
    materials: list[MaterialOut]


class PurgeResponse(BaseModel):
    deleted: int


class DeleteMeResponse(BaseModel):
    deleted: bool


class ProfileRequest(BaseModel):
    # What the person chose on the sign-in screen. "professor" is refused (no profile is
    # created) when the e-mail is not on the allowlist, instead of silently becoming a student.
    intent: Literal["professor", "estudante"] | None = None


class ProfileOut(BaseModel):
    user_id: str
    role: Literal["professor", "estudante"]
    depth_pref: Literal["curta", "exemplo", "passos"]
    lang_pref: Literal["pt", "en", "es"]
    created: bool


class JoinRequest(BaseModel):
    code: str = Field(min_length=1, max_length=16)


class JoinResponse(BaseModel):
    lesson_id: str
    title: str


class MemberCountResponse(BaseModel):
    count: int


class TermReportRow(BaseModel):
    term_id: str
    taps: int
    students: int
    doubts: int
    helped: int
    not_helped: int
