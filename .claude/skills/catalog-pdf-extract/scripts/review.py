#!/usr/bin/env python3
"""Gera uma página HTML de revisão (estilo portal admin) a partir de um CSV
de produtos schema v3, com validações automáticas.

Uso:
    python3 review.py produtos.csv [-o review.html]

Saída: HTML self-contained (sem dependências) + resumo/avisos no stdout.
Exit code: 0 sempre (os avisos são para revisão humana, não bloqueiam).

Apresentação (espelha o site): dentro de cada grupoModelo, as chaves de
`atributos` cujos valores variam entre linhas viram colunas da tabela;
as chaves constantes viram chips de specs no cabeçalho do grupo.
"""

import argparse
import csv
import hashlib
import html
import json
import re
import sys
from collections import Counter, OrderedDict
from pathlib import Path

COLUMNS = [
    "ref", "ean", "nome", "nomeGrupo", "marca", "familia", "segmento",
    "sistema", "tipoUnidade", "componente", "gama", "atributos",
    "descricao", "pvpCents", "ivaIncluido", "tabelaOrigem", "grupoModelo",
    "pdfPaginas",
]

REQUIRED = ["ref", "nome", "nomeGrupo", "marca", "familia", "componente",
            "pvpCents", "ivaIncluido", "tabelaOrigem", "grupoModelo"]

ENUMS = {
    "familia": {"ar-condicionado", "bombas-de-calor", "aqs", "ventilacao",
                "chillers", "ventiloconvectores", "cortinas-de-ar",
                "purificadores-de-ar", "acessorios-e-controlo", "outros"},
    "sistema": {"mono-split", "multi-split", "vrf", "rooftop", "monobloco",
                "bibloco"},
    "componente": {"conjunto", "unidade-interior", "unidade-exterior",
                   "deposito", "acessorio", "comando"},
    "segmento": {"domestico", "comercial", "industrial"},
}

# Chaves de atributos cujo valor tem de ser numérico (ponto decimal).
NUMERIC_ATTR_KEYS = {"frio-kw", "calor-kw", "btu", "seer", "scop",
                     "capacidade", "unidades-max"}
# Valores permitidos para chaves de vocabulário fechado.
ATTR_ENUMS = {
    "wifi": {"sim", "opcional", "nao"},
    "cor": {"branco", "branco-perola", "preto", "prateado", "vermelho",
            "cinzento", "inox"},
}
# classe-energetica = frio/calor (SEER/SCOP). `-` = lado em falta no PDF.
CLASSE_ENERGETICA_RE = re.compile(
    r"^(A\+{0,3}|B|C|D|E|F|G|-)/(A\+{0,3}|B|C|D|E|F|G|-)$"
)
LEGACY_CLASSE_KEYS = {"classe-frio", "classe-calor"}

# Campos que têm de ser iguais em todas as linhas de um grupoModelo.
GROUP_COHERENT = ["nomeGrupo", "marca", "familia", "segmento", "sistema",
                  "tipoUnidade", "gama", "componente"]

# Eixos de variante: o que distingue uma linha da outra dentro do grupo e por
# isso tem de existir em todas. As restantes chaves são especificações e podem
# faltar numa linha (a tabela de preços imprime-as uma vez por gama).
AXIS_KEYS = {"cor", "tamanho", "modelo", "alimentacao", "capacidade",
             "deposito", "resistencia-kw", "kit", "voltagem"}

# Capacidade / cor no nomeGrupo quebram a convenção (vão para `nome` da
# variante e para `atributos`, respetivamente). O título da página do site
# usa `nomeGrupo` — estes padrões nunca podem aparecer aí.
CAPACITY_IN_NAME = re.compile(
    r"(?i)(?:\b\d+(?:[.,]\d+)?\s*kW\b|\b\d{4,5}\s*BTU\b|\b\d+\s*L\b)"
)
COLOR_IN_NAME = re.compile(
    r"(?i)\b(?:branco(?:-perola)?|preto|prateado|prata|vermelho|cinzento|"
    r"inox|champagne|grafite|graphite|ouro)\b"
)
# Sufixos de capacidade aceites no `nome` da variante (kW/BTU ou litros AQS).
CAPACITY_SUFFIX = re.compile(
    r"(?i)\s+(?:\d+(?:[.,]\d+)?\s*kW(?:\s*\([^)]*\))?|\d{4,5}\s*BTU|\d+\s*L)\s*$"
)
# Eixos cuja variação obriga sufixo de capacidade no `nome` (calor-kw sozinho
# não conta — ex. Hi-Water distingue-se por `deposito` em litros).
CAPACITY_AXES_FOR_NAME = ("frio-kw", "btu", "capacidade")


def attr_pairs(s):
    """'frio-kw=3.5;cor=branco' -> [('frio-kw','3.5'),('cor','branco')]"""
    pairs = []
    for tok in (s or "").split(";"):
        tok = tok.strip()
        if not tok:
            continue
        k, _, v = tok.partition("=")
        pairs.append((k.strip(), v.strip()))
    return pairs


def attr_keys_ordered(members):
    """Chaves distintas do grupo, pela ordem da primeira ocorrência."""
    seen, order = set(), []
    for r in members:
        for k, _ in attr_pairs(r.get("atributos")):
            if k not in seen:
                seen.add(k)
                order.append(k)
    return order


# Capacity / energy-class keys stay as table columns in the review even when
# constant across the group, so QA can see them next to frio/calor (on the
# live site they still render as spec chips when constant).
REVIEW_ALWAYS_COLUMNS = {"frio-kw", "calor-kw", "classe-energetica"}


def split_keys(members):
    """(chaves_variaveis, atributos_comuns) — igual ao frontend: chave com
    ≥2 valores distintos (ou em falta nalgumas linhas) → coluna; constante →
    chip de spec. Exceção: frio/calor/classe ficam sempre como coluna na review."""
    order = attr_keys_ordered(members)
    if len(members) == 1:
        return [], attr_pairs(members[0].get("atributos"))
    variaveis, comuns = [], []
    for k in order:
        vals = set()
        for r in members:
            d = dict(attr_pairs(r.get("atributos")))
            vals.add(d.get(k))
        if len(vals) > 1 or k in REVIEW_ALWAYS_COLUMNS:
            if k in REVIEW_ALWAYS_COLUMNS and not any(
                k in dict(attr_pairs(r.get("atributos"))) for r in members
            ):
                continue
            variaveis.append(k)
        else:
            v = next(iter(vals))
            if v is not None:
                comuns.append((k, v))
    return variaveis, comuns


def skeleton(ref):
    """Esqueleto da série: sequências de dígitos -> '#'. AUC105UR4RKC8 -> AUC#UR#RKC#"""
    return re.sub(r"\d+", "#", ref.upper())


