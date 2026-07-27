#!/usr/bin/env python3
"""Verificação final, produto a produto, antes de importar.

Três passagens sobre o CSV:
  1. Schema — reaproveita `validate()` do review.py (colunas, enums, atributos,
     coerência de grupo).
  2. Valores em falta — para cada SKU sem os specs esperados (ou sem preço),
     volta à(s) página(s) do PDF, encontra a linha da ref e propõe o valor.
     `--apply` escreve só as sugestões de confiança alta.
  3. Fotos — cruza com mapping.json: que grupos (excluindo acessórios) ficam
     sem imagem, e o que fazer a seguir (crawl da marca / fallback do PDF).

Uso:
    python3 verify.py produtos.csv [--pdf tabela.pdf] [--apply]
                      [--mapping product-scaffold/mapping.json]

Escreve `verificacao.json` + `verificacao.md` ao lado do CSV.
"""

import argparse
import csv
import importlib.util
import json
import re
import sys
from collections import OrderedDict, defaultdict
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

HERE = Path(__file__).resolve().parent


def load_review_module():
    spec = importlib.util.spec_from_file_location("review", HERE / "review.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


R = load_review_module()

# Specs que cada tipo de produto tem de trazer do PDF.
EXPECTED_ATTRS = {
    ("ar-condicionado", "conjunto"): ["frio-kw", "calor-kw", "classe-energetica"],
    ("ar-condicionado", "unidade-interior"): ["frio-kw", "calor-kw"],
    ("ar-condicionado", "unidade-exterior"): ["frio-kw"],
    ("bombas-de-calor", "conjunto"): ["calor-kw", "classe-energetica"],
    ("bombas-de-calor", "unidade-exterior"): ["calor-kw"],
    ("bombas-de-calor", "unidade-interior"): ["calor-kw"],
    ("aqs", "conjunto"): ["capacidade"],
    ("aqs", "deposito"): ["capacidade"],
    ("ventiloconvectores", "unidade-interior"): ["frio-kw", "calor-kw"],
    ("chillers", "conjunto"): ["frio-kw"],
}
# Acessórios e comandos não têm specs térmicos.
NO_SPECS = {"acessorio", "comando"}

PRICE_RE = re.compile(r"(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€")
KW_RE = re.compile(r"\b(\d{1,2},\d{1,2})\b")
KW_PAIR_RE = re.compile(r"\b(\d{1,2},\d)\s*/\s*(\d{1,2},\d)\b")
CLASS_RE = re.compile(r"\b(A\+{1,3}|[A-G])\b")
CLASS_PAIR_RE = re.compile(r"\b(A\+{0,3}|[B-G])\s*/\s*(A\+{0,3}|[B-G])\b")


def parse_pages(value):
    out = []
    for part in (value or "").replace(";", ",").split(","):
        part = part.strip()
        if part.isdigit():
            out.append(int(part))
    return sorted(set(out))


def page_lines(page):
    """Linhas de texto reconstruídas (as tabelas de preços são multi-coluna)."""
    buckets = defaultdict(list)
    for w in sorted(page.get_text("words"), key=lambda t: (round(t[1] / 3), t[0])):
        buckets[round(w[1] / 3)].append(w[4])
    return [" ".join(v) for _, v in sorted(buckets.items())]


def pdf_index(doc, pages):
    idx = {}
    for pno in pages:
        if 1 <= pno <= len(doc):
            idx[pno] = page_lines(doc[pno - 1])
    return idx


def find_ref_lines(idx, ref):
    """[(pagina, linha)] — todas as linhas onde a ref está impressa."""
    needle = ref.upper()
    out = []
    for pno, lines in sorted(idx.items()):
        for line in lines:
            up = line.upper()
            if needle in up or needle in up.replace(" ", ""):
                out.append((pno, line))
    return out


def suggest_from_line(key, line, row):
    """(valor, confiança, nota) para uma chave em falta, lida da linha do PDF."""
    if key == "classe-energetica":
        pair = CLASS_PAIR_RE.search(line)
        if pair:
            return f"{pair.group(1)}/{pair.group(2)}", "alta", "par frio/calor na linha"
        classes = CLASS_RE.findall(line)
        if len(classes) == 2:
            return f"{classes[0]}/{classes[1]}", "media", "duas classes na linha"
        if len(classes) == 1:
            return f"{classes[0]}/-", "baixa", "só uma classe na linha"
        return None, None, "sem classe energética na linha"

    if key in ("frio-kw", "calor-kw"):
        # "2,0/ 2,5" = frio/calor em kW; "8,75/ 5,15" (2 casas) = SEER/SCOP.
        pairs = KW_PAIR_RE.findall(line)
        if pairs:
            frio, calor = pairs[0]
            val = (frio if key == "frio-kw" else calor).replace(",", ".")
            conf = "alta" if len(pairs) == 1 else "media"
            return val, conf, f"par kW frio/calor: {frio}/{calor}"
        nums = [n.replace(",", ".") for n in KW_RE.findall(line)]
        # Descarta números que já são o preço ou o SEER/SCOP da mesma linha.
        nums = [n for n in nums if 0.5 <= float(n) <= 60]
        if len(nums) >= 2:
            val = nums[0] if key == "frio-kw" else nums[1]
            return val, "media", f"pares kW na linha: {nums[:4]}"
        if len(nums) == 1:
            return nums[0], "baixa", "um único valor kW na linha"
        return None, None, "sem valores kW na linha"

    if key == "capacidade":
        m = re.search(r"\b(\d{2,4})\s*(?:L|litros)\b", line, re.I)
        if m:
            return m.group(1), "alta", "litros na linha"
        return None, None, "sem litros na linha"

    if key == "pvpCents":
        prices = PRICE_RE.findall(line)
        if len(prices) == 1:
            cents = int(prices[0].replace(".", "").replace(",", "")) if "," in prices[0] \
                else int(prices[0].replace(".", "")) * 100
            return str(cents), "alta", "preço único na linha"
        if len(prices) > 1:
            return None, None, f"{len(prices)} preços na linha (ambíguo): {prices}"
        return None, None, "sem preço na linha"

    return None, None, "chave sem regra de leitura"


def align_names(groups):
    """Preencher frio-kw/btu pode tornar um grupo variável por capacidade — e aí
    cada `nome` de variante tem de trazer o sufixo (o título da página usa só
    `nomeGrupo`). Devolve o número de nomes ajustados."""
    changed = 0
    for members in groups.values():
        chaves_var, _ = R.split_keys(members)
        if not any(k in ("frio-kw", "btu") for k in chaves_var):
            continue
        for row in members:
            nome = (row.get("nome") or "").strip()
            nome_grupo = (row.get("nomeGrupo") or "").strip()
            if not nome_grupo or nome != nome_grupo:
                continue
            attrs = dict(R.attr_pairs(row.get("atributos")))
            if attrs.get("frio-kw"):
                sufixo = f"{attrs['frio-kw']} kW"
            elif attrs.get("btu"):
                sufixo = f"{attrs['btu']} BTU"
            else:
                continue
            row["nome"] = f"{nome_grupo} {sufixo}"
            changed += 1
    return changed


def expected_keys(row):
    if row.get("componente") in NO_SPECS or row.get("familia") == "acessorios-e-controlo":
        return []
    key = (row.get("familia", ""), row.get("componente", ""))
    if key in EXPECTED_ATTRS:
        return EXPECTED_ATTRS[key]
    # Sem regra específica: exige o que o resto do grupo já traz.
    return []


def sibling_values(groups):
    """(grupo, tamanho, chave) → valor, quando todos os irmãos concordam.

    Variantes de cor da mesma série partilham hardware: FTXA20CS não traz kW no
    PDF mas FTXA20CW/DG (tamanho=20) trazem, e o valor é o mesmo.
    """
    seen = defaultdict(set)
    for grupo, members in groups.items():
        for row in members:
            attrs = dict(R.attr_pairs(row.get("atributos")))
            tamanho = attrs.get("tamanho")
            if not tamanho:
                continue
            for key, val in attrs.items():
                if val:
                    seen[(grupo, tamanho, key)].add(val)
    return {k: next(iter(v)) for k, v in seen.items() if len(v) == 1}


def load_mapping(path):
    if not path or not Path(path).is_file():
        return {}
    return {e["slug"]: e for e in json.loads(Path(path).read_text(encoding="utf-8"))}


def photo_source(entry):
    if not entry:
        return "sem-entrada"
    if entry.get("manual"):
        return "manual"
    if not entry.get("files"):
        return "sem-fotos"
    return "pdf" if entry.get("fonte") == "pdf" else "crawl"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path")
    ap.add_argument("--pdf", default=None)
    ap.add_argument("--mapping", default=None)
    ap.add_argument("--apply", action="store_true",
                    help="escreve no CSV as sugestões de confiança alta")
    ap.add_argument("--max-report", type=int, default=400,
                    help="máximo de produtos listados no markdown")
    args = ap.parse_args()

    csv_path = Path(args.csv_path)
    repo_root = R.find_repo_root(csv_path)
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        header = list(reader.fieldnames or [])
        rows = [{k: (v or "") for k, v in r.items() if k is not None} for r in reader]

    # ---- 1. schema ---------------------------------------------------------
    glob, per_group, per_ref, groups = R.validate(rows, header)

    # ---- 2. valores em falta, relidos do PDF -------------------------------
    pdf_path = R.find_source_pdf(csv_path, args.pdf)
    doc = fitz.open(pdf_path) if (pdf_path and fitz) else None
    if doc is None:
        print("⚠ Sem PDF/PyMuPDF — passo 2 (releitura) desativado", file=sys.stderr)

    group_pages = {g: sorted({p for r in members for p in parse_pages(r.get("pdfPaginas"))})
                   for g, members in groups.items()}
    full_index = None      # índice de todo o PDF, construído só se preciso
    sugestoes = []
    sem_evidencia = []
    faltas = defaultdict(list)  # ref → chaves em falta
    for row in rows:
        ref = row.get("ref") or "(sem ref)"
        attrs = dict(R.attr_pairs(row.get("atributos")))
        missing = [k for k in expected_keys(row) if not attrs.get(k)]
        if not (row.get("pvpCents") or "").strip().isdigit() or row.get("pvpCents") == "0":
            missing.append("pvpCents")
        if not missing:
            continue
        faltas[ref] = missing
        if doc is None:
            continue
        # A ref pode estar impressa numa página do grupo que não é a sua — a UI
        # avulsa aparece na linha do conjunto, que é quem traz os kW —, por isso
        # as páginas do resto do grupo entram como segunda escolha.
        grupo = row.get("grupoModelo")
        pages = parse_pages(row.get("pdfPaginas"))
        extra = [p for p in group_pages.get(grupo, []) if p not in pages]
        candidatos = (find_ref_lines(pdf_index(doc, pages), ref)
                      + find_ref_lines(pdf_index(doc, extra), ref))
        if not candidatos or not any(KW_PAIR_RE.search(l) for _, l in candidatos):
            # Terceiro nível: o documento inteiro. A UI/UE avulsa costuma ter os
            # kW só na linha do conjunto, que vive noutro grupo (outra página).
            if full_index is None:
                full_index = pdf_index(doc, range(1, len(doc) + 1))
            vistos = {(p, l) for p, l in candidatos}
            candidatos += [c for c in find_ref_lines(full_index, ref) if c not in vistos]
        if not candidatos:
            sem_evidencia.append({"ref": ref, "grupo": grupo, "faltam": missing,
                                  "nota": f"ref não encontrada nas páginas "
                                          f"{row.get('pdfPaginas') or '—'}"})
            continue
        rank = {"alta": 3, "media": 2, "baixa": 1, None: 0}
        for key in missing:
            melhor = None
            for pno, line in candidatos:
                val, conf, nota = suggest_from_line(key, line, row)
                cand = {"ref": ref, "grupo": grupo, "chave": key, "valor": val,
                        "confianca": conf, "pagina": pno, "nota": nota,
                        "linha": line[:220]}
                if melhor is None or rank[conf] > rank[melhor["confianca"]]:
                    melhor = cand
                if conf == "alta":
                    break
            sugestoes.append(melhor)

    # Segunda fonte: irmão do grupo com o mesmo `tamanho` (o PDF não repete os
    # kW nas linhas das variantes de cor).
    irmaos = sibling_values(groups)
    by_ref_row = {r.get("ref"): r for r in rows}
    # Refs que o PDF não imprime nas suas páginas (ex.: clones monofásicos
    # sintetizados) só podem ser preenchidas pelos irmãos.
    for item in sem_evidencia:
        row = by_ref_row.get(item["ref"])
        tamanho = dict(R.attr_pairs(row.get("atributos"))).get("tamanho") if row else None
        if not tamanho:
            continue
        for key in item["faltam"]:
            val = irmaos.get((item["grupo"], tamanho, key))
            if val:
                sugestoes.append({"ref": item["ref"], "grupo": item["grupo"],
                                  "chave": key, "valor": val, "confianca": "alta",
                                  "pagina": None,
                                  "nota": f"irmão do grupo com tamanho={tamanho}",
                                  "linha": ""})
    for s in sugestoes:
        if s["valor"] and s["confianca"] == "alta":
            continue
        row = by_ref_row.get(s["ref"])
        tamanho = dict(R.attr_pairs(row.get("atributos"))).get("tamanho") if row else None
        if not tamanho:
            continue
        val = irmaos.get((s["grupo"], tamanho, s["chave"]))
        if val:
            s["valor"] = val
            s["confianca"] = "alta"
            s["nota"] = f"irmão do grupo com tamanho={tamanho}"

    # Se o resto do grupo já traz a chave, preencher a linha em falta a partir
    # da sua própria linha do PDF é seguro — e evita chaves desalinhadas.
    keys_in_group = defaultdict(set)
    for row in rows:
        for k, v in R.attr_pairs(row.get("atributos")):
            if v:
                keys_in_group[row.get("grupoModelo")].add(k)
    for s in sugestoes:
        if s["confianca"] == "media" and s["chave"] in keys_in_group.get(s["grupo"], ()):
            s["confianca"] = "alta"
            s["nota"] += " · chave já presente no grupo"

    aplicadas = 0
    if args.apply:
        by_ref = {r["ref"]: r for r in rows}
        for s in sugestoes:
            if s["confianca"] != "alta" or not s["valor"]:
                continue
            row = by_ref.get(s["ref"])
            if row is None:
                continue
            if s["chave"] == "pvpCents":
                row["pvpCents"] = s["valor"]
            else:
                attrs = OrderedDict(R.attr_pairs(row.get("atributos")))
                if attrs.get(s["chave"]):
                    continue
                attrs[s["chave"]] = s["valor"]
                row["atributos"] = ";".join(f"{k}={v}" for k, v in attrs.items())
            aplicadas += 1

        # Coerência dentro do grupo: variantes do mesmo tamanho partilham
        # hardware, logo partilham potências e classe. Sem este passo, escrever
        # valores do PDF só nas linhas onde ele os imprime parte a igualdade de
        # chaves de atributos dentro do grupo.
        propagadas = 0
        irmaos_pos = sibling_values(groups)
        for grupo, members in groups.items():
            for row in members:
                attrs = OrderedDict(R.attr_pairs(row.get("atributos")))
                tamanho = attrs.get("tamanho")
                if not tamanho:
                    continue
                for chave in ("frio-kw", "calor-kw", "classe-energetica",
                              "seer", "scop"):
                    if attrs.get(chave):
                        continue
                    val = irmaos_pos.get((grupo, tamanho, chave))
                    if val:
                        attrs[chave] = val
                        propagadas += 1
                row["atributos"] = ";".join(f"{k}={v}" for k, v in attrs.items())

        nomes = align_names(groups) if (aplicadas or propagadas) else 0
        if aplicadas or propagadas:
            print(f"  {aplicadas} valores escritos ({propagadas} propagados a "
                  f"irmãos do mesmo tamanho), {nomes} nomes de variante ajustados")
            with open(csv_path, "w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=header, quoting=csv.QUOTE_ALL,
                                   lineterminator="\r\n")
                w.writeheader()
                w.writerows(rows)

    # ---- 3. fotos ----------------------------------------------------------
    mapping_path = args.mapping or (repo_root / "product-scaffold/mapping.json")
    mapping = load_mapping(mapping_path)
    if not mapping:
        print(f"⚠ Sem mapping.json em {mapping_path} — passo 3 (fotos) sem dados",
              file=sys.stderr)
    fotos = {}
    for grupo, members in groups.items():
        r0 = members[0]
        acessorio = (r0.get("familia") == "acessorios-e-controlo"
                     or r0.get("componente") in NO_SPECS)
        entry = mapping.get(grupo)
        fotos[grupo] = {
            "marca": r0.get("marca"),
            "nome": r0.get("nomeGrupo"),
            "componente": r0.get("componente"),
            "acessorio": acessorio,
            "fonte": photo_source(entry),
            "n": len(entry.get("files", [])) if entry else 0,
            "paginas": r0.get("pdfPaginas"),
        }
    sem_foto = {g: i for g, i in fotos.items()
                if not i["acessorio"] and i["fonte"] in ("sem-fotos", "sem-entrada")}
    so_pdf = {g: i for g, i in fotos.items() if i["fonte"] == "pdf"}

    # ---- relatórios --------------------------------------------------------
    report = {
        "csv": str(csv_path),
        "pdf": str(pdf_path) if pdf_path else None,
        "totais": {
            "skus": len(rows),
            "grupos": len(groups),
            "avisosGlobais": len(glob),
            "gruposComAviso": len(per_group),
            "refsComAviso": len(per_ref),
            "skusComFaltas": len(faltas),
            "sugestoes": len(sugestoes),
            "sugestoesAplicadas": aplicadas,
            "gruposSemFoto": len(sem_foto),
            "gruposSoComFotoDoPdf": len(so_pdf),
        },
        "avisosGlobais": glob,
        "avisosPorGrupo": per_group,
        "avisosPorRef": per_ref,
        "faltas": {k: v for k, v in faltas.items()},
        "sugestoes": sugestoes,
        "semEvidencia": sem_evidencia,
        "fotos": fotos,
    }
    (csv_path.parent / "verificacao.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    lines = ["# Verificação final", "",
             f"CSV: `{csv_path.name}` · {len(rows)} SKUs · {len(groups)} grupos",
             f"PDF: `{pdf_path.name if pdf_path else '—'}`", ""]
    lines += ["## 1. Schema", ""]
    if not glob and not per_group and not per_ref:
        lines.append("Sem avisos.")
    else:
        for msg in glob:
            lines.append(f"- **global**: {msg}")
        for grupo, msgs in list(per_group.items())[: args.max_report]:
            for m in msgs:
                lines.append(f"- `{grupo}`: {m}")
        for ref, msgs in list(per_ref.items())[: args.max_report]:
            for m in msgs:
                lines.append(f"- `{ref}`: {m}")
    lines += ["", "## 2. Valores em falta (releitura do PDF)", ""]
    if not faltas:
        lines.append("Nenhum SKU com specs obrigatórios em falta.")
    else:
        lines.append(f"{len(faltas)} SKUs com campos em falta; "
                     f"{len(sugestoes)} sugestões"
                     + (f", {aplicadas} aplicadas" if args.apply else "") + ".")
        lines.append("")
        lines.append("| ref | chave | sugestão | confiança | pág | linha do PDF |")
        lines.append("| --- | --- | --- | --- | --- | --- |")
        for s in sugestoes[: args.max_report]:
            linha = s["linha"].replace("|", "¦")
            lines.append(f"| `{s['ref']}` | {s['chave']} | {s['valor'] or '—'} | "
                         f"{s['confianca'] or '—'} | {s['pagina']} | {linha} |")
        for s in sem_evidencia[: args.max_report]:
            lines.append(f"| `{s['ref']}` | {', '.join(s['faltam'])} | — | — | — | "
                         f"{s['nota']} |")
    lines += ["", "## 3. Fotos", ""]
    lines.append(f"{len(sem_foto)} grupos não-acessório sem foto; "
                 f"{len(so_pdf)} apenas com foto extraída do PDF.")
    if sem_foto:
        lines += ["", "| grupo | marca | nome | páginas PDF |", "| --- | --- | --- | --- |"]
        for grupo, i in list(sem_foto.items())[: args.max_report]:
            lines.append(f"| `{grupo}` | {i['marca']} | {i['nome']} | {i['paginas']} |")
    (csv_path.parent / "verificacao.md").write_text("\n".join(lines) + "\n",
                                                    encoding="utf-8")

    t = report["totais"]
    print(f"Schema: {t['avisosGlobais']} globais, {t['gruposComAviso']} grupos, "
          f"{t['refsComAviso']} refs com aviso")
    print(f"Faltas: {t['skusComFaltas']} SKUs · {t['sugestoes']} sugestões"
          + (f" · {aplicadas} aplicadas" if args.apply else ""))
    print(f"Fotos: {t['gruposSemFoto']} grupos sem foto, "
          f"{t['gruposSoComFotoDoPdf']} só com foto do PDF")
    print(f"Relatórios: {csv_path.parent / 'verificacao.md'} (+ .json)")
    if sem_foto:
        print("Para os grupos sem foto: crawl da marca → "
              "pdf_images.py --only <grupo> --loose → manual/<grupo>/")


if __name__ == "__main__":
    main()
