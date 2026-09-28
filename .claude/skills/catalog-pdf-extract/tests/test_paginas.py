import pymupdf

from conftest import escrever, pagina_a4
from paginas import paginas_do_run, renderizar


def test_renderiza_png_a_110_dpi_e_pdf_de_uma_pagina(tmp_path):
    d = pymupdf.open()
    for i in range(3):
        escrever(pagina_a4(d), 40, 100, f"Página {i + 1}", 12)
    pdf = tmp_path / "tabela.pdf"
    d.save(pdf)
    out = tmp_path / "paginas"
    ficheiros = renderizar(pdf, [1, 3], out, "hisense-2026")
    assert sorted(f.name for f in ficheiros) == [
        "hisense-2026-p1.pdf", "hisense-2026-p1.png", "hisense-2026-p3.pdf", "hisense-2026-p3.png"]
    png = pymupdf.Pixmap(str(out / "hisense-2026-p1.png"))
    assert abs(png.width - round(595 / 72 * 110)) <= 1
    um = pymupdf.open(out / "hisense-2026-p3.pdf")
    assert len(um) == 1 and "Página 3" in um[0].get_text().replace("\xa0", " ")


def test_nao_reescreve_sem_forcar_e_le_paginas_do_run(tmp_path):
    d = pymupdf.open()
    escrever(pagina_a4(d), 40, 100, "Uma", 12)
    pdf = tmp_path / "tabela.pdf"
    d.save(pdf)
    out = tmp_path / "paginas"
    renderizar(pdf, [1], out, "hisense-2026")
    marca = (out / "hisense-2026-p1.png").stat().st_mtime_ns
    assert renderizar(pdf, [1], out, "hisense-2026") == []
    assert (out / "hisense-2026-p1.png").stat().st_mtime_ns == marca
    assert renderizar(pdf, [1], out, "hisense-2026", forcar=True) != []
    run = {"skus": [{"pdfPaginas": [3, 1]}, {"pdfPaginas": [1, 2]}]}
    assert paginas_do_run(run) == [1, 2, 3]
