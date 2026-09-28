import json

import pytest

from enviar import Convex, enviar


class Transporte:
    """Fake HTTP transport: records every call, answers like the Convex API."""

    def __init__(self, erros_por_lote=None):
        self.chamadas = []
        self.erros_por_lote = erros_por_lote or {}
        self.lote = 0

    def __call__(self, metodo, url, cabecalhos, corpo):
        self.chamadas.append((metodo, url, cabecalhos, corpo))
        if url.endswith("/api/mutation"):
            pedido = json.loads(corpo)
            path = pedido["path"]
            if path == "importData:gerarUploadUrl":
                valor = "https://upload.test/u1"
            elif path == "importacoes:criarImportacao":
                valor = {"importacaoId": "imp_1"}
            elif path == "importacoes:carregarSkus":
                self.lote += 1
                erros = self.erros_por_lote.get(self.lote, [])
                valor = {"carregados": len(pedido["args"]["skus"]) - len(erros), "erros": erros}
            elif path == "importacoes:registarPaginaImagem":
                valor = {"paginaId": "pag_1", "substituido": False}
            elif path == "importData:registarPagina":
                valor = {"paginaId": "pag_1", "substituido": False}
            elif path == "importacoes:concluirCarregamento":
                valor = {"numSkus": 250, "numGrupos": 3, "numNovos": 250, "numAlterados": 0,
                         "numIguais": 0, "numComAvisos": 1}
            else:
                return 200, json.dumps({"status": "error", "errorMessage": f"unknown {path}"}).encode()
            return 200, json.dumps({"status": "success", "value": valor}).encode()
        if url.startswith("https://upload.test/"):
            return 200, json.dumps({"storageId": f"st_{len(self.chamadas)}"}).encode()
        raise AssertionError(url)

    def mutacoes(self):
        return [json.loads(c[3])["path"] for c in self.chamadas if c[1].endswith("/api/mutation")]


def sku(i):
    return {"ref": f"R{i}", "nome": "x", "nomeGrupo": "x", "marca": "hisense", "familia": "ar-condicionado",
            "componente": "conjunto", "atributos": [], "pvpCents": 100, "ivaIncluido": False,
            "tabelaOrigem": "hisense-2026", "grupoModelo": f"g{i % 3}", "pdfPaginas": [1], "avisos": []}


def run_de(n, avisos=None):
    r = {"marca": "hisense", "ano": 2026, "tabelaOrigem": "hisense-2026", "ficheiro": "t.pdf",
         "skus": [sku(i) for i in range(n)]}
    if avisos:
        r["skus"][0]["avisos"] = avisos
    return r


def test_mutation_envia_o_formato_da_api_http_do_convex():
    t = Transporte()
    c = Convex("https://x.convex.cloud", "segredo", transporte=t)
    assert c.mutation("importacoes:criarImportacao", {"marca": "hisense"}) == {"importacaoId": "imp_1"}
    metodo, url, cabecalhos, corpo = t.chamadas[0]
    assert (metodo, url) == ("POST", "https://x.convex.cloud/api/mutation")
    assert cabecalhos["Content-Type"] == "application/json"
    assert json.loads(corpo) == {"path": "importacoes:criarImportacao", "args": {"marca": "hisense", "secret": "segredo"},
                                 "format": "json"}


def test_erro_da_api_vira_excecao():
    c = Convex("https://x.convex.cloud", "s", transporte=Transporte())
    with pytest.raises(RuntimeError, match="unknown"):
        c.mutation("nao:existe", {})


def test_enviar_faz_upload_lotes_de_100_paginas_e_conclui(tmp_path):
    pdf = tmp_path / "t.pdf"
    pdf.write_bytes(b"%PDF-1.4 fake")
    pags = tmp_path / "paginas"
    pags.mkdir()
    (pags / "hisense-2026-p1.png").write_bytes(b"\x89PNG")
    (pags / "hisense-2026-p1.pdf").write_bytes(b"%PDF")
    (pags / "hisense-2026-p2.png").write_bytes(b"\x89PNG")
    t = Transporte()
    c = Convex("https://x.convex.cloud", "s", transporte=t)
    resumo = enviar(run_de(250), c, pdf=pdf, paginas=pags)
    ordem = t.mutacoes()
    assert ordem[:2] == ["importData:gerarUploadUrl", "importacoes:criarImportacao"]
    assert ordem.count("importacoes:carregarSkus") == 3
    assert ordem.count("importacoes:registarPaginaImagem") == 2
    assert ordem.count("importData:registarPagina") == 1
    assert ordem[-1] == "importacoes:concluirCarregamento"
    criar = next(json.loads(c[3]) for c in t.chamadas if c[1].endswith("/api/mutation")
                 and json.loads(c[3])["path"] == "importacoes:criarImportacao")
    assert criar["args"]["pdf"].startswith("st_") and criar["args"]["ficheiro"] == "t.pdf"
    lotes = [json.loads(c[3])["args"]["skus"] for c in t.chamadas if c[1].endswith("/api/mutation")
             and json.loads(c[3])["path"] == "importacoes:carregarSkus"]
    assert [len(l) for l in lotes] == [100, 100, 50]
    assert "secret" not in lotes[0][0]
    imagem = next(json.loads(c[3])["args"] for c in t.chamadas if c[1].endswith("/api/mutation")
                  and json.loads(c[3])["path"] == "importacoes:registarPaginaImagem")
    assert imagem["tabelaOrigem"] == "hisense-2026" and imagem["pagina"] == 1 and imagem["imagem"].startswith("st_")
    assert resumo["importacaoId"] == "imp_1" and resumo["carregados"] == 250 and resumo["erros"] == []
    assert resumo["contagens"]["numSkus"] == 250


def test_erros_de_lote_sao_devolvidos_e_a_run_fica_aberta(tmp_path):
    t = Transporte(erros_por_lote={1: [{"ref": "R3", "erro": "frio-kw: x"}]})
    c = Convex("https://x.convex.cloud", "s", transporte=t)
    resumo = enviar(run_de(5), c, pdf=None, paginas=None)
    assert resumo["erros"] == [{"ref": "R3", "erro": "frio-kw: x"}]
    assert "importacoes:concluirCarregamento" not in t.mutacoes()
    assert resumo["contagens"] is None


def test_recusa_enviar_com_avisos_de_erro_salvo_forcar():
    t = Transporte()
    c = Convex("https://x.convex.cloud", "s", transporte=t)
    with pytest.raises(RuntimeError, match="erro:"):
        enviar(run_de(2, avisos=["erro: frio-kw: mau"]), c, pdf=None, paginas=None)
    assert t.chamadas == []
    enviar(run_de(2, avisos=["erro: frio-kw: mau"]), c, pdf=None, paginas=None, forcar=True)
    assert "importacoes:criarImportacao" in t.mutacoes()


def test_dry_run_nao_chama_nada():
    t = Transporte()
    c = Convex("https://x.convex.cloud", "s", transporte=t)
    resumo = enviar(run_de(120), c, pdf=None, paginas=None, dry_run=True)
    assert t.chamadas == [] and resumo["lotes"] == 2
