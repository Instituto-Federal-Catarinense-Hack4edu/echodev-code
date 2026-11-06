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

MOCK_MATERIALS["glossario"] = [
    {
        "termo": "git init",
        "nome_es": "git init",
        "categoria": "git",
        "pt": {
            "curta": "Comando que transforma a pasta atual em um repositório Git novo.",
            "exemplo": "git init → a pasta do projeto passa a guardar o histórico do Git.",
            "passos": [
                "Abra o terminal na pasta do projeto.",
                "Digite git init e aperte Enter.",
                "Pronto: agora você já pode fazer commits nessa pasta.",
            ],
        },
        "es": {
            "curta": "Comando que convierte la carpeta actual en un repositorio Git nuevo.",
            "exemplo": "git init → la carpeta del proyecto empieza a guardar el historial de Git.",
            "passos": [
                "Abre la terminal en la carpeta del proyecto.",
                "Escribe git init y pulsa Enter.",
                "Listo: ya puedes hacer commits en esa carpeta.",
            ],
        },
        "en_curta": "Command that turns the current folder into a new Git repository.",
        "variacoes": ["guit init", "git inite"],
    },
    {
        "termo": "componente",
        "nome_es": "componente",
        "categoria": "web",
        "pt": {
            "curta": "No React, um pedaço reutilizável da tela, com seu próprio código.",
            "exemplo": "function Botao() { return <button>Ok</button>; } → <Botao /> é um botão.",
            "passos": [
                "Crie uma função com nome começando por letra maiúscula.",
                "Faça a função devolver o que deve aparecer na tela.",
                "Use o componente como uma tag: <Botao />.",
            ],
        },
        "es": {
            "curta": "En React, una parte reutilizable de la pantalla, con su propio código.",
            "exemplo": "function Boton() { return <button>Ok</button>; } → <Boton /> es un botón.",
            "passos": [
                "Crea una función cuyo nombre empiece con mayúscula.",
                "Haz que la función devuelva lo que debe aparecer en pantalla.",
                "Usa el componente como una etiqueta: <Boton />.",
            ],
        },
        "en_curta": "In React, a reusable piece of the screen with its own code.",
        "variacoes": [],
    },
]

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
