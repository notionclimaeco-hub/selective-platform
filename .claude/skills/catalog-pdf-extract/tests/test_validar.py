import csv

from validar import exportar_csv, validar_atributos, validar_run

REGISTO = {
    "versao": 4, "padraoNumero": "^\\d+(\\.\\d+)?$", "booleano": ["sim", "nao"],
    "categorias": {
        "ar-condicionado": {"hero": ["frio-kw", "calor-kw", "classe-energetica"], "chaves": [
            {"chave": "frio-kw", "tipo": "numero", "unidade": "kW", "rotulo": "Frio", "hero": True,
             "obrigatorio": ["conjunto", "unidade-interior", "unidade-exterior"]},
            {"chave": "calor-kw", "tipo": "numero", "unidade": "kW", "rotulo": "Calor", "hero": True,
             "obrigatorio": ["conjunto", "unidade-interior"]},
            {"chave": "classe-energetica", "tipo": "texto", "rotulo": "Classe", "hero": True,
             "obrigatorio": ["conjunto"], "padrao": "^(A\\+{0,3}|[B-G]|-)/(A\\+{0,3}|[B-G]|-)$"},
            {"chave": "wifi", "tipo": "enum", "rotulo": "Wi-Fi", "hero": False, "obrigatorio": [],
             "valores": ["sim", "opcional", "nao"]},
            {"chave": "cor", "tipo": "enum", "rotulo": "Cor", "hero": False, "obrigatorio": [],
             "valores": ["branco", "preto"]},
            {"chave": "unidades-max", "tipo": "numero", "rotulo": "UI máx.", "hero": False, "obrigatorio": [],
             "componentes": ["conjunto", "unidade-exterior"]},
        ]},
        "acessorios-e-controlo": {"hero": ["tipo", "compativel-com", "cor"], "chaves": [
            {"chave": "tipo", "tipo": "texto", "rotulo": "Tipo", "hero": True, "obrigatorio": []},
        ]},
    },
}


def sku(ref, grupo, nome_grupo, atributos, pvp=100000, **extra):
    base = {"ref": ref, "nome": nome_grupo, "nomeGrupo": nome_grupo, "marca": "hisense",
            "familia": "ar-condicionado", "segmento": "domestico", "sistema": "mono-split",
            "tipoUnidade": "mural", "componente": "conjunto", "gama": "Air Master",
            "atributos": [{"chave": k, "valor": v} for k, v in atributos], "pvpCents": pvp,
            "ivaIncluido": False, "tabelaOrigem": "hisense-2026", "grupoModelo": grupo,
            "pdfPaginas": [12], "avisos": []}
    base.update(extra)
    return base


def run(*skus):
    return {"marca": "hisense", "ano": 2026, "tabelaOrigem": "hisense-2026", "ficheiro": "t.pdf",
            "skus": list(skus)}


def test_registo_tipo_errado_e_erro_chave_desconhecida_e_obrigatoria_sao_avisos():
    erros, avisos = validar_atributos(REGISTO, "ar-condicionado", "conjunto", [
        {"chave": "frio-kw", "valor": "2,6"},
        {"chave": "seer", "valor": "8.5"},
    ])
    assert erros == ['frio-kw: "2,6" não é um número (ponto decimal, sem unidade)']
    assert "seer: chave desconhecida para ar-condicionado" in avisos
    assert "calor-kw: obrigatório em ar-condicionado/conjunto e está em falta" in avisos
    assert "classe-energetica: obrigatório em ar-condicionado/conjunto e está em falta" in avisos


def test_registo_enum_padrao_componente_e_duplicado():
    erros, avisos = validar_atributos(REGISTO, "ar-condicionado", "unidade-interior", [
        {"chave": "frio-kw", "valor": "2.6"}, {"chave": "calor-kw", "valor": "3.2"},
        {"chave": "wifi", "valor": "talvez"}, {"chave": "classe-energetica", "valor": "A++"},
        {"chave": "unidades-max", "valor": "2"}, {"chave": "frio-kw", "valor": "2.6"},
    ])
    assert any(e.startswith("wifi:") for e in erros)
    assert any(e.startswith("classe-energetica:") for e in erros)
    assert "frio-kw: chave duplicada" in erros
    assert any(a.startswith("unidades-max: não se aplica a unidade-interior") for a in avisos)


def test_familia_desconhecida_e_erro():
    erros, _ = validar_atributos(REGISTO, "foguetoes", "conjunto", [])
    assert erros == ['familia "foguetoes" desconhecida no registo']


def test_validar_run_escreve_erros_e_avisos_nos_skus():
    r = run(sku("A1", "hisense-air-master", "Mural Air Master",
                [("frio-kw", "2,6"), ("calor-kw", "3.2"), ("classe-energetica", "A+++/A+++")]))
    resumo = validar_run(r, REGISTO)
    s = r["skus"][0]
    assert any(a.startswith("erro: frio-kw") for a in s["avisos"])
    assert resumo["comErro"] == 1 and resumo["skus"] == 1