def fmt_eur(cents):
    try:
        v = int(cents)
    except (TypeError, ValueError):
        return ""
    eur = v // 100
    cent = v % 100
    inteiro = f"{eur:,}".replace(",", ".")
    return f"{inteiro},{cent:02d} €"


def validate(rows, header):
    """Devolve (avisos_globais, avisos_por_grupo, avisos_por_ref, grupos)."""
    glob, per_group, per_ref = [], {}, {}

    def gwarn(grupo, msg):
        per_group.setdefault(grupo, []).append(msg)

    def rwarn(ref, msg):
        per_ref.setdefault(ref, []).append(msg)

    if header != COLUMNS:
        missing = [c for c in COLUMNS if c not in header]
        extra = [c for c in header if c not in COLUMNS]
        if missing:
            glob.append(f"Colunas em falta no CSV: {', '.join(missing)}")
        if extra:
            glob.append(f"Colunas desconhecidas no CSV: {', '.join(extra)}")
        if not missing and not extra:
            glob.append("Ordem das colunas difere do schema v3.")

    seen_refs = Counter(r["ref"] for r in rows if r.get("ref"))
    for ref, n in seen_refs.items():
        if n > 1:
            glob.append(f"ref duplicada ×{n}: {ref}")

    for r in rows:
        ref = r.get("ref") or "(sem ref)"
        for f in REQUIRED:
            if not (r.get(f) or "").strip():
                rwarn(ref, f"campo obrigatório vazio: {f}")
        for f, allowed in ENUMS.items():
            v = (r.get(f) or "").strip()
            if v and v not in allowed:
                rwarn(ref, f"{f} inválido: '{v}'")
        v = (r.get("pvpCents") or "").strip()
        if v and not re.fullmatch(r"\d+", v):
            rwarn(ref, f"pvpCents não é inteiro: '{v}'")
        pp = (r.get("pdfPaginas") or "").strip()
        if pp and not re.fullmatch(r"\d+(\s*,\s*\d+)*", pp):
            rwarn(ref, f"pdfPaginas com formato inválido: '{pp}'")
        m = (r.get("marca") or "").strip()
        if m and (m != m.lower() or " " in m):
            rwarn(ref, f"marca não é slug minúsculo: '{m}'")
        vistos = set()
        for k, val in attr_pairs(r.get("atributos")):
            if not k or not val:
                rwarn(ref, f"atributo com chave/valor vazio: '{k}={val}'")
                continue
            if k in vistos:
                rwarn(ref, f"chave de atributo repetida na linha: '{k}'")
            vistos.add(k)
            if k in NUMERIC_ATTR_KEYS and not re.fullmatch(r"\d+(\.\d+)?", val):
                rwarn(ref, f"atributo '{k}' não é numérico com ponto: '{val}'")
            if k in ATTR_ENUMS and val not in ATTR_ENUMS[k]:
                rwarn(ref, f"atributo '{k}' fora do vocabulário: '{val}'")
            if k in LEGACY_CLASSE_KEYS:
                rwarn(ref, f"atributo legado '{k}' — unificar em "
                      f"classe-energetica=frio/calor (ex.: A+++/A++)")
            if k == "classe-energetica" and not CLASSE_ENERGETICA_RE.fullmatch(val):
                rwarn(ref, f"classe-energetica deve ser frio/calor "
                      f"(ex.: A+++/A++ ou A+++/-): '{val}'")

        # Convenção de nomes: capacidade/cor fora do nomeGrupo.
        nome_grupo = (r.get("nomeGrupo") or "").strip()
        nome = (r.get("nome") or "").strip()
        if nome_grupo and CAPACITY_IN_NAME.search(nome_grupo):
            rwarn(ref, f"nomeGrupo contém capacidade (kW/BTU/L) — mover para "
                  f"`nome` da variante: '{nome_grupo}'")
        if nome_grupo and COLOR_IN_NAME.search(nome_grupo):
            rwarn(ref, f"nomeGrupo contém cor — usar atributo cor=: '{nome_grupo}'")
        if nome and COLOR_IN_NAME.search(nome):
            rwarn(ref, f"nome contém cor — usar atributo cor=: '{nome}'")
        if (nome_grupo and nome and CAPACITY_IN_NAME.search(nome)
                and not nome.startswith(nome_grupo)):
            rwarn(ref, f"nome com capacidade não começa por nomeGrupo "
                  f"('{nome_grupo}' → '{nome}')")
        if "—" in nome_grupo or "–" in nome_grupo or "—" in nome or "–" in nome:
            rwarn(ref, "nome/nomeGrupo usa travessão — substituir por ' | ' "
                  f"(ex.: '… | Unidade Interior'): nomeGrupo='{nome_grupo}'")

    # Coerência intra-grupo
    groups = OrderedDict()
    for r in rows:
        groups.setdefault(r.get("grupoModelo") or "(sem grupoModelo)", []).append(r)

    for grupo, members in groups.items():
        for f in GROUP_COHERENT:
            vals = {(r.get(f) or "").strip() for r in members}
            if len(vals) > 1:
                gwarn(grupo, f"'{f}' inconsistente no grupo: {sorted(vals)}")
        # As linhas do grupo têm de partilhar os *eixos* (o que distingue uma
        # variante da outra). Chaves de especificação podem ser esparsas: a
        # tabela imprime a classe energética ou os kW uma vez por gama, e é o
        # verify.py que enumera essas faltas com a evidência do PDF.
        keysets = {tuple(k for k, _ in attr_pairs(r.get("atributos"))
                         if k in AXIS_KEYS) for r in members}
        if len(keysets) > 1:
            gwarn(grupo, "eixos de variante diferentes entre linhas: "
                  + " | ".join(",".join(ks) or "(vazio)" for ks in sorted(keysets)))
        # Duas linhas com atributos idênticos são indistinguíveis na tabela.
        combos = Counter(tuple(attr_pairs(r.get("atributos"))) for r in members)
        for combo, n in combos.items():
            if n > 1 and len(members) > 1:
                label = ";".join(f"{k}={v}" for k, v in combo) or "(sem atributos)"
                gwarn(grupo, f"{n} linhas com os mesmos atributos: {label} — "
                      "falta um eixo que as distinga")
        if len(members) > 1 and any(not attr_pairs(r.get("atributos")) for r in members):
            gwarn(grupo, "grupo com várias linhas mas há linhas sem atributos — "
                  "a tabela de modelos não as distingue")

        # Se o grupo varia por frio-kw/btu/capacidade, cada `nome` de variante
        # tem de carregar um sufixo (kW/BTU/L) — o título da página usa só
        # nomeGrupo.
        chaves_var, _ = split_keys(members)
        if any(k in CAPACITY_AXES_FOR_NAME for k in chaves_var):
            for r in members:
                nome = (r.get("nome") or "").strip()
                nome_grupo = (r.get("nomeGrupo") or "").strip()
                if nome and nome_grupo and nome == nome_grupo:
                    rwarn(r.get("ref") or "(sem ref)",
                          "grupo varia por capacidade mas `nome` = `nomeGrupo` "
                          "(falta sufixo kW/BTU/L no nome da variante)")
                elif nome and not CAPACITY_IN_NAME.search(nome) and not CAPACITY_SUFFIX.search(nome):
                    rwarn(r.get("ref") or "(sem ref)",
                          f"grupo varia por capacidade mas `nome` sem "
                          f"kW/BTU/L: '{nome}'")

    # Heurística "série partida em grupos de 1": grupos de tamanho 1 cuja ref
    # partilha o esqueleto (dígitos -> #) E o mesmo nomeGrupo, com a mesma
    # marca+família+componente. (UE Hisense AUW* partilham esqueleto entre
    # gamas Turbo/Super e tipos de unidade — sem nomeGrupo igual é falso positivo.)
    singles = {}
    for grupo, members in groups.items():
        if len(members) == 1:
            r = members[0]
            key = (
                (r.get("marca") or "").strip(),
                (r.get("familia") or "").strip(),
                (r.get("componente") or "").strip(),
                (r.get("nomeGrupo") or "").strip(),
                skeleton(r.get("ref") or ""),
            )
            singles.setdefault(key, []).append((grupo, r.get("ref") or ""))
    series_warnings = []
    for (marca, familia, componente, nome_grupo, sk), items in singles.items():
        if len(items) > 1 and sk:
            refs = ", ".join(ref for _, ref in items)
            msg = (
                f"Provável série partida em {len(items)} grupos de 1 "
                f"({marca} · {familia} · {componente} · {nome_grupo!r} · "
                f"esqueleto {sk}): {refs} — agrupar num só grupoModelo com "
                f"um atributo a distingui-las"
            )
            series_warnings.append(msg)
            for grupo, _ in items:
                gwarn(grupo, msg)
    glob.extend(series_warnings)

    return glob, per_group, per_ref, groups


