#!/usr/bin/env python3
"""Fallback de imagens: extrai os packshots impressos nas páginas do PDF.

Último recurso quando o crawl das marcas não dá foto a um `grupoModelo`.
As tabelas de preços trazem a miniatura do produto ao lado da linha — pequena,
mas melhor do que produto sem imagem.

Uso:
    python3 pdf_images.py produtos.csv [--pdf tabela.pdf]
                          [--only-missing] [--only GRUPO] [--min-px 6000]
                          [--out product-scaffold/pdf-images]

Escreve `<out>/<marca>/<grupoModelo>/NN.png` + `_report.json`.
`match.mjs` liga essas pastas aos grupos sem fotos (fonte `pdf`).

Filtra logótipos/ícones: imagens repetidas em muitas páginas, demasiado
pequenas, ou com aspect ratio de faixa/banner.
"""

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Falta PyMuPDF: pip install pymupdf", file=sys.stderr)
    sys.exit(1)

# An image printed on more pages than this is furniture (logo, badge, header).
MAX_PAGES_PER_IMAGE = 4
MIN_W, MIN_H = 40, 40
MAX_ASPECT = 5.0


def find_repo_root(start):
    p = Path(start).resolve()
    for cand in [p, *p.parents]:
        if (cand / "product-scaffold").is_dir() or (cand / ".git").exists():
            return cand
    return p.parent


def find_source_pdf(csv_path, explicit=None):
    if explicit:
        p = Path(explicit).expanduser().resolve()
        return p if p.is_file() else None
    folder = Path(csv_path).parent
    pdfs = sorted(folder.glob("*.pdf"), key=lambda p: (
        0 if re.search(r"(?i)(tabela|precos|preços|202\d)", p.name) else 1,
        len(p.name),
    ))
    return pdfs[0] if pdfs else None


def pages_of(row):
    out = []
    for part in (row.get("pdfPaginas") or "").replace(";", ",").split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            if a.strip().isdigit() and b.strip().isdigit():
                out.extend(range(int(a), int(b) + 1))
        elif part.isdigit():
            out.append(int(part))
    return sorted(set(out))


def image_usage(doc):
    """xref → number of pages it appears on (logos show up everywhere)."""
    usage = Counter()
    for pno in range(len(doc)):
        for info in doc[pno].get_images(full=True):
            usage[info[0]] += 1
    return usage


def load_pixmap(doc, xref, smask):
    """Embedded image as RGB(A); the smask carries the packshot cutout."""
    pix = fitz.Pixmap(doc, xref)
    if pix.n - pix.alpha >= 4:  # CMYK → RGB
        pix = fitz.Pixmap(fitz.csRGB, pix)
    if smask:
        try:
            base = fitz.Pixmap(pix, 0) if pix.alpha else pix
            pix = fitz.Pixmap(base, fitz.Pixmap(doc, smask))
        except Exception:
            pass
    return pix


def analyse(pix):
    """Cheap shape metrics used to tell packshots from banners and scenes.

    - border_clean: fraction of edge pixels that are transparent or near-white.
      Packshots sit on white/cutout, lifestyle photos bleed to the edges.
    - mean_run / dark_frac: dark horizontal run lengths. Glyphs give thousands
      of 1-3px runs, product edges give long ones.
    """
    small = fitz.Pixmap(pix)
    while max(small.width, small.height) > 220:
        small.shrink(1)
    w, h, n, has_a = small.width, small.height, small.n, small.alpha
    s = small.samples
    if w < 4 or h < 4:
        return {"border_clean": 0.0, "dark_frac": 0.0, "mean_run": 99.0}

    def at(x, y):
        i = (y * w + x) * n
        lum = (s[i] * 299 + s[i + 1] * 587 + s[i + 2] * 114) // 1000 if n >= 3 else s[i]
        return lum, (s[i + n - 1] if has_a else 255)

    runs = []
    dark = 0
    for y in range(h):
        run = 0
        for x in range(w):
            lum, alpha = at(x, y)
            if alpha > 32 and lum < 145:
                run += 1
                dark += 1
            elif run:
                runs.append(run)
                run = 0
        if run:
            runs.append(run)

    border = []
    for x in range(w):
        border.append(at(x, 0))
        border.append(at(x, h - 1))
    for y in range(h):
        border.append(at(0, y))
        border.append(at(w - 1, y))
    clean = sum(1 for lum, alpha in border if alpha < 32 or lum > 225) / len(border)

    return {
        "border_clean": round(clean, 3),
        "dark_frac": round(dark / (w * h), 4),
        "mean_run": round(sum(runs) / len(runs), 2) if runs else 0.0,
    }


