#!/usr/bin/env python3
"""5. Páginas: renders PNG a 110 dpi + PDFs de uma página para a revisão.

    python3 paginas.py tabela.pdf --tabela-origem hisense-2026 --staged hisense-2026-staged.json
    python3 paginas.py tabela.pdf --tabela-origem hisense-2026 --paginas 12,13,18

Escreve `paginas/<tabelaOrigem>-p<N>.png` (o que a página de revisão mostra) e
`paginas/<tabelaOrigem>-p<N>.pdf` (a ficha que o catálogo liga). Só as páginas
citadas em `pdfPaginas` (ou a lista explícita). Ficheiros existentes ficam,
salvo `--forcar`. Não precisa de Ghostscript: PyMuPDF grava com `garbage=4`
e `deflate`.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pymupdf

from _comum import ler_json

DPI = 110


def paginas_do_run(run: dict) -> list[int]:
    return sorted({p for s in run.get("skus", []) for p in s.get("pdfPaginas", [])})


def renderizar(pdf: Path | str, paginas: list[int], out_dir: Path | str, tabela_origem: str,
               dpi: int = DPI, forcar: bool = False) -> list[Path]:
    """Escreve PNG + PDF de cada página; devolve os ficheiros escritos."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf)
    escritos: list[Path] = []
    for n in sorted(set(paginas)):
        if not 1 <= n <= len(doc):
            raise ValueError(f"página {n} fora do PDF (1-{len(doc)})")
        png = out / f"{tabela_origem}-p{n}.png"
        pdf1 = out / f"{tabela_origem}-p{n}.pdf"
        if forcar or not png.is_file():
            doc[n - 1].get_pixmap(dpi=dpi, alpha=False).save(png)
            escritos.append(png)
        if forcar or not pdf1.is_file():
            um = pymupdf.open()
            um.insert_pdf(doc, from_page=n - 1, to_page=n - 1)
            um.save(pdf1, garbage=4, deflate=True, clean=True)
            um.close()
            escritos.append(pdf1)
    return escritos


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf", type=Path)
    ap.add_argument("--tabela-origem", required=True, help="ex.: hisense-2026")
    ap.add_argument("--staged", type=Path, help="JSON do run: renderiza as páginas de pdfPaginas")
    ap.add_argument("--paginas", help="lista explícita: 12,13,18-21")
    ap.add_argument("--out", type=Path, help="pasta de saída (default: paginas/ ao lado do PDF)")
    ap.add_argument("--dpi", type=int, default=DPI)
    ap.add_argument("--forcar", action="store_true")
    args = ap.parse_args()

    paginas: set[int] = set()
    if args.staged:
        paginas.update(paginas_do_run(ler_json(args.staged)))
    if args.paginas:
        for parte in args.paginas.split(","):
            parte = parte.strip()
            if "-" in parte:
                a, b = parte.split("-", 1)
                paginas.update(range(int(a), int(b) + 1))
            elif parte:
                paginas.add(int(parte))
    if not paginas:
        ap.error("indica --staged run.json e/ou --paginas 1,2,3")
    out = args.out or args.pdf.with_name("paginas")
    escritos = renderizar(args.pdf, sorted(paginas), out, args.tabela_origem, args.dpi, args.forcar)
    print(f"{len(paginas)} páginas → {out} ({len(escritos)} ficheiros escritos, "
          f"{2 * len(paginas) - len(escritos)} já existiam)")


if __name__ == "__main__":
    main()
