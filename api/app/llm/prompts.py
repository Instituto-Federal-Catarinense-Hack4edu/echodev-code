"""Prompts and output schemas. Instructions follow the spec: only what was said in class,
nothing invented, Brazilian Portuguese, JSON only."""

from typing import Any

SYSTEM = """Você ajuda professores de programação a preparar material de revisão para estudantes.
Você recebe a transcrição automática de uma aula (pode ter erros de reconhecimento de voz).

Regras:
- Use somente o que foi dito na aula. Não invente conteúdo, exemplos ou termos que não apareceram.
- Se a transcrição for curta ou vaga, faça material curto e fiel a ela, sem completar com
  conhecimento externo.
- Escreva em português do Brasil, com frases simples, pensando em estudantes iniciantes,
  estudantes estrangeiros e estudantes com deficiência auditiva.
- O professor vai revisar e aprovar tudo antes de os estudantes verem.
- Responda apenas com o JSON pedido, sem texto antes ou depois."""

MATERIALS_TASK = """Gere o resumo e o quiz da aula abaixo.

Formato:
- resumo.titulo: título curto da aula.
- resumo.topicos: de 3 a 6 tópicos, cada um uma frase que explica uma ideia da aula.
- resumo.termos_chave: termos técnicos citados na aula.
- quiz: exatamente 5 questões de múltipla escolha, cada uma com 4 opções, o índice da correta
  (0 a 3) e uma explicação curta de por que ela está certa.
- Pelo menos 2 questões devem ser do tipo "codigo": mostre um trecho curto de código no campo
  "codigo" (relacionado ao que foi dito) e pergunte algo sobre ele. As demais são "conceito"
  com "codigo" nulo.

Transcrição da aula:
<transcricao>
{transcript}
</transcricao>"""

CHUNK_TASK = """Este é o bloco {index} de {total} da transcrição de uma aula longa.
Anote os tópicos explicados, os termos técnicos citados e trechos de código mencionados,
somente com base neste bloco.

<bloco>
{chunk}
</bloco>"""

COMBINED_HEADER = (
    "A aula foi longa; abaixo estão as anotações de cada bloco, em ordem. "
    "Use-as como se fossem a transcrição."
)

RETRY_SUFFIX = """

Sua resposta anterior não passou na validação:
{error}
Corrija e responda de novo apenas com o JSON completo."""

_STR = {"type": "string"}
_STR_LIST = {"type": "array", "items": _STR}

# Kept simple on purpose: counts (3-6 topics, 5 questions, >=2 code questions) are enforced
# by Pydantic, which triggers one corrective retry.
MATERIALS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "resumo": {
            "type": "object",
            "properties": {"titulo": _STR, "topicos": _STR_LIST, "termos_chave": _STR_LIST},
            "required": ["titulo", "topicos", "termos_chave"],
            "additionalProperties": False,
        },
        "quiz": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "pergunta": _STR,
                    "tipo": {"type": "string", "enum": ["conceito", "codigo"]},
                    "codigo": {"anyOf": [_STR, {"type": "null"}]},
                    "opcoes": _STR_LIST,
                    "correta": {"type": "integer"},
                    "explicacao": _STR,
                },
                "required": ["pergunta", "tipo", "codigo", "opcoes", "correta", "explicacao"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["resumo", "quiz"],
    "additionalProperties": False,
}

CHUNK_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {"topicos": _STR_LIST, "termos": _STR_LIST, "exemplos_de_codigo": _STR_LIST},
    "required": ["topicos", "termos", "exemplos_de_codigo"],
    "additionalProperties": False,
}
