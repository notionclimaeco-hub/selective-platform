#!/usr/bin/env python3
"""6. Enviar: PDF, renders e SKUs em staging → import run no Convex (#40).

    python3 enviar.py hisense-2026-staged.json --pdf tabela.pdf [--paginas paginas/] [--dry-run] [--forcar]

Lê `VITE_CONVEX_URL` (ou `CONVEX_URL`) e `IMPORT_SECRET` do `.env` da raiz e
fala com a API HTTP do Convex (`POST {url}/api/mutation`), sem Node:

1. `importData:gerarUploadUrl` + POST do PDF → storage id.
2. `importacoes:criarImportacao` (marca, ano, tabelaOrigem, ficheiro, pdf).
3. `importacoes:carregarSkus` em lotes de 100; erros por SKU são impressos e a
   run fica em `a-extrair` para corrigir e reenviar (um novo `criarImportacao`
   da mesma tabela substitui a run aberta).
4. `importacoes:registarPaginaImagem` por PNG e `importData:registarPagina`
   por PDF de uma página em `--paginas`.
5. `importacoes:concluirCarregamento` → contagens e o caminho da revisão.

Recusa enviar enquanto houver avisos `erro:` (o Convex rejeitaria essas
linhas), salvo `--forcar`. `--dry-run` só mostra o que faria.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable

from _comum import ler_json, raiz_repo

LOTE = 100
Transporte = Callable[[str, str, dict, bytes | None], tuple[int, bytes]]


def transporte_urllib(metodo: str, url: str, cabecalhos: dict, corpo: bytes | None) -> tuple[int, bytes]:
    pedido = urllib.request.Request(url, data=corpo, method=metodo, headers=cabecalhos)
    try:
        with urllib.request.urlopen(pedido, timeout=120) as resposta:
            return resposta.status, resposta.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


class Convex:
    """Cliente mínimo da API HTTP do Convex para as mutations guardadas por segredo."""

    def __init__(self, url: str, secret: str, transporte: Transporte = transporte_urllib):
        self.url = url.rstrip("/")
        self.secret = secret
        self.transporte = transporte

    def mutation(self, path: str, args: dict) -> object:
        corpo = json.dumps({"path": path, "args": {**args, "secret": self.secret}, "format": "json"}).encode()
        status, resposta = self.transporte("POST", f"{self.url}/api/mutation",
                                           {"Content-Type": "application/json"}, corpo)
        try:
            dados = json.loads(resposta or b"{}")
        except json.JSONDecodeError:
            raise RuntimeError(f"{path}: resposta inválida ({status}): {resposta[:200]!r}")
        if status != 200 or dados.get("status") != "success":
            raise RuntimeError(f"{path}: {dados.get('errorMessage') or dados.get('message') or resposta[:200]!r}")
        return dados.get("value")

    def upload(self, dados: bytes, content_type: str) -> str:
        url = self.mutation("importData:gerarUploadUrl", {})
        status, resposta = self.transporte("POST", str(url), {"Content-Type": content_type}, dados)
        if status != 200:
            raise RuntimeError(f"upload falhou ({status}): {resposta[:200]!r}")
        return json.loads(resposta)["storageId"]


def ler_env(raiz: Path) -> tuple[str, str]:
    env = {}
    ficheiro = raiz / ".env"
    if ficheiro.is_file():
        for linha in ficheiro.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$", linha)
            if m:
                env[m.group(1)] = m.group(2).strip("\"'")
    url = env.get("VITE_CONVEX_URL") or env.get("CONVEX_URL")
    secret = env.get("IMPORT_SECRET")
    if not url or not secret:
        raise SystemExit("VITE_CONVEX_URL/CONVEX_URL e IMPORT_SECRET em falta no .env da raiz")
    return url, secret


CAMPOS_SKU = ("ref", "ean", "marca", "nome", "nomeGrupo", "familia", "segmento", "sistema", "tipoUnidade",
              "componente", "gama", "grupoModelo", "atributos", "descricao", "pvpCents", "ivaIncluido",
              "tabelaOrigem", "pdfPaginas", "compativelCom", "avisos")


def _sku_para_envio(sku: dict) -> dict:
    return {k: sku[k] for k in CAMPOS_SKU if k in sku and sku[k] is not None}


def _ficheiros_de_paginas(paginas: Path | None, tabela_origem: str) -> list[tuple[int, Path, str]]:
    if not paginas or not Path(paginas).is_dir():
        return []
    out = []
    for f in sorted(Path(paginas).iterdir()):
        m = re.fullmatch(rf"{re.escape(tabela_origem)}-p(\d+)\.(png|pdf)", f.name)
        if m:
            out.append((int(m.group(1)), f, m.group(2)))
    return out


def enviar(run: dict, cliente: Convex, pdf: Path | None, paginas: Path | None, lote: int = LOTE,
           forcar: bool = False, dry_run: bool = False, log=print) -> dict:
    skus = run["skus"]
    com_erro = [s["ref"] for s in skus if any(a.startswith("erro:") for a in s.get("avisos", []))]
    if com_erro and not forcar:
        raise RuntimeError(f"{len(com_erro)} SKUs com avisos 'erro:' (o Convex rejeitá-los-ia): "
                           f"{', '.join(com_erro[:8])}{', …' if len(com_erro) > 8 else ''}. "
                           "Corrige e volta a correr validar.py, ou usa --forcar.")
    lotes = [skus[i:i + lote] for i in range(0, len(skus), lote)]
    ficheiros = _ficheiros_de_paginas(paginas, run["tabelaOrigem"])
    resumo = {"importacaoId": None, "carregados": 0, "erros": [], "paginas": len(ficheiros),
              "lotes": len(lotes), "contagens": None}
    if dry_run:
        log(f"[dry-run] {len(skus)} SKUs em {len(lotes)} lotes, PDF {'sim' if pdf else 'não'}, "
            f"{len(ficheiros)} ficheiros de páginas")
        return resumo

    pdf_id = None
    if pdf is not None:
        pdf_id = cliente.upload(Path(pdf).read_bytes(), "application/pdf")
        log(f"PDF carregado ({pdf_id})")
    args = {"marca": run["marca"], "ano": run["ano"], "tabelaOrigem": run["tabelaOrigem"],
            "ficheiro": run["ficheiro"]}
    if pdf_id:
        args["pdf"] = pdf_id
    importacao_id = cliente.mutation("importacoes:criarImportacao", args)["importacaoId"]
    resumo["importacaoId"] = importacao_id
    log(f"import run {importacao_id} criada ({run['tabelaOrigem']})")

    for i, parte in enumerate(lotes, start=1):
        r = cliente.mutation("importacoes:carregarSkus",
                             {"importacaoId": importacao_id, "skus": [_sku_para_envio(s) for s in parte]})
        resumo["carregados"] += int(r["carregados"])   # a API HTTP devolve números como float
        resumo["erros"].extend(r["erros"])
        log(f"  lote {i}/{len(lotes)}: {int(r['carregados'])} carregados, {len(r['erros'])} rejeitados")
    for e in resumo["erros"]:
        log(f"  ✗ {e['ref']}: {e['erro']}")

    for numero, ficheiro, tipo in ficheiros:
        if tipo == "png":
            sid = cliente.upload(ficheiro.read_bytes(), "image/png")
            cliente.mutation("importacoes:registarPaginaImagem",
                             {"tabelaOrigem": run["tabelaOrigem"], "pagina": numero, "imagem": sid})
        else:
            sid = cliente.upload(ficheiro.read_bytes(), "application/pdf")
            cliente.mutation("importData:registarPagina",
                             {"tabelaOrigem": run["tabelaOrigem"], "pagina": numero, "ficheiro": sid})
    if ficheiros:
        log(f"{len(ficheiros)} ficheiros de páginas registados")

    if resumo["erros"]:
        log(f"\n{len(resumo['erros'])} SKUs rejeitados — a run fica em 'a-extrair'. Corrige e volta a enviar "
            "(a nova extração substitui esta run).")
        return resumo
    contagens = {k: int(v) for k, v in cliente.mutation(
        "importacoes:concluirCarregamento", {"importacaoId": importacao_id}).items()}
    resumo["contagens"] = contagens
    log(f"run em revisão: {contagens['numSkus']} SKUs, {contagens['numGrupos']} grupos, "
        f"{contagens['numNovos']} novos, {contagens['numAlterados']} alterados, {contagens['numIguais']} iguais, "
        f"{contagens['numComAvisos']} com avisos → /importacoes/{importacao_id}")
    return resumo


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("staged", type=Path)
    ap.add_argument("--pdf", type=Path, help="tabela de preços completa (guardada na run)")
    ap.add_argument("--paginas", type=Path, help="pasta com <tabelaOrigem>-p<N>.png/.pdf (paginas.py)")
    ap.add_argument("--lote", type=int, default=LOTE)
    ap.add_argument("--forcar", action="store_true", help="envia mesmo com avisos 'erro:'")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    run = ler_json(args.staged)
    url, secret = ler_env(raiz_repo(args.staged.parent))
    cliente = Convex(url, secret)
    paginas = args.paginas if args.paginas else args.staged.with_name("paginas")
    try:
        resumo = enviar(run, cliente, args.pdf, paginas if paginas.is_dir() else None,
                        lote=args.lote, forcar=args.forcar, dry_run=args.dry_run)
    except RuntimeError as e:
        print(f"✗ {e}", file=sys.stderr)
        sys.exit(1)
    sys.exit(1 if resumo["erros"] else 0)


if __name__ == "__main__":
    main()