def find_repo_root(start):
    """Repo root = nearest ancestor holding product-scaffold/ (or .git)."""
    p = Path(start).resolve()
    for cand in [p, *p.parents]:
        if (cand / "product-scaffold").is_dir() or (cand / ".git").exists():
            return cand
    return p.parent


_CUTOUT_CACHE = {}


def cutout_for(repo_root, rel_file):
    """rembg cache path for a source image (same hash rule as lib/rembg.mjs)."""
    if rel_file in _CUTOUT_CACHE:
        return _CUTOUT_CACHE[rel_file]
    abs_src = repo_root / rel_file
    cached = None
    if abs_src.is_file():
        digest = hashlib.sha256(abs_src.read_bytes()).hexdigest()[:16]
        candidate = repo_root / "product-scaffold/.rembg-cache" / f"{digest}.png"
        cached = candidate if candidate.is_file() else None
    _CUTOUT_CACHE[rel_file] = cached
    return cached


def load_images(repo_root, marcas, mapping_path=None, choice_path=None):
    """Candidate photos per grupoModelo, from the image pipeline's mapping.json.

    Returns {} when the pipeline hasn't run yet — the page then renders without
    the picker instead of failing.
    """
    _CUTOUT_CACHE.clear()  # rembg may have produced new cutouts since last build
    mapping_file = Path(mapping_path) if mapping_path else repo_root / "product-scaffold/mapping.json"
    if not mapping_file.is_file():
        return {}, None
    choice_file = Path(choice_path) if choice_path else repo_root / "product-scaffold/image-choice.json"
    choices = {}
    if choice_file.is_file():
        try:
            data = json.loads(choice_file.read_text(encoding="utf-8"))
            raw = data.get("choices") if isinstance(data, dict) else None
            if isinstance(raw, dict):
                choices = {k: v for k, v in raw.items()
                           if v in ("cutout", "original", "exclude")}
        except (json.JSONDecodeError, OSError):
            choices = {}

    try:
        mapping = json.loads(mapping_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}, choice_file

    by_group = {}
    for entry in mapping:
        if marcas and entry.get("marca") not in marcas:
            continue
        images = []
        for index, rel in enumerate(entry.get("files") or []):
            if not (repo_root / rel).is_file():
                continue
            cut = cutout_for(repo_root, rel)
            saved = choices.get(rel)
            use = saved if saved else ("cutout" if cut else "original")
            images.append({
                "file": rel,
                "index": index,
                "original": rel,
                "cutout": str(cut.relative_to(repo_root)) if cut else None,
                "use": use,
            })
        if images:
            by_group[entry["slug"]] = {
                "images": images,
                "pageSlug": entry.get("pageSlug"),
                "score": entry.get("score"),
            }
    return by_group, choice_file


def find_source_pdf(csv_path, explicit=None):
    if explicit:
        p = Path(explicit).expanduser().resolve()
        return p if p.is_file() else None
    folder = Path(csv_path).parent
    preferred = sorted(folder.glob("*.pdf"), key=lambda p: (
        0 if re.search(r"(?i)(tabela|precos|preços|202\d)", p.name) else 1,
        len(p.name),
        p.name.lower(),
    ))
    return preferred[0] if preferred else None


def relative_url(from_html, to_file):
    import os
    return Path(os.path.relpath(str(Path(to_file).resolve()),
                                start=str(Path(from_html).parent.resolve()))).as_posix()