def test_refs_duplicadas_e_variantes_indistinguiveis():
    a = [("frio-kw", "2.6"), ("calor-kw", "3.2"), ("classe-energetica", "A+++/A+++")]
    r = run(sku("A1", "hisense-air-master", "Mural Air Master", a),
            sku("A1", "hisense-air-master", "Mural Air Master", a),
            sku("A2", "hisense-air-master", "Mural Air Master", a))
    validar_run(r, REGISTO)
    assert all(any("ref duplicada" in w for w in s["avisos"]) for s in r["skus"][:2])
    assert all(any("mesmos atributos" in w for w in s["avisos"]) for s in r["skus"])


def test_serie_partida_em_grupos_de_um():
    a = [("frio-kw", "10.0"), ("calor-kw", "11.0"), ("classe-energetica", "A++/A+")]
    r = run(sku("AUC105UR4RKC8", "hisense-auc105ur4rkc8-unidade-interior", "Cassete | Unidade Interior", a,
                componente="unidade-interior"),
            sku("AUC125UR4RKC8", "hisense-auc125ur4rkc8-unidade-interior", "Cassete | Unidade Interior",
                [("frio-kw", "12.1"), ("calor-kw", "13.5"), ("classe-energetica", "A++/A+")],
                componente="unidade-interior"))
    validar_run(r, REGISTO)
    assert all(any("série partida" in w for w in s["avisos"]) for s in r["skus"])


def test_convencao_de_nomes():
    a = [("frio-kw", "2.6"), ("calor-kw", "3.2"), ("classe-energetica", "A+++/A+++")]
    b = [("frio-kw", "3.5"), ("calor-kw", "4.2"), ("classe-energetica", "A+++/A+++")]
    r = run(sku("A1", "hisense-air-master", "Mural Air Master 2.6 kW", a),
            sku("A2", "hisense-air-master", "Mural Air Master", b),
            sku("B1", "hisense-perla", "Mural Perla Branco", a, gama="Perla"))
    validar_run(r, REGISTO)
    assert any("nomeGrupo contém capacidade" in w for w in r["skus"][0]["avisos"])
    assert any("sem sufixo" in w for w in r["skus"][1]["avisos"])
    assert any("nomeGrupo contém cor" in w for w in r["skus"][2]["avisos"])


def test_taxonomia_invalida_e_preco_zero():
    r = run(sku("A1", "hisense-air-master", "Mural Air Master",
                [("frio-kw", "2.6"), ("calor-kw", "3.2"), ("classe-energetica", "A+++/A+++")],
                pvp=0, sistema="tri-split", segmento="domestico"))
    validar_run(r, REGISTO)
    avisos = r["skus"][0]["avisos"]
    assert any(w.startswith("erro: sistema") for w in avisos)
    assert any("preço em falta" in w for w in avisos)


def test_grupo_coerente_e_marca_slug():
    a = [("frio-kw", "2.6"), ("calor-kw", "3.2"), ("classe-energetica", "A+++/A+++")]
    r = run(sku("A1", "hisense-air-master", "Mural Air Master", a),
            sku("A2", "hisense-air-master", "Mural Air Master", [("frio-kw", "3.5"), ("calor-kw", "4.2"),
                                                                 ("classe-energetica", "A+++/A+++")],
                gama="Outra", marca="Hisense"))
    validar_run(r, REGISTO)
    assert any("'gama' inconsistente" in w for w in r["skus"][0]["avisos"])
    assert any("marca não é slug" in w for w in r["skus"][1]["avisos"])


def test_exportar_csv_v3(tmp_path):
    r = run(sku("A1", "hisense-air-master", "Mural Air Master",
                [("frio-kw", "2.6"), ("calor-kw", "3.2")], ean="6926597789521", descricao="x"))
    r["skus"][0]["nome"] = "Mural Air Master 2.6 kW"
    out = tmp_path / "hisense-2026-produtos.csv"
    exportar_csv(r, out)
    with out.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    assert list(rows[0].keys()) == [
        "ref", "ean", "nome", "nomeGrupo", "marca", "familia", "segmento", "sistema", "tipoUnidade",
        "componente", "gama", "atributos", "descricao", "pvpCents", "ivaIncluido", "tabelaOrigem",
        "grupoModelo", "pdfPaginas"]
    assert rows[0]["atributos"] == "frio-kw=2.6;calor-kw=3.2"
    assert rows[0]["pdfPaginas"] == "12" and rows[0]["ivaIncluido"] == "0" and rows[0]["ean"] == "6926597789521"
