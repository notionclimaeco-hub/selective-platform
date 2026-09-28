#!/usr/bin/env python3
"""4. Validar: registo de specs + coerência → `avisos` em cada SKU (nunca bloqueia).

    python3 validar.py hisense-2026-staged.json [--registo product-scaffold/spec-registry.json] [--csv]

Reescreve o JSON com os avisos e imprime o resumo. Avisos prefixados por
`erro:` são o que o Convex rejeitaria (`carregarSkus`): tipo errado, enum,
padrão, chave duplicada, taxonomia inválida — corrigir antes de enviar. Os
restantes avisos obrigam a abrir o grupo na página de revisão: chave
desconhecida, obrigatória em falta, refs duplicadas, variantes
indistinguíveis, séries partidas, convenção de nomes, preço em falta.
`--csv` escreve o export opcional CSV v3 ao lado do JSON.
"""

from __future__ import annotations

import argparse
import csv
import re
from collections import Counter, defaultdict
from pathlib import Path

from _comum import carregar_registo, escrever_json, esqueleto, ler_json

FAMILIAS = {"ar-condicionado", "bombas-de-calor", "aqs", "ventilacao", "chillers", "ventiloconvectores",
            "cortinas-de-ar", "purificadores-de-ar", "acessorios-e-controlo", "outros"}
SISTEMAS = {"mono-split", "multi-split", "vrf", "rooftop", "monobloco", "bibloco"}
COMPONENTES = {"conjunto", "unidade-interior", "unidade-exterior", "deposito", "acessorio", "comando"}
SEGMENTOS = {"domestico", "comercial", "industrial"}
OBRIGATORIOS = ("ref", "nome", "nomeGrupo", "marca", "familia", "componente", "atributos", "pvpCents",
                "ivaIncluido", "tabelaOrigem", "grupoModelo", "pdfPaginas", "avisos")
COERENTES = ("nomeGrupo", "marca", "familia", "segmento", "sistema", "tipoUnidade", "gama", "componente")
CAPACIDADE_NO_NOME = re.compile(r"(?i)(?:\b\d+(?:[.,]\d+)?\s*kW\b|\b\d{4,5}\s*BTU\b|\b\d+\s*L\b)")
COR_NO_NOME = re.compile(r"(?i)\b(?:branco(?:-perola)?|preto|prateado|prata|vermelho|cinzento|inox|"
                         r"champagne|grafite|ouro)\b")
SUFIXO_CAPACIDADE = re.compile(r"(?i)\s(?:\d+(?:[.,]\d+)?\s*(?:kW|CV|m³/h|m3/h)|\d{4,5}\s*BTU|\d+\s*L)"
                               r"(?:\s*\([^)]*\))?(?:\s+(?:mono|tri)fásico)?\s*$")
EIXOS_CAPACIDADE = ("frio-kw", "btu", "deposito-l", "caudal-m3h", "cv")
COLUNAS_CSV = ["ref", "ean", "nome", "nomeGrupo", "marca", "familia", "segmento", "sistema", "tipoUnidade",
               "componente", "gama", "atributos", "descricao", "pvpCents", "ivaIncluido", "tabelaOrigem",
               "grupoModelo", "pdfPaginas"]


# --- Registry (port of validarAtributos) --------------------------------------

def validar_valor(registo: dict, chave: dict, valor: str) -> str | None:
    tipo = chave["tipo"]
    nome = chave["chave"]
    if tipo == "numero":
        if not re.fullmatch(registo.get("padraoNumero", r"^\d+(\.\d+)?$").strip("^$"), valor):
            return f'{nome}: "{valor}" não é um número (ponto decimal, sem unidade)'
    elif tipo == "enum":
        valores = chave.get("valores") or []
        if valor not in valores:
            return f'{nome}: "{valor}" não é um valor válido ({", ".join(valores)})'
    elif tipo == "booleano":
        if valor not in registo.get("booleano", ["sim", "nao"]):
            return f'{nome}: "{valor}" não é booleano (sim, nao)'
    elif tipo == "texto":
        padrao = chave.get("padrao")
        if padrao and not re.fullmatch(padrao.strip("^$"), valor):
            return f'{nome}: "{valor}" não segue o formato esperado ({padrao})'
    return None


def validar_atributos(registo: dict, familia: str, componente: str, atributos: list[dict]) -> tuple[list[str], list[str]]:
    erros: list[str] = []
    avisos: list[str] = []
    cat = (registo.get("categorias") or {}).get(familia)
    if cat is None:
        return [f'familia "{familia}" desconhecida no registo'], avisos
    defs = {c["chave"]: c for c in cat["chaves"]}
    vistas: set[str] = set()
    for a in atributos:
        k, valor = a["chave"], a["valor"]
        if k in vistas:
            erros.append(f"{k}: chave duplicada")
            continue
        vistas.add(k)
        d = defs.get(k)
        if d is None:
            avisos.append(f"{k}: chave desconhecida para {familia}")
            continue
        comps = d.get("componentes")
        if comps and componente not in comps:
            avisos.append(f"{k}: não se aplica a {componente} (só {', '.join(comps)})")
        erro = validar_valor(registo, d, valor)
        if erro:
            erros.append(erro)
    for d in cat["chaves"]:
        if componente in (d.get("obrigatorio") or []) and d["chave"] not in vistas:
            avisos.append(f"{d['chave']}: obrigatório em {familia}/{componente} e está em falta")
    return erros, avisos