def build_html(rows, groups, glob, per_group, per_ref, source_name,
               pdf_url=None, images=None, asset_url=None, serve_mode=False):
    marcas = sorted({(r.get("marca") or "").strip() for r in rows if r.get("marca")})
    familias = Counter((r.get("familia") or "?").strip() for r in rows)
    n_warn = len(glob) + sum(len(v) for v in per_group.values()) + sum(len(v) for v in per_ref.values())
    images = images or {}
    asset_url = asset_url or (lambda rel: rel)
    n_photos = sum(len(v["images"]) for v in images.values())

    e = html.escape
    pdf_attr = e(pdf_url) if pdf_url else ""

    def gallery(grupo):
        data = images.get(grupo)
        if not data:
            return ""
        shots = []
        for img in data["images"]:
            original = e(asset_url(img["original"]))
            cutout = e(asset_url(img["cutout"])) if img["cutout"] else ""
            use = img["use"]
            show = cutout if (use == "cutout" and cutout) else original
            frame_cls = "frame"
            if use == "cutout" and cutout:
                frame_cls += " show-cutout"
            if use == "exclude":
                frame_cls += " excluded"
            name = e(img["file"])
            badge = ("excluída" if use == "exclude"
                     else "rembg ok" if cutout else "sem cutout")
            badge_cls = " excl" if use == "exclude" else (" ok" if cutout else "")
            shots.append(f"""<figure class="shot{' is-excluded' if use == 'exclude' else ''}" data-file="{name}" data-slug="{e(grupo)}" data-index="{img['index']}">
<div class="{frame_cls}"><img class="shot-img" src="{show}" data-original="{original}"{f' data-cutout="{cutout}"' if cutout else ''} loading="lazy" alt=""/></div>
<div class="pick" role="radiogroup">
<label><input type="radio" name="use-{name}" value="original"{' checked' if use == 'original' else ''}/>Original</label>
<label><input type="radio" name="use-{name}" value="cutout"{' checked' if use == 'cutout' else ''}{'' if cutout else ' disabled'}/>Cutout</label>
<label class="excl"><input type="radio" name="use-{name}" value="exclude"{' checked' if use == 'exclude' else ''}/>Excluir</label>
</div>
<figcaption><code>#{img['index'] + 1}</code><span class="ibadge{badge_cls}">{badge}</span></figcaption>
</figure>""")
        src = data.get("pageSlug")
        meta = f'fonte: <code>{e(src)}</code> · score {e(str(data.get("score") or ""))}' if src else ""
        return f"""<div class="imgs">
<div class="imgs-bar">
  <strong>{len(data['images'])} foto(s)</strong>
  <span class="imgs-meta">{meta}</span>
  <span class="spacer"></span>
  <button type="button" class="gbtn" data-slug="{e(grupo)}" data-use="original">Tudo original</button>
  <button type="button" class="gbtn" data-slug="{e(grupo)}" data-use="cutout">Tudo cutout</button>
  <button type="button" class="gbtn excl" data-slug="{e(grupo)}" data-use="exclude">Excluir todas</button>
</div>
<div class="gallery">{''.join(shots)}</div>
</div>"""

    def chips(pairs):
        return "".join(f'<span class="chip">{e(k)}=<b>{e(v)}</b></span>' for k, v in pairs)

    def page_buttons(pages):
        if not pages:
            return ""
        if not pdf_url:
            return e(",".join(pages))
        return "".join(
            f'<button type="button" class="pg-btn" data-page="{e(p)}" title="Abrir página {e(p)}">{e(p)}</button>'
            for p in pages
        )

    parts = []
    parts.append(f"""<!doctype html><html lang="pt"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Revisão de extração — {e(', '.join(marcas) or source_name)}</title>
<style>
:root{{--bg:#eef4ee;--card:#fff;--line:#d7e4da;--ink:#1c2b21;--mut:#5a6b5e;--acc:#1c7a43;--warn:#b45309;--warnbg:#fef3c7;--err:#b91c1c}}
*{{box-sizing:border-box}}
body{{font-family:system-ui,-apple-system,sans-serif;margin:0;background:var(--bg);color:var(--ink)}}
header{{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid var(--line);padding:.8rem 1.4rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap}}
header h1{{font-size:1.05rem;margin:0 1rem 0 0}}
header .stats{{color:var(--mut);font-size:.82rem}}
input[type=search],select{{padding:.42rem .6rem;border:1px solid var(--line);border-radius:8px;font-size:.85rem;background:#fff}}
input[type=search]{{min-width:230px}}
label.ck{{font-size:.82rem;color:var(--mut);display:flex;gap:.3rem;align-items:center}}
main{{max-width:1200px;margin:0 auto;padding:1.2rem 1.4rem 4rem}}
.banner{{border:1px solid #f2d9a4;background:var(--warnbg);border-radius:12px;padding:.8rem 1rem;margin-bottom:1.2rem;font-size:.85rem}}
.banner ul{{margin:.4rem 0 0;padding-left:1.2rem}}
.banner li{{margin:.15rem 0}}
.fam{{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.2rem}}
.fam span{{background:#fff;border:1px solid var(--line);border-radius:999px;padding:.2rem .7rem;font-size:.78rem;color:var(--mut)}}
.grp{{background:var(--card);border:1px solid var(--line);border-radius:14px;margin-bottom:.9rem;overflow:hidden}}
.grp.warn{{border-color:#f2b866;box-shadow:0 0 0 1px #f2b866 inset}}
.grp>summary{{list-style:none;cursor:pointer;padding:.85rem 1.1rem;display:flex;gap:.8rem;align-items:baseline;flex-wrap:wrap}}
.grp>summary::-webkit-details-marker{{display:none}}
.grp h2{{font-size:.98rem;margin:0}}
.badges{{display:flex;gap:.35rem;flex-wrap:wrap;font-size:.72rem}}
.badge{{background:#f0f6f1;border:1px solid var(--line);border-radius:6px;padding:.1rem .45rem;color:var(--mut)}}
.badge.acc{{background:#e3f2e8;color:var(--acc);border-color:#bfe0cb}}
.badge.wrn{{background:var(--warnbg);color:var(--warn);border-color:#f2d9a4}}
.count{{margin-left:auto;font-size:.78rem;color:var(--mut);white-space:nowrap;display:flex;gap:.45rem;align-items:center;flex-wrap:wrap;justify-content:flex-end}}
.gwarn{{margin:0 1.1rem .6rem;padding:.5rem .7rem;background:var(--warnbg);border-radius:8px;font-size:.78rem;color:var(--warn)}}
.specs{{margin:0 1.1rem .6rem;font-size:.72rem;color:var(--mut)}}
table{{width:100%;border-collapse:collapse;font-size:.8rem}}
th,td{{text-align:left;padding:.45rem .7rem;border-top:1px solid var(--line);vertical-align:top}}
th{{color:var(--mut);font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.03em;border-top:none}}
td.num,th.num{{text-align:right;white-space:nowrap}}
td .ref{{font-family:ui-monospace,Menlo,monospace;font-size:.78rem}}
.chip{{display:inline-block;background:#f0f6f1;border:1px solid var(--line);border-radius:6px;padding:.05rem .4rem;margin:.05rem .15rem .05rem 0;font-size:.72rem;color:var(--mut)}}
.chip b{{color:var(--ink);font-weight:600}}
.rwarn{{color:var(--err);font-size:.72rem;display:block}}
.pg{{color:var(--mut);white-space:nowrap}}
.pg-btns{{display:inline-flex;gap:.25rem;flex-wrap:wrap;align-items:center}}
.pg-btn,.pdf-btn{{appearance:none;border:1px solid var(--line);background:#f7fbf8;color:var(--acc);border-radius:7px;padding:.18rem .45rem;font-size:.72rem;font-weight:600;cursor:pointer;line-height:1.2}}
.pg-btn:hover,.pdf-btn:hover{{background:#e3f2e8;border-color:#bfe0cb}}
.pdf-btn{{padding:.28rem .55rem;font-size:.75rem}}
.mut{{color:var(--mut)}}
.hidden{{display:none}}
footer{{color:var(--mut);font-size:.75rem;text-align:center;padding:1rem}}
.imgs{{margin:0 1.1rem .8rem;border:1px solid var(--line);border-radius:10px;background:#fbfdfb}}
.imgs-bar{{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;padding:.5rem .7rem;border-bottom:1px solid var(--line);font-size:.76rem;color:var(--mut)}}
.imgs-bar .spacer{{flex:1}}
.imgs-meta code{{font-size:.72rem}}
.gbtn{{appearance:none;border:1px solid var(--line);background:#fff;border-radius:7px;padding:.22rem .5rem;font-size:.72rem;cursor:pointer;color:var(--ink)}}
.gbtn:hover{{background:#eef6f0}}
.gbtn.excl{{border-color:#e0b8b8;color:#8a3b3b;background:#fff8f8}}
.gbtn.excl:hover{{background:#f6e5e5}}
.gallery{{display:flex;flex-wrap:wrap;gap:.7rem;padding:.7rem}}
.shot{{margin:0;width:150px;display:flex;flex-direction:column;gap:.3rem}}
.frame{{width:150px;height:150px;border:1px solid var(--line);border-radius:10px;overflow:hidden;position:relative;background-color:#f7faf8;background-image:linear-gradient(45deg,#e2eae4 25%,transparent 25%),linear-gradient(-45deg,#e2eae4 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2eae4 75%),linear-gradient(-45deg,transparent 75%,#e2eae4 75%);background-size:12px 12px;background-position:0 0,0 6px,6px -6px,-6px 0}}
.frame.show-cutout{{outline:2px solid var(--acc);outline-offset:1px}}
.frame.excluded{{outline:2px solid #b85c5c;outline-offset:1px;opacity:.42}}
.shot-img{{width:100%;height:100%;object-fit:contain;display:block}}
.pick{{display:flex;flex-wrap:wrap;gap:.3rem .55rem;font-size:.7rem;color:var(--mut)}}
.pick label{{display:flex;align-items:center;gap:.2rem;cursor:pointer}}
.pick label.excl{{color:#8a3b3b}}
.shot figcaption{{display:flex;justify-content:space-between;align-items:center;gap:.25rem;font-size:.68rem;color:var(--mut)}}
.shot.is-excluded figcaption code{{text-decoration:line-through}}
.ibadge{{font-size:.62rem;text-transform:uppercase;letter-spacing:.03em;border:1px solid var(--line);border-radius:999px;padding:.05rem .35rem;white-space:nowrap}}
.ibadge.ok{{color:var(--acc);border-color:#bfe0cb}}
.ibadge.excl{{color:#8a3b3b;border-color:#e0b0b0}}
.save-btn{{appearance:none;border:1px solid var(--acc);background:var(--acc);color:#fff;border-radius:8px;padding:.42rem .75rem;font-size:.82rem;font-weight:600;cursor:pointer}}
.save-btn:hover{{filter:brightness(1.06)}}
#imgStatus{{font-size:.78rem;color:var(--mut)}}
#pdfModal{{position:fixed;inset:0;z-index:40;display:none;background:rgba(16,28,20,.55);backdrop-filter:blur(2px)}}
#pdfModal.open{{display:flex;align-items:stretch;justify-content:flex-end}}
#pdfModal .panel{{width:min(920px,96vw);height:100%;background:#fff;border-left:1px solid var(--line);display:flex;flex-direction:column;box-shadow:-12px 0 40px rgba(0,0,0,.18)}}
#pdfModal .bar{{display:flex;gap:.5rem;align-items:center;padding:.65rem .85rem;border-bottom:1px solid var(--line);flex-wrap:wrap}}
#pdfModal .bar strong{{font-size:.88rem}}
#pdfModal .bar .pages{{display:flex;gap:.3rem;flex-wrap:wrap;margin-left:.3rem}}
#pdfModal .bar .pages button.active{{background:var(--acc);border-color:var(--acc);color:#fff}}
#pdfModal .bar .spacer{{flex:1}}
#pdfModal .bar .close,#pdfModal .bar .ext{{border:1px solid var(--line);background:#fff;border-radius:8px;padding:.35rem .7rem;cursor:pointer;font-size:.8rem;text-decoration:none;color:var(--ink)}}
#pdfModal iframe{{flex:1;width:100%;border:0;background:#525659}}
#pdfModal .hint{{padding:.45rem .85rem;font-size:.72rem;color:var(--mut);border-top:1px solid var(--line)}}
@media (max-width:720px){{#pdfModal .panel{{width:100vw}}}}
</style></head><body data-pdf="{pdf_attr}">
<header>
  <h1>Revisão de extração — {e(', '.join(marcas) or source_name)}</h1>
  <span class="stats">{len(rows)} SKUs · {len(groups)} produtos (grupos) · {n_warn} aviso(s) · fonte: {e(source_name)}</span>
  <input type="search" id="q" placeholder="Filtrar por nome, ref, gama…"/>
  <select id="fFam"><option value="">Todas as famílias</option>{''.join(f'<option>{e(f)}</option>' for f in sorted(familias))}</select>
  <label class="ck"><input type="checkbox" id="fWarn"/>só com avisos</label>
  {'<label class="ck"><input type="checkbox" id="fImg"/>só sem fotos</label>' if images else ''}
  {'<button type="button" class="gbtn" id="btnRembg">Correr rembg</button>' if images and serve_mode else ''}
  {f'<button type="button" class="save-btn" id="btnSave">Guardar escolha</button><span id="imgStatus">{n_photos} foto(s) em {len(images)} grupo(s)</span>' if images else ''}
</header>
<main>
""")

    if glob:
        parts.append('<div class="banner"><b>Avisos globais</b><ul>'
                     + "".join(f"<li>{e(w)}</li>" for w in glob) + "</ul></div>")

    parts.append('<div class="fam">' + "".join(
        f"<span>{e(f)}: <b>{n}</b></span>" for f, n in familias.most_common()) + "</div>")

    for grupo, members in groups.items():
        r0 = members[0]
        gws = list(per_group.get(grupo, []))
        row_ws = {r.get("ref"): per_ref.get(r.get("ref"), []) for r in members}
        has_warn = bool(gws or any(row_ws.values()))
        pages = sorted({p.strip() for r in members
                        for p in (r.get("pdfPaginas") or "").split(",") if p.strip()},
                       key=lambda x: int(x) if x.isdigit() else 0)
        variaveis, comuns = split_keys(members)
        badges = []
        for f in ["marca", "gama", "familia", "segmento", "sistema", "tipoUnidade"]:
            v = (r0.get(f) or "").strip()
            if v:
                badges.append(f'<span class="badge">{e(v)}</span>')
        comp = (r0.get("componente") or "").strip()
        if comp:
            badges.append(f'<span class="badge acc">{e(comp)}</span>')
        if has_warn:
            badges.append('<span class="badge wrn">avisos</span>')
        n_imgs = len(images.get(grupo, {}).get("images", []))
        if images:
            badges.append(
                f'<span class="badge{" acc" if n_imgs else ""}">'
                f'{f"{n_imgs} foto(s)" if n_imgs else "sem fotos"}</span>'
            )
        search_blob = " ".join(filter(None, [
            grupo, r0.get("nomeGrupo"), r0.get("gama"),
            *[r.get("ref") or "" for r in members],
            *[r.get("nome") or "" for r in members]])).lower()

        pdf_btn = ""
        if pdf_url and pages:
            pdf_btn = (
                f'<button type="button" class="pdf-btn" data-pages="{e(",".join(pages))}" '
                f'data-title="{e(r0.get("nomeGrupo") or grupo)}">Ver PDF</button>'
            )
        page_info = ""
        if pages:
            page_info = f' · pág. <span class="pg-btns">{page_buttons(pages)}</span>'
        parts.append(f"""<details class="grp{' warn' if has_warn else ''}" open
 data-fam="{e((r0.get('familia') or '').strip())}" data-warn="{'1' if has_warn else '0'}"
 data-q="{e(search_blob)}" data-pages="{e(','.join(pages))}" data-title="{e(r0.get('nomeGrupo') or grupo)}"
 data-imgs="{n_imgs}">
<summary><h2>{e(r0.get('nomeGrupo') or grupo)}</h2>
<div class="badges">{''.join(badges)}</div>
<span class="count">{pdf_btn}<span>{len(members)} variante(s) · <code>{e(grupo)}</code>{page_info}</span></span>
</summary>""")
        for w in gws:
            parts.append(f'<div class="gwarn">⚠ {e(w)}</div>')
        parts.append(gallery(grupo))
        if comuns:
            parts.append(f'<div class="specs">specs: {chips(comuns)}</div>')
        # Tabela dinâmica: uma coluna por chave que varia no grupo.
        head_attrs = "".join(f"<th>{e(k)}</th>" for k in variaveis)
        parts.append(f"""<table><thead><tr>
<th>ref</th><th>nome</th>{head_attrs}
<th class="num">PVP s/IVA</th><th>pág.</th>
</tr></thead><tbody>""")
        for r in members:
            ref = r.get("ref") or ""
            warns = "".join(f'<span class="rwarn">⚠ {e(w)}</span>' for w in row_ws.get(ref, []))
            d = dict(attr_pairs(r.get("atributos")))
            cells = "".join(
                f"<td>{e(d[k])}</td>" if k in d else "<td class='mut'>—</td>"
                for k in variaveis)
            row_pages = [p.strip() for p in (r.get("pdfPaginas") or "").split(",") if p.strip()]
            parts.append(
                f"<tr><td><span class='ref'>{e(ref)}</span>{warns}</td>"
                f"<td>{e(r.get('nome') or '')}</td>"
                f"{cells}"
                f"<td class='num'>{fmt_eur((r.get('pvpCents') or '').strip())}</td>"
                f"<td class='pg'><span class='pg-btns'>{page_buttons(row_pages)}</span></td></tr>")
        parts.append("</tbody></table></details>")

    modal = ""
    if pdf_url:
        modal = """
<div id="pdfModal" aria-hidden="true">
  <div class="panel" role="dialog" aria-modal="true" aria-label="Páginas do PDF">
    <div class="bar">
      <strong id="pdfTitle">PDF</strong>
      <div class="pages" id="pdfPages"></div>
      <span class="spacer"></span>
      <a class="ext" id="pdfExt" href="#" target="_blank" rel="noopener">Abrir nativo</a>
      <button type="button" class="close" id="pdfClose">Fechar</button>
    </div>
    <iframe id="pdfFrame" title="Página do PDF"></iframe>
    <div class="hint">Dica: usa os botões de página acima, ou Esc para fechar.</div>
  </div>
</div>
"""

    parts.append(f"""</main>
{modal}
<footer>Gerado por review.py — nada foi importado para a base de dados.</footer>
<script>
const SERVE={'true' if serve_mode else 'false'};
const MARCA={json.dumps(marcas[0] if len(marcas) == 1 else None)};
const q=document.getElementById('q'),fFam=document.getElementById('fFam'),fWarn=document.getElementById('fWarn'),fImg=document.getElementById('fImg');
function apply(){{
  const term=q.value.trim().toLowerCase(),fam=fFam.value,onlyW=fWarn.checked,noImg=fImg&&fImg.checked;
  document.querySelectorAll('details.grp').forEach(d=>{{
    const ok=(!term||d.dataset.q.includes(term))&&(!fam||d.dataset.fam===fam)
      &&(!onlyW||d.dataset.warn==='1')&&(!noImg||d.dataset.imgs==='0');
    d.classList.toggle('hidden',!ok);
  }});
}}
q.addEventListener('input',apply);fFam.addEventListener('change',apply);fWarn.addEventListener('change',apply);
if(fImg) fImg.addEventListener('change',apply);

(function(){{
  const pdf=document.body.dataset.pdf;
  if(!pdf) return;
  const modal=document.getElementById('pdfModal');
  const frame=document.getElementById('pdfFrame');
  const titleEl=document.getElementById('pdfTitle');
  const pagesEl=document.getElementById('pdfPages');
  const ext=document.getElementById('pdfExt');
  let currentPages=[];

  function pdfSrc(page){{
    const base=pdf.split('#')[0];
    return page ? base + '#page=' + page : base;
  }}
  function setActive(page){{
    pagesEl.querySelectorAll('button').forEach(b=>b.classList.toggle('active', b.dataset.page===String(page)));
  }}
  function openPdf(pages, title, startPage){{
    currentPages=(pages||[]).map(String).filter(Boolean);
    const page=String(startPage || currentPages[0] || '1');
    titleEl.textContent=title || 'PDF';
    pagesEl.innerHTML='';
    currentPages.forEach(p=>{{
      const b=document.createElement('button');
      b.type='button';
      b.className='pg-btn';
      b.dataset.page=p;
      b.textContent=p;
      b.addEventListener('click', ()=>{{ frame.src=pdfSrc(p); setActive(p); ext.href=pdfSrc(p); }});
      pagesEl.appendChild(b);
    }});
    frame.src=pdfSrc(page);
    ext.href=pdfSrc(page);
    setActive(page);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
  }}
  function closePdf(){{
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    frame.src='about:blank';
  }}
  document.getElementById('pdfClose').addEventListener('click', closePdf);
  modal.addEventListener('click', (ev)=>{{ if(ev.target===modal) closePdf(); }});
  document.addEventListener('keydown', (ev)=>{{ if(ev.key==='Escape' && modal.classList.contains('open')) closePdf(); }});

  document.addEventListener('click', (ev)=>{{
    const pdfBtn=ev.target.closest('.pdf-btn');
    if(pdfBtn){{
      ev.preventDefault();
      ev.stopPropagation();
      const pages=(pdfBtn.dataset.pages||'').split(',').map(s=>s.trim()).filter(Boolean);
      openPdf(pages, pdfBtn.dataset.title || 'PDF', pages[0]);
      return;
    }}
    const pgBtn=ev.target.closest('.pg-btn');
    if(pgBtn && !pgBtn.closest('#pdfModal')){{
      ev.preventDefault();
      ev.stopPropagation();
      const page=pgBtn.dataset.page;
      const grp=pgBtn.closest('details.grp');
      const pages=((grp && grp.dataset.pages) || page || '').split(',').map(s=>s.trim()).filter(Boolean);
      openPdf(pages, (grp && grp.dataset.title) || ('Página ' + page), page);
    }}
  }}, true);
}})();
</script>""")

    if images:
        parts.append("<script>\n" + IMAGE_PICKER_JS + "\n</script>")

    parts.append("</body></html>")
    return "".join(parts)


