#!/usr/bin/env python3
"""A cadeia inteira de uma marca, com as partes próprias da marca.

    python3 cadeia.py --marca midea --ano 2026                  # mapa → … → páginas
    python3 cadeia.py --marca midea --ano 2026 --desde extrair  # mantém o mapa.json editado
    python3 cadeia.py --marca midea --ano 2026 --enviar [--dry-run]

Pasta de trabalho: `product-scaffold/pdf-extract/<marca>/` com
`<marca>-tabela-precos-<ano>.pdf` (ou `--pdf`). Passos: mapa → extrair →
agrupar → pós-processamento da marca → validar (+ CSV) → páginas [→ enviar].

Partes por marca em `marcas/<marca>/` (ao lado de `scripts/`), todas opcionais:

- `mapa.py`: `gerar(doc, ficheiro, marca, ano) -> dict` substitui o mapa
  automático (Midea: sem índice); `corrigir(mapa) -> None` edita o automático
  (Hisense: classificações e gamas).
- `extrair.py`: `extrair_pagina(page, seccoes, numero) -> list | None` lê as
  páginas que o leitor genérico não percebe (Nipon: fichas com um modelo por
  coluna); None = leitor genérico.
- `pos.py`: `corrigir(run, doc) -> None` entre `agrupar.py` e `validar.py`
  (gralhas de refs, produtos sem ref impressa, compatibilidade lida de matrizes).
- `NOTAS.md`: particularidades da tabela.

As partes importam o toolkit como módulos (`from mapa import …`,
`from _comum import …`); o `cadeia.py` carrega-as pelo caminho do ficheiro.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import pymupdf

from _comum import escrever_json, ler_json, parte_da_marca, raiz_repo
from mapa import gerar_mapa, validar_mapa

SCRIPTS = Path(__file__).resolve().parent
PASSOS = ("mapa", "extrair", "agrupar", "pos", "validar", "paginas")


def construir_mapa(doc: pymupdf.Document, ficheiro: str, marca: str, ano: int) -> dict:
    parte = parte_da_marca(marca, "mapa")
    if parte is not None and hasattr(parte, "gerar"):
        mapa = parte.gerar(doc, ficheiro, marca, ano)
    else:
        mapa = gerar_mapa(doc, ficheiro, marca, ano)
    if parte is not None and hasattr(parte, "corrigir"):
        parte.corrigir(mapa)
    return mapa


def pos_processar(run: dict, doc: pymupdf.Document, marca: str) -> bool:
    parte = parte_da_marca(marca, "pos")
    if parte is None:
        return False
    parte.corrigir(run, doc)
    return True


def _correr(script: str, *args: str, pasta: Path) -> None:
    r = subprocess.run([sys.executable, str(SCRIPTS / script), *args], cwd=pasta)
    if r.returncode:
        raise SystemExit(f"{script} falhou ({r.returncode})")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--marca", required=True)
    ap.add_argument("--ano", type=int, required=True)
    ap.add_argument("--pdf", type=Path, help="default: <pasta>/<marca>-tabela-precos-<ano>.pdf")
    ap.add_argument("--pasta", type=Path, help="default: product-scaffold/pdf-extract/<marca>/")
    ap.add_argument("--desde", choices=PASSOS, default="mapa")
    ap.add_argument("--enviar", action="store_true", help="no fim, enviar.py (escreve no Convex)")
    ap.add_argument("--dry-run", action="store_true", help="com --enviar: só mostra o que enviaria")
    args = ap.parse_args()

    raiz = raiz_repo(SCRIPTS)
    pasta = (args.pasta or raiz / "product-scaffold" / "pdf-extract" / args.marca).resolve()
    pdf = (args.pdf or pasta / f"{args.marca}-tabela-precos-{args.ano}.pdf").resolve()
    if not pdf.is_file():
        raise SystemExit(f"PDF não encontrado: {pdf}")
    if not (raiz / "product-scaffold" / "spec-registry.json").is_file():
        raise SystemExit("falta product-scaffold/spec-registry.json: corre `pnpm registry:json`")
    tabela = f"{args.marca}-{args.ano}"
    staged = pasta / f"{tabela}-staged.json"
    doc = pymupdf.open(pdf)
    passos = PASSOS[PASSOS.index(args.desde):]

    if "mapa" in passos:
        mapa = construir_mapa(doc, pdf.name, args.marca, args.ano)
        erros = validar_mapa(mapa)
        escrever_json(pasta / "mapa.json", mapa)
        if erros:
            for e in erros:
                print(f"  ✗ {e}")
            raise SystemExit(f"mapa.json com {len(erros)} erro(s): corrigir em marcas/{args.marca}/mapa.py")
        n = sum(1 for s in mapa["seccoes"] if s.get("tipo") != "ignorar")
        print(f"mapa: {n} secções (estratégia {mapa.get('estrategia')})", flush=True)
    if "extrair" in passos:
        _correr("extrair.py", str(pdf), "--mapa", "mapa.json", "--todas", "--marca", args.marca, pasta=pasta)
    if "agrupar" in passos:
        _correr("agrupar.py", "--mapa", "mapa.json", "--marca", args.marca, "--ano", str(args.ano),
                "--ficheiro", pdf.name, "-o", staged.name, pasta=pasta)
    if "pos" in passos:
        run = ler_json(staged)
        if pos_processar(run, doc, args.marca):
            escrever_json(staged, run)
            print(f"pós-processamento marcas/{args.marca}/pos.py: {len(run['skus'])} SKUs", flush=True)
    if "validar" in passos:
        _correr("validar.py", staged.name, "--csv", pasta=pasta)
    if "paginas" in passos:
        _correr("paginas.py", str(pdf), "--tabela-origem", tabela, "--staged", staged.name, pasta=pasta)
    if args.enviar:
        _correr("enviar.py", staged.name, "--pdf", str(pdf), *(["--dry-run"] if args.dry_run else []), pasta=pasta)


if __name__ == "__main__":
    main()