# --- Run checks ---------------------------------------------------------------

def _attrs(sku: dict) -> dict[str, str]:
    return {a["chave"]: a["valor"] for a in sku.get("atributos") or []}


def validar_run(run: dict, registo: dict) -> dict:
    skus = run["skus"]
    novos: dict[int, list[str]] = defaultdict(list)

    def erro(i: int, msg: str) -> None:
        novos[i].append(f"erro: {msg}")

    def aviso(i: int, msg: str) -> None:
        novos[i].append(msg)

    # per SKU
    refs = Counter(s.get("ref") for s in skus)
    for i, s in enumerate(skus):
        for campo in OBRIGATORIOS:
            if campo not in s or s[campo] in (None, ""):
                erro(i, f"campo obrigatório em falta: {campo}")
        if s.get("familia") not in FAMILIAS:
            erro(i, f"familia inválida: {s.get('familia')!r}")
        if s.get("sistema") not in (None, "") and s["sistema"] not in SISTEMAS:
            erro(i, f"sistema inválido: {s['sistema']!r}")
        if s.get("componente") not in COMPONENTES:
            erro(i, f"componente inválido: {s.get('componente')!r}")
        if s.get("segmento") not in (None, "") and s["segmento"] not in SEGMENTOS:
            erro(i, f"segmento inválido: {s['segmento']!r}")
        marca = s.get("marca") or ""
        if marca != marca.lower() or " " in marca:
            aviso(i, f"marca não é slug minúsculo: {marca!r}")
        pvp = s.get("pvpCents")
        if not isinstance(pvp, int) or pvp < 0:
            erro(i, f"pvpCents não é inteiro não negativo: {pvp!r}")
        elif pvp == 0 and not any("preço" in a or "matriz" in a for a in s.get("avisos", [])):
            aviso(i, "preço em falta (pvpCents = 0)")
        pags = s.get("pdfPaginas") or []
        if not pags or any(not isinstance(p, int) or p <= 0 for p in pags):
            erro(i, f"pdfPaginas inválido: {pags!r}")
        if refs[s.get("ref")] > 1:
            aviso(i, f"ref duplicada ×{refs[s['ref']]} na extração: {s['ref']}")
        if s.get("familia") in FAMILIAS and s.get("componente") in COMPONENTES:
            erros, avisos = validar_atributos(registo, s["familia"], s["componente"], s.get("atributos") or [])
            for e in erros:
                erro(i, e)
            for a in avisos:
                aviso(i, a)
        nome_grupo = s.get("nomeGrupo") or ""
        nome = s.get("nome") or ""
        if CAPACIDADE_NO_NOME.search(nome_grupo) and s.get("familia") != "acessorios-e-controlo":
            aviso(i, f"nomeGrupo contém capacidade (kW/BTU/L) — mover para o nome da variante: {nome_grupo!r}")
        if COR_NO_NOME.search(nome_grupo):
            aviso(i, f"nomeGrupo contém cor — usar atributo cor=: {nome_grupo!r}")
        if COR_NO_NOME.search(nome):
            aviso(i, f"nome contém cor — usar atributo cor=: {nome!r}")
        if "—" in nome_grupo or "–" in nome_grupo:
            aviso(i, "nomeGrupo usa travessão — separar com ' | '")

    # per group
    grupos: dict[str, list[int]] = defaultdict(list)
    for i, s in enumerate(skus):
        grupos[s.get("grupoModelo") or "(sem grupoModelo)"].append(i)
    for grupo, idx in grupos.items():
        membros = [skus[i] for i in idx]
        for campo in COERENTES:
            vals = {(m.get(campo) or "") for m in membros}
            if len(vals) > 1:
                for i in idx:
                    aviso(i, f"'{campo}' inconsistente no grupo {grupo}: {sorted(vals)}")
        if len(membros) > 1:
            combos = Counter(tuple(sorted(_attrs(m).items())) for m in membros)
            for i in idx:
                combo = tuple(sorted(_attrs(skus[i]).items()))
                if combos[combo] > 1:
                    rotulo = ";".join(f"{k}={v}" for k, v in combo) or "(sem atributos)"
                    aviso(i, f"{combos[combo]} SKUs do grupo com os mesmos atributos ({rotulo}) — falta um eixo que os distinga")
            chaves_variaveis = {k for k in {k for m in membros for k in _attrs(m)}
                                if len({_attrs(m).get(k) for m in membros}) > 1}
            if any(k in EIXOS_CAPACIDADE for k in chaves_variaveis):
                for i in idx:
                    nome = skus[i].get("nome") or ""
                    if not SUFIXO_CAPACIDADE.search(nome):
                        aviso(i, f"grupo varia por capacidade mas o nome está sem sufixo (kW/BTU/L): {nome!r}")

    # broken series: singles that share skeleton + nomeGrupo + familia + componente
    singles: dict[tuple, list[str]] = defaultdict(list)
    for grupo, idx in grupos.items():
        if len(idx) == 1:
            s = skus[idx[0]]
            singles[(s.get("familia"), s.get("componente"), s.get("nomeGrupo"), esqueleto(s.get("ref") or ""))].append(grupo)
    for (familia, componente, nome_grupo, sk), gs in singles.items():
        if len(gs) > 1 and sk:
            for g in gs:
                for i in grupos[g]:
                    aviso(i, f"provável série partida em {len(gs)} grupos de 1 (esqueleto {sk}, {nome_grupo!r}): "
                             f"{', '.join(gs)}")

    # write back
    tipos = Counter()
    for i, s in enumerate(skus):
        existentes = list(s.get("avisos") or [])
        for a in novos.get(i, []):
            if a not in existentes:
                existentes.append(a)
        s["avisos"] = existentes
        for a in existentes:
            chave = (re.split(r"[:(]", a, maxsplit=1)[0].strip() if not a.startswith("erro:")
                     else "erro: " + re.split(r"[:(]", a[6:], maxsplit=1)[0].strip())
            tipos[chave[:70]] += 1
    return {
        "skus": len(skus), "grupos": len(grupos),
        "comErro": sum(1 for s in skus if any(a.startswith("erro:") for a in s["avisos"])),
        "comAviso": sum(1 for s in skus if s["avisos"]),
        "avisosPorTipo": dict(tipos.most_common()),
    }