# Picker for the crawled brand photos: same semantics as scripts/imagens/preview.mjs
# (original / cutout / exclude → product-scaffold/image-choice.json).
IMAGE_PICKER_JS = """
(function(){
  const statusEl=document.getElementById('imgStatus');
  const shots=()=>[...document.querySelectorAll('.shot')];

  function applyShot(shot){
    const use=shot.querySelector('input[type=radio]:checked')?.value||'original';
    const img=shot.querySelector('.shot-img');
    const frame=shot.querySelector('.frame');
    const badge=shot.querySelector('.ibadge');
    if(!img) return;
    shot.classList.toggle('is-excluded', use==='exclude');
    frame?.classList.toggle('excluded', use==='exclude');
    frame?.classList.toggle('show-cutout', use==='cutout' && !!img.dataset.cutout);
    img.src=(use==='cutout' && img.dataset.cutout) ? img.dataset.cutout : img.dataset.original;
    if(badge){
      badge.classList.remove('ok','excl');
      if(use==='exclude'){ badge.textContent='excluída'; badge.classList.add('excl'); }
      else if(img.dataset.cutout){ badge.textContent='rembg ok'; badge.classList.add('ok'); }
      else { badge.textContent='sem cutout'; }
    }
  }

  function setGroup(slug,use){
    let n=0;
    for(const shot of shots()){
      if(shot.dataset.slug!==slug) continue;
      const radio=shot.querySelector('input[type=radio][value="'+use+'"]');
      if(radio && !radio.disabled){ radio.checked=true; applyShot(shot); n++; }
    }
    return n;
  }

  shots().forEach(shot=>{
    shot.querySelectorAll('input[type=radio]').forEach(r=>{
      r.addEventListener('change',()=>applyShot(shot));
    });
  });

  const label={original:'Original',cutout:'Cutout',exclude:'Excluir'};
  document.querySelectorAll('.gbtn').forEach(btn=>{
    btn.addEventListener('click',(ev)=>{
      ev.preventDefault();
      const n=setGroup(btn.dataset.slug,btn.dataset.use);
      statusEl.textContent=btn.dataset.slug+': '+n+' foto(s) → '+(label[btn.dataset.use]||btn.dataset.use)+' — Guardar escolha para persistir';
    });
  });

  function payload(){
    const items=shots().map(shot=>({
      slug:shot.dataset.slug,
      index:Number(shot.dataset.index),
      file:shot.dataset.file,
      use:shot.querySelector('input[type=radio]:checked')?.value||'original',
    }));
    const choices={};
    for(const it of items) choices[it.file]=it.use;
    return {brand:MARCA,updatedAt:new Date().toISOString(),choices,items};
  }

  const btn=document.getElementById('btnSave');
  if(btn) btn.addEventListener('click',async ()=>{
    const body=payload();
    const excl=body.items.filter(i=>i.use==='exclude').length;
    try{
      if(SERVE){
        const res=await fetch('/api/choice',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
        if(!res.ok) throw new Error(await res.text());
        const out=await res.json();
        statusEl.textContent='Guardado em product-scaffold/image-choice.json ('+body.items.length+' fotos'+(excl?', '+excl+' excluídas':'')+'; '+out.total+' no ficheiro)';
      } else {
        const blob=new Blob([JSON.stringify(body,null,2)],{type:'application/json'});
        const a=document.createElement('a');
        a.href=URL.createObjectURL(blob);
        a.download='image-choice.json';
        a.click();
        URL.revokeObjectURL(a.href);
        statusEl.textContent='Descarregado — move para product-scaffold/image-choice.json (ou serve a página com --serve)';
      }
    }catch(err){ alert(err.message||err); }
  });

  const rembg=document.getElementById('btnRembg');
  if(rembg) rembg.addEventListener('click',async ()=>{
    rembg.disabled=true;
    statusEl.textContent='rembg a correr em todas as fotos da marca (pode levar minutos)…';
    try{
      const res=await fetch('/api/rembg',{method:'POST'});
      if(!res.ok) throw new Error(await res.text());
      statusEl.textContent='rembg concluído — a recarregar…';
      location.reload();
    }catch(err){
      statusEl.textContent='rembg falhou: '+(err.message||err);
      rembg.disabled=false;
    }
  });
})();
"""


