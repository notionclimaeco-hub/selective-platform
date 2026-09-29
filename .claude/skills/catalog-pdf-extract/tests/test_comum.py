from _comum import (
    e_ref,
    esqueleto,
    grupo_modelo,
    parse_numero_pt,
    parse_preco,
    prefixo_serie,
    slug,
)


def test_refs_aceitam_codigos_hisense():
    for ref in ["QK25WM0A", "AS25WM00W", "AHW-050HCPB1", "AHS-100HCWBAA-23*",
                "YXE-E01U(E)", "AVWT-76FKFSHA#F", "HFQ-104HF#ES", "PE-QEA-LD", "B544(E)", "2AMW42U4RGC"]:
        assert e_ref(ref), ref


def test_refs_rejeitam_ean_precos_dimensoes_tubagem_tensao():
    for tok in ["6926597789521", "1.450", "€", "830×310×215", "1/4”-3/8”",
                "220-240V/50Hz", "A+++", "R32", "9k", "2,6", "(1,0-4,0)", "UI", "2×1"]:
        assert not e_ref(tok), tok


def test_parse_preco_em_centimos():
    assert parse_preco("1.450 €") == 145000
    assert parse_preco("1455€") == 145500
    assert parse_preco("130 €") == 13000
    assert parse_preco("2.745,50 €") == 274550
    assert parse_preco("A++ / A+") is None


def test_parse_numero_pt_usa_ponto_decimal_sem_unidades():
    assert parse_numero_pt("2,6") == "2.6"
    assert parse_numero_pt("12,5") == "12.5"
    assert parse_numero_pt("80") == "80"
    assert parse_numero_pt("A++") is None


def test_slug_e_grupo_modelo_iguais_ao_stagedSku_ts():
    assert slug("Cassete 1x1 Turbo Inverter") == "cassete-1x1-turbo-inverter"
    assert slug("Hi-Therma R32 Monobloco") == "hi-therma-r32-monobloco"
    assert slug("Chão-Teto 1×1 Súper") == "chao-teto-1-1-super"
    assert grupo_modelo("hisense", "Air Master", "conjunto") == "hisense-air-master"
    assert (grupo_modelo("hisense", "Air Master", "unidade-interior")
            == "hisense-air-master-unidade-interior")
    assert grupo_modelo("hisense", None, "acessorio", ref="YXE-E01U(E)") == "hisense-yxe-e01u-e-acessorio"


def test_esqueleto_e_prefixo_de_serie():
    assert esqueleto("AUC105UR4RKC8") == "AUC#UR#RKC#"
    assert prefixo_serie("AUC105UR4RKC8") == "AUC"
    assert prefixo_serie("AHW-050HCPB1") == "AHW"
    assert prefixo_serie("5AMW105U4RQC") == "AMW"
    assert prefixo_serie("PE-QEA-LD") == "PE-QEA-LD"
