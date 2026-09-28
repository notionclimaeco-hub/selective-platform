"""Fixtures for the extraction toolkit tests.

Fixture pages are generated with PyMuPDF instead of shipping a brand price
table: each helper draws words at the coordinates the Hisense 2026 table uses
(A4 portrait, header bands above the first row, price column at the right).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pymupdf
import pytest

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))


# Base-14 Helvetica has no euro glyph; use a system TrueType font when present.
_FONTE = next((f for f in ["/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf",
                           "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"] if Path(f).is_file()), None)


def escrever(page: pymupdf.Page, x: float, y: float, texto: str, tamanho: float = 7) -> None:
    """Draw one text run; the y is the baseline, like the real table."""
    if _FONTE:
        page.insert_text(pymupdf.Point(x, y), texto, fontsize=tamanho, fontfile=_FONTE, fontname="F0")
    else:
        page.insert_text(pymupdf.Point(x, y), texto, fontsize=tamanho, fontname="helv")


def linha(page: pymupdf.Page, y: float, celulas: list[tuple[float, str]], tamanho: float = 7) -> None:
    for x, texto in celulas:
        escrever(page, x, y, texto, tamanho)


@pytest.fixture
def doc() -> pymupdf.Document:
    d = pymupdf.open()
    yield d
    d.close()


def pagina_a4(d: pymupdf.Document) -> pymupdf.Page:
    return d.new_page(width=595, height=842)


def pytest_configure(config):
    # PyMuPDF's SWIG layer emits DeprecationWarnings on Python 3.13; not ours.
    config.addinivalue_line("filterwarnings", "ignore:builtin type .* has no __module__ attribute:DeprecationWarning")