def save_choices(choice_file, body):
    """Merge the page's picks into image-choice.json (other brands are kept)."""
    existing = {}
    if choice_file.is_file():
        try:
            data = json.loads(choice_file.read_text(encoding="utf-8"))
            if isinstance(data.get("choices"), dict):
                existing = data["choices"]
        except (json.JSONDecodeError, OSError):
            existing = {}
    merged = dict(existing)
    for file, use in (body.get("choices") or {}).items():
        if use in ("cutout", "original", "exclude"):
            merged[file] = use
    payload = {
        "brand": body.get("brand"),
        "updatedAt": body.get("updatedAt"),
        "choices": merged,
        "items": [{"file": f, "use": u} for f, u in merged.items()],
    }
    choice_file.parent.mkdir(parents=True, exist_ok=True)
    choice_file.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return len(merged)


def serve(repo_root, page_path, choice_file, port, rebuild, marca=None):
    """Serve the repo so the page, PDF and photos all resolve, plus the save API."""
    import subprocess
    from functools import partial
    from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

    page_url = "/" + str(page_path.resolve().relative_to(repo_root)).replace("\\", "/")

    class Handler(SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path in ("/", "/index.html"):
                self.send_response(302)
                self.send_header("Location", page_url)
                self.end_headers()
                return
            super().do_GET()

        def do_PUT(self):
            if self.path != "/api/choice":
                self.send_error(404)
                return
            try:
                length = int(self.headers.get("content-length") or 0)
                body = json.loads(self.rfile.read(length) or b"{}")
                total = save_choices(choice_file, body)
            except Exception as exc:  # surfaced in the page's alert
                self.send_response(500)
                self.send_header("content-type", "text/plain; charset=utf-8")
                self.end_headers()
                self.wfile.write(str(exc).encode())
                return
            out = json.dumps({"ok": True, "total": total}).encode()
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)
            print(f"  ✓ guardado: {choice_file} ({total} ficheiros)")

        def do_POST(self):
            if self.path == "/api/rembg":
                if not marca:
                    self.send_error(400, "sem marca única no CSV")
                    return
                print(f"  … rembg (marca={marca}) — pode levar minutos")
                proc = subprocess.run(
                    ["node", "scripts/imagens/preview.mjs", "--brand", marca, "--rembg-all"],
                    cwd=repo_root, capture_output=True, text=True,
                )
                if proc.returncode != 0:
                    msg = (proc.stderr or proc.stdout or "rembg falhou").strip()
                    print(f"  ✗ rembg: {msg}")
                    self.send_response(500)
                    self.send_header("content-type", "text/plain; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(msg[-2000:].encode())
                    return
                print("  ✓ rembg concluído")
            elif self.path != "/api/reload":
                self.send_error(404)
                return
            rebuild()
            out = b'{"ok":true}'
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)

        def log_message(self, *a):
            pass

    handler = partial(Handler, directory=str(repo_root))
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"→ http://127.0.0.1:{port}{page_url}")
        print("  Ctrl+C para parar.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nParado.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path")
    ap.add_argument("-o", "--out", default=None,
                    help="ficheiro HTML de saída (default: review-<nome do csv>.html)")
    ap.add_argument("--pdf", default=None,
                    help="PDF fonte para o botão Ver PDF (default: *.pdf ao lado do CSV)")
    ap.add_argument("--mapping", default=None,
                    help="mapping.json do pipeline de imagens (default: product-scaffold/mapping.json)")
    ap.add_argument("--no-images", action="store_true",
                    help="não incluir a galeria de fotos")
    ap.add_argument("--serve", nargs="?", type=int, const=3861, default=None,
                    metavar="PORT",
                    help="servir a página (default 3861) para gravar escolhas de imagem")
    args = ap.parse_args()

    csv_path = Path(args.csv_path)
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames or []
        rows = [{k: (v or "") for k, v in row.items() if k is not None} for row in reader]

    if not rows:
        print("CSV vazio — nada para rever.", file=sys.stderr)
        sys.exit(1)

    glob, per_group, per_ref, groups = validate(rows, header)

    base = re.sub(r"\.csv$", "", csv_path.name)
    out = Path(args.out) if args.out else Path(f"review-{base}.html")
    repo_root = find_repo_root(csv_path)
    marcas = {(r.get("marca") or "").strip() for r in rows if r.get("marca")}
    pdf_path = find_source_pdf(csv_path, args.pdf)
    pdf_url = relative_url(out, pdf_path) if pdf_path else None

    images, choice_file = ({}, None)
    if not args.no_images:
        images, choice_file = load_images(repo_root, marcas, args.mapping)

    def asset_url(rel):
        # Cache-bust so a prior 404 (ficheiros ainda a ser escritos) não fica
        # preso no browser — sintoma: checkerboard + ícone de imagem partida.
        target = repo_root / rel
        url = relative_url(out, target)
        try:
            return f"{url}?v={int(target.stat().st_mtime)}"
        except OSError:
            return url

    def build():
        doc = build_html(
            rows, groups, glob, per_group, per_ref, csv_path.name,
            pdf_url=pdf_url, images=images, asset_url=asset_url,
            serve_mode=args.serve is not None,
        )
        out.write_text(doc, encoding="utf-8")

    build()

    n_warn = len(glob) + sum(len(v) for v in per_group.values()) + sum(len(v) for v in per_ref.values())
    print(f"{len(rows)} SKUs · {len(groups)} grupos · {n_warn} aviso(s)")
    for w in glob:
        print(f"  ⚠ {w}")
    for grupo, ws in per_group.items():
        for w in ws:
            print(f"  ⚠ [{grupo}] {w}")
    for ref, ws in per_ref.items():
        for w in ws:
            print(f"  ⚠ [{ref}] {w}")
    if pdf_url:
        print(f"  PDF: {pdf_path} → {pdf_url}")
    else:
        print("  PDF: (não encontrado — botão Ver PDF omitido; usa --pdf)")
    if images:
        n_photos = sum(len(v["images"]) for v in images.values())
        n_cut = sum(1 for v in images.values() for i in v["images"] if i["cutout"])
        print(f"  Fotos: {n_photos} em {len(images)} de {len(groups)} grupos "
              f"({n_cut} com cutout rembg)")
    elif not args.no_images:
        print("  Fotos: (sem mapping.json para esta marca — corre "
              "targets-from-csv.mjs + imagens:match)")
    print(f"→ {out}")

    if args.serve is not None:
        def rebuild():
            """Reload = CSV + fotos. O CSV muda entre reviews (fix_warnings.py,
            verify.py --apply), por isso não basta recarregar o mapping."""
            nonlocal rows, glob, per_group, per_ref, groups, images
            with open(csv_path, newline="", encoding="utf-8-sig") as fh:
                reader = csv.DictReader(fh)
                new_header = reader.fieldnames or []
                new_rows = [{k: (v or "") for k, v in row.items() if k is not None}
                            for row in reader]
            if new_rows:
                rows = new_rows
                glob, per_group, per_ref, groups = validate(rows, new_header)
            if not args.no_images:
                images, _ = load_images(repo_root, marcas, args.mapping)
            build()

        serve(repo_root, out, choice_file or repo_root / "product-scaffold/image-choice.json",
              args.serve, rebuild,
              marca=next(iter(marcas)) if len(marcas) == 1 else None)


if __name__ == "__main__":
    main()
