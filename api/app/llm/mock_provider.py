"""Fixed, coherent output so the whole flow works without an API key (LLM_PROVIDER=mock)."""

import json
from typing import Any

MOCK_MATERIALS: dict[str, Any] = {
    "resumo": {
        "titulo": "Git e primeiros passos em React",
        "topicos": [
            "O Git guarda o histórico do código; um repositório é criado com git init.",
            "Um commit é um ponto salvo do projeto, com uma mensagem curta sobre a mudança.",
            "Uma branch permite trabalhar separado da principal; depois se abre um pull request.",
            "Variáveis guardam valores e funções são blocos de código com nome e parâmetros.",
            "No React, useState guarda um valor que muda e useEffect roda código depois da tela.",
        ],
        "termos_chave": ["git", "commit", "branch", "pull request", "função", "useState"],
    },
    "quiz": [
        {
            "pergunta": "O que é um commit?",
            "tipo": "conceito",
            "codigo": None,
            "opcoes": [
                "Um ponto salvo no histórico do Git, com uma mensagem",
                "Um servidor onde o site fica publicado",
                "Um tipo de variável do JavaScript",
                "Uma cópia do repositório em outro computador",
            ],
            "correta": 0,
            "explicacao": "Na aula, o commit foi comparado a uma foto do projeto naquele momento.",
        },
        {
            "pergunta": "Para que serve criar uma branch?",
            "tipo": "conceito",
            "codigo": None,
            "opcoes": [
                "Para apagar o histórico",
                "Para mexer no código sem estragar a principal",
                "Para publicar o site",
                "Para instalar bibliotecas",
            ],
            "correta": 1,
            "explicacao": "A branch é uma linha de trabalho separada da principal.",
        },
        {
            "pergunta": "O que este comando faz?",
            "tipo": "codigo",
            "codigo": 'git commit -m "corrige soma"',
            "opcoes": [
                "Envia o código para o GitHub",
                "Cria uma branch chamada corrige soma",
                "Salva as mudanças marcadas com essa mensagem",
                "Desfaz o último commit",
            ],
            "correta": 2,
            "explicacao": "git commit cria um ponto salvo com a mensagem passada em -m.",
        },
        {
            "pergunta": "Qual valor a função devolve em dobro(5)?",
            "tipo": "codigo",
            "codigo": "function dobro(n) {\n  return n * 2;\n}",
            "opcoes": ["5", "25", "2", "10"],
            "correta": 3,
            "explicacao": "return devolve n * 2; com n = 5 o resultado é 10.",
        },
        {
            "pergunta": "Para que serve o useState no React?",
            "tipo": "conceito",
            "codigo": None,
            "opcoes": [
                "Para o componente lembrar um valor que pode mudar",
                "Para estilizar a página",
                "Para fazer o deploy",
                "Para criar um repositório",
            ],
            "correta": 0,
            "explicacao": "Na aula, useState foi usado para o componente lembrar um valor.",
        },
    ],
}

MOCK_CHUNK_NOTES: dict[str, Any] = {
    "topicos": ["Histórico do código com Git", "Commits e branches"],
    "termos": ["git", "commit", "branch"],
    "exemplos_de_codigo": ['git commit -m "mensagem"'],
}


class MockProvider:
    name = "mock"

    async def complete_json(
        self, *, system: str, user: str, schema: dict[str, Any], kind: str
    ) -> str:
        data = MOCK_CHUNK_NOTES if kind == "chunk_notes" else MOCK_MATERIALS
        return json.dumps(data, ensure_ascii=False)