# --- CSV v3 export ------------------------------------------------------------

def exportar_csv(run: dict, caminho: Path | str) -> None:
    with Path(caminho).open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUNAS_CSV, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
        w.writeheader()
        for s in run["skus"]:
            w.writerow({
                "ref": s.get("ref", ""), "ean": s.get("ean", "") or "", "nome": s.get("nome", ""),
                "nomeGrupo": s.get("nomeGrupo", ""), "marca": s.get("marca", ""), "familia": s.get("familia", ""),
                "segmento": s.get("segmento", "") or "", "sistema": s.get("sistema", "") or "",
                "tipoUnidade": s.get("tipoUnidade", "") or "", "componente": s.get("componente", ""),
                "gama": s.get("gama", "") or "",
                "atributos": ";".join(f"{a['chave']}={a['valor']}" for a in s.get("atributos") or []),
                "descricao": s.get("descricao", "") or "", "pvpCents": s.get("pvpCents", ""),
                "ivaIncluido": "1" if s.get("ivaIncluido") else "0", "tabelaOrigem": s.get("tabelaOrigem", ""),
                "grupoModelo": s.get("grupoModelo", ""),
                "pdfPaginas": ",".join(str(p) for p in s.get("pdfPaginas") or []),
            })


# --- CLI ----------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("staged", type=Path)
    ap.add_argument("--registo", type=Path, help="spec-registry.json (default: product-scaffold/spec-registry.json)")
    ap.add_argument("--csv", action="store_true", help="escreve também o CSV v3 ao lado do JSON")
    ap.add_argument("--listar", type=int, default=25, help="quantos SKUs com erro/aviso listar")
    args = ap.parse_args()

    run = ler_json(args.staged)
    registo = carregar_registo(args.registo)
    resumo = validar_run(run, registo)
    escrever_json(args.staged, run)
    if args.csv:
        csv_path = args.staged.with_name(f"{run['marca']}-{run['ano']}-produtos.csv")
        exportar_csv(run, csv_path)
        print(f"CSV v3 → {csv_path}")

    print(f"{resumo['skus']} SKUs · {resumo['grupos']} grupos · {resumo['comErro']} com erro · "
          f"{resumo['comAviso']} com avisos → {args.staged}")
    for tipo, n in resumo["avisosPorTipo"].items():
        print(f"  {n:4}  {tipo}")
    com_erro = [s for s in run["skus"] if any(a.startswith("erro:") for a in s["avisos"])]
    if com_erro:
        print(f"\nErros a corrigir antes de enviar ({len(com_erro)} SKUs):")
        for s in com_erro[: args.listar]:
            for a in s["avisos"]:
                if a.startswith("erro:"):
                    print(f"  {s['ref']:28} {a}")


if __name__ == "__main__":
    main()