def ref_bands(page, refs):
    """Vertical positions where this group's refs are printed on the page."""
    ys = []
    for ref in refs:
        for rect in page.search_for(ref) or []:
            ys.append((rect.y0 + rect.y1) / 2)
    return ys


def distance_to_refs(rects, ys):
    """Distance from the image to the nearest row of the group (None = unknown)."""
    if not ys or not rects:
        return None
    return min(abs((r.y0 + r.y1) / 2 - y) for r in rects for y in ys)


def looks_like_product(m, relative_width):
    """Reject marketing banners, diagrams and lifestyle scenes."""
    if relative_width > 0.55:
        return "banner (largura > 55% da página)"
    if m["border_clean"] < 0.45:
        return "foto de ambiente (fundo até às margens)"
    if m["mean_run"] <= 3.2 and m["dark_frac"] < 0.25:
        return "texto/diagrama (traços finos)"
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path")
    ap.add_argument("--pdf", default=None)
    ap.add_argument("--out", default=None,
                    help="default: product-scaffold/pdf-images")
    ap.add_argument("--mapping", default=None,
                    help="mapping.json usado por --only-missing")
    ap.add_argument("--only-missing", action="store_true",
                    help="só grupos sem fotos no mapping.json")
    ap.add_argument("--only", default=None, help="um grupoModelo específico")
    ap.add_argument("--min-px", type=int, default=6000,
                    help="área mínima em píxeis (default 6000 ≈ 100×60)")
    ap.add_argument("--max-per-group", type=int, default=6)
    ap.add_argument("--skip-accessories", action="store_true",
                    help="ignorar acessórios/comandos")
    ap.add_argument("--no-filter", action="store_true",
                    help="não descartar banners/ambientes (debug)")
    ap.add_argument("--near", type=float, default=200.0,
                    help="distância máxima (pt) entre imagem e linhas do grupo")
    ap.add_argument("--include-ue", action="store_true",
                    help="incluir grupos de unidade exterior")
    ap.add_argument("--loose", action="store_true",
                    help="aceitar imagens não ancoradas às linhas do grupo")
    args = ap.parse_args()

    csv_path = Path(args.csv_path)
    repo_root = find_repo_root(csv_path)
    out_root = Path(args.out) if args.out else repo_root / "product-scaffold/pdf-images"

    pdf_path = find_source_pdf(csv_path, args.pdf)
    if not pdf_path:
        print("PDF não encontrado (usa --pdf)", file=sys.stderr)
        sys.exit(1)

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        rows = [{k: (v or "") for k, v in r.items() if k is not None}
                for r in csv.DictReader(f)]

    groups = defaultdict(list)
    for r in rows:
        groups[r["grupoModelo"]].append(r)

    skip_slugs = set()
    if args.only_missing:
        mapping_file = Path(args.mapping) if args.mapping else repo_root / "product-scaffold/mapping.json"
        if mapping_file.is_file():
            for entry in json.loads(mapping_file.read_text(encoding="utf-8")):
                # Entradas já servidas por este fallback não contam como cobertas,
                # senão uma segunda passagem não regenerava nada.
                if entry.get("files") and entry.get("fonte") != "pdf":
                    skip_slugs.add(entry["slug"])
            print(f"{len(skip_slugs)} grupos já têm fotos do crawl — ignorados")

    doc = fitz.open(pdf_path)
    usage = image_usage(doc)
    report = {"pdf": str(pdf_path), "groups": {}, "skipped": {}}
    total_files = 0
    total_groups = 0

    for grupo, members in sorted(groups.items()):
        if args.only and grupo != args.only:
            continue
        if grupo in skip_slugs:
            continue
        r0 = members[0]
        if args.skip_accessories and (
            r0.get("familia") == "acessorios-e-controlo"
            or r0.get("componente") in ("acessorio", "comando")
        ):
            report["skipped"][grupo] = "acessório"
            continue
        # Price tables print the conjunto's indoor unit next to the UE rows, so a
        # PDF rip for a unidade-exterior group is usually the wrong side.
        if r0.get("componente") == "unidade-exterior" and not args.include_ue:
            report["skipped"][grupo] = "unidade exterior (risco de apanhar a UI)"
            continue

        pages = sorted({p for r in members for p in pages_of(r)})
        if not pages:
            report["skipped"][grupo] = "sem pdfPaginas"
            continue

        marca = (r0.get("marca") or "marca").strip()
        refs = [r["ref"] for r in members if r.get("ref")][:25]
        picked = []
        rejected = []
        seen_hash = set()
        for pno in pages:
            if pno < 1 or pno > len(doc):
                continue
            page = doc[pno - 1]
            page_w = page.rect.width or 1
            ys = ref_bands(page, refs)
            for info in page.get_images(full=True):
                xref, smask, w, h = info[0], info[1], info[2], info[3]
                if usage[xref] > MAX_PAGES_PER_IMAGE:
                    continue  # logo / header furniture
                if w < MIN_W or h < MIN_H or w * h < args.min_px:
                    continue
                if max(w / h, h / w) > MAX_ASPECT:
                    continue
                rects = page.get_image_rects(xref)
                rel_w = max((r.width for r in rects), default=0) / page_w
                try:
                    pix = load_pixmap(doc, xref, smask)
                    metrics = analyse(pix)
                    reason = looks_like_product(metrics, rel_w)
                    if reason and not args.no_filter:
                        rejected.append({"page": pno, "xref": xref,
                                         "px": f"{w}x{h}", "motivo": reason})
                        continue
                    png = pix.tobytes("png")
                except Exception:
                    continue
                digest = hashlib.sha256(png).hexdigest()
                if digest in seen_hash:
                    continue
                seen_hash.add(digest)
                picked.append({"png": png, "page": pno, "w": pix.width,
                               "h": pix.height, "xref": xref, "sha256": digest,
                               "dist": distance_to_refs(rects, ys),
                               "metrics": metrics})

        if not picked:
            motivos = ", ".join(sorted({r["motivo"] for r in rejected})) or "nada extraível"
            report["skipped"][grupo] = f"páginas {pages}: {motivos}"
            continue

        # The shot printed next to the group's own rows wins; size breaks ties.
        picked.sort(key=lambda i: (i["dist"] if i["dist"] is not None else 1e6,
                                   -i["w"] * i["h"]))

        # A page usually mixes several products (conjuntos, UI, UE side by side),
        # so only trust a shot we can tie to the group's own rows. The exception
        # is a page with a single packshot, where there's nothing to confuse.
        near = [i for i in picked if i["dist"] is not None and i["dist"] <= args.near]
        if near:
            picked = near
        elif len(picked) > 1 and not args.loose:
            report["skipped"][grupo] = (
                f"páginas {pages}: {len(picked)} imagens, nenhuma junto às linhas do grupo"
            )
            continue
        picked = picked[: args.max_per_group]
        dest_dir = out_root / marca / grupo
        dest_dir.mkdir(parents=True, exist_ok=True)
        for old in dest_dir.glob("*.png"):
            old.unlink()
        files = []
        for idx, item in enumerate(picked, start=1):
            dest = dest_dir / f"{idx:02d}.png"
            dest.write_bytes(item["png"])
            files.append({
                "file": str(dest.relative_to(repo_root)),
                "page": item["page"],
                "px": f"{item['w']}x{item['h']}",
                "sha256": item["sha256"],
                "distanciaRefs": None if item["dist"] is None else round(item["dist"]),
                **item["metrics"],
            })
        report["groups"][grupo] = {"marca": marca, "pages": pages,
                                   "files": files, "rejeitadas": rejected}
        total_files += len(files)
        total_groups += 1
        print(f"  ✓ {grupo}: {len(files)} imagem(ns) das págs {pages}")

    out_root.mkdir(parents=True, exist_ok=True)
    (out_root / "_report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n{total_files} imagens em {total_groups} grupos → {out_root}")
    print(f"Sem imagem útil: {len(report['skipped'])} grupos")
    print("Segue com: pnpm imagens:match (liga a fonte 'pdf' aos grupos sem fotos)")


if __name__ == "__main__":
    main()
