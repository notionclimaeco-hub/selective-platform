"""Mitsubishi Electric 2026: séries → secções do mapa.

A tabela repete as mesmas unidades em várias páginas (a UI MSZ-LN25VG vende-se
no conjunto da p9 e avulsa nas matrizes multi-split das p26, p30, p34 e p36):
a secção de cada linha decide-se pela ref, não pela página. `SECCOES` tem a
classificação de cada série; `seccao_de(ref, componente, pagina)` devolve o id.
Conjuntos split classificam-se pelo par `UI/UE` (a mesma cassete PLA-M é
Classic Inverter com SUZ-M/PUZ-M e Power Inverter com PUZ-ZM).
"""
from __future__ import annotations

import re

AC, BC, AQS, VENT, CH, FC = "ar-condicionado", "bombas-de-calor", "aqs", "ventilacao", "chillers", "ventiloconvectores"
ACESS, CORT, OUT = "acessorios-e-controlo", "cortinas-de-ar", "outros"


def S(id_, rx, gama, familia, componente, tipo=None, sistema=None, segmento="comercial", nome=None, **extra):
    """Uma série: `rx` casa a ref (no conjunto, 'UI/UE'); `nome` é o nomeGrupo
    (sem componente), aplicado no pos.py; a gama dá o grupoModelo."""
    return {"id": id_, "rx": re.compile(rx), "titulo": nome or gama, "gama": gama, "familia": familia,
            "componente": componente, "tipoUnidade": tipo, "sistema": sistema, "segmento": segmento,
            "nome": nome, **extra}


def mono(id_, rx, gama, tipo, nome, segmento="domestico"):
    return S(id_, rx, gama, AC, "conjunto", tipo, "mono-split", segmento, nome)


def ui(id_, rx, gama, tipo, nome, segmento="domestico"):
    return S(id_, rx, gama, AC, "unidade-interior", tipo, "multi-split", segmento, nome)


def ue(id_, rx, gama, nome, sistema="multi-split", segmento="domestico", **extra):
    return S(id_, rx, gama, AC, "unidade-exterior", "exterior", sistema, segmento, nome, **extra)


# Refrigerante impresso só como logótipo (imagem) ao lado do título do quadro.
R32, R410A = {"refrigerante": "R32"}, {"refrigerante": "R410A"}


SECCOES = [
    # Gama Doméstica, conjuntos mono-split (p9-25). As gamas são as do catálogo
    # anterior (mitsubishi-msz-ln, …) para as fotos ficarem.
    mono("msz-ln", r"^MSZ-LN.*/", "MSZ-LN", "mural", "Mural MSZ-LN Kirigamine Style"),
    mono("msz-ef", r"^MSZ-EF.*/", "MSZ-EF", "mural", "Mural MSZ-EF Kirigamine Zen"),
    mono("msz-ay", r"^MSZ-AY.*/", "MSZ-AY", "mural", "Mural MSZ-AY"),
    mono("msz-ap", r"^MSZ-AP.*/", "MSZ-AP", "mural", "Mural MSZ-AP"),
    mono("msz-hr", r"^MSZ-HR.*/", "MSZ-HR", "mural", "Mural MSZ-HR"),
    mono("mfz-kt", r"^MFZ-KT.*/", "MFZ-KT", "consola", "Consola MFZ-KT"),
    mono("sfz-m", r"^SFZ-M.*/", "SFZ-M", "consola", "Consola sem Envolvente SFZ-M"),
    mono("sez-m", r"^SEZ-M.*/", "SEZ-M", "conduta-baixa-pressao", "Conduta SEZ-M"),
    mono("mlz-kp", r"^MLZ-K[PY].*/", "MLZ-KP", "cassete-1-via", "Cassete 1 Via MLZ-KP"),
    mono("slz-m", r"^SLZ-M.*/", "SLZ-M", "mini-cassete", "Cassete 4 Vias 60x60 SLZ-M", "comercial"),
    mono("msy-tp", r"^MSY-TP.*/", "MSY-TP", "mural", "Mural Só Frio MSY-TP para Salas de Servidores", "comercial"),
    # Mr. Slim (p59-80): Classic Inverter com SUZ-M/PUZ-M, Power Inverter com PUZ-ZM.
    mono("plz-zm", r"^PLA-M.*/PUZ-ZM", "PLZ-ZM", "cassete-4-vias", "Cassete 4 Vias Power Inverter PLZ", "comercial"),
    mono("plsz-m", r"^PLA-M.*/(SUZ|PUZ)-M", "PLSZ-M", "cassete-4-vias", "Cassete 4 Vias Classic Inverter PLSZ",
         "comercial"),
    mono("pez-zm", r"^PEA[D]?-M.*/PUZ-ZM", "PEZ-ZM", "conduta-media-pressao", "Conduta Power Inverter PEZ",
         "comercial"),
    mono("pesz-m", r"^PEA[D]?-M.*/(SUZ|PUZ)-M", "PESZ-M", "conduta-media-pressao", "Conduta Classic Inverter PESZ",
         "comercial"),
    mono("pkz-zm", r"^PKA-M.*/PUZ-ZM", "PKZ-ZM", "mural", "Mural Power Inverter PKZ", "comercial"),
    mono("pksz-m", r"^PKA-M.*/(SUZ|PUZ)-M", "PKSZ-M", "mural", "Mural Classic Inverter PKSZ", "comercial"),
    mono("pciz-m", r"^PCA-M\d+HA/", "PCIZ-M", "chao-teto", "Teto Horizontal em Aço Inoxidável Power Inverter PCIZ", "comercial"),
    mono("pcz-zm", r"^PCA-M.*/PUZ-ZM", "PCZ-ZM", "chao-teto", "Teto Horizontal Power Inverter PCZ", "comercial"),
    mono("pcsz-m", r"^PCA-M.*/(SUZ|PUZ)-M", "PCSZ-M", "chao-teto", "Teto Horizontal Classic Inverter PCSZ",
         "comercial"),
    mono("psz-zm", r"^PSA-M.*/PUZ-ZM", "PSZ-ZM", "coluna", "Chão Vertical Power Inverter PSZ", "comercial"),
    mono("pssz-m", r"^PSA-M.*/(SUZ|PUZ)-M", "PSSZ-M", "coluna", "Chão Vertical Classic Inverter PSSZ", "comercial"),
    # IT Cooling (p181): armário s-MEXT + UE Mr. Slim, insuflação por cima (OVER) ou por baixo (UNDER).
    S("s-mext", r"^s-MEXT", "s-MEXT", AC, "conjunto", "coluna", "mono-split", "industrial",
      "Close Control s-MEXT"),
    # Unidades interiores avulsas para multi-split (MXZ, PXZ, PUMY) e Twin/Triple (p26-36, p81).
    ui("msz-ln-ui", r"^MSZ-LN", "MSZ-LN", "mural", "Mural MSZ-LN Kirigamine Style"),
    ui("msz-ef-ui", r"^MSZ-EF", "MSZ-EF", "mural", "Mural MSZ-EF Kirigamine Zen"),
    ui("msz-ay-ui", r"^MSZ-AY", "MSZ-AY", "mural", "Mural MSZ-AY"),
    ui("msz-ap-ui", r"^MSZ-AP", "MSZ-AP", "mural", "Mural MSZ-AP"),
    ui("msz-hr-ui", r"^MSZ-HR", "MSZ-HR", "mural", "Mural MSZ-HR"),
    ui("mfz-kt-ui", r"^MFZ-KT", "MFZ-KT", "consola", "Consola MFZ-KT"),
    ui("sfz-m-ui", r"^SFZ-M", "SFZ-M", "consola", "Consola sem Envolvente SFZ-M"),
    ui("mlz-kp-ui", r"^MLZ-K[PY]", "MLZ-KP", "cassete-1-via", "Cassete 1 Via MLZ-KP"),
    ui("slz-m-ui", r"^SLZ-M", "SLZ-M", "mini-cassete", "Cassete 4 Vias 60x60 SLZ-M", "comercial"),
    ui("sez-m-ui", r"^SEZ-M", "SEZ-M", "conduta-baixa-pressao", "Conduta SEZ-M"),
    ui("pead-m-ui", r"^PEAD-M", "PEAD-M", "conduta-media-pressao", "Conduta PEAD-M", "comercial"),
    ui("pla-m-ui", r"^PLA-M", "PLA-M", "cassete-4-vias", "Cassete 4 Vias PLA-M", "comercial"),
    ui("pka-m-ui", r"^PKA-M", "PKA-M", "mural", "Mural PKA-M", "comercial"),
    ui("pca-m-ui", r"^PCA-M", "PCA-M", "chao-teto", "Teto Horizontal PCA-M", "comercial"),
    ui("psa-m-ui", r"^PSA-M", "PSA-M", "coluna", "Chão Vertical PSA-M", "comercial"),
    # Unidades exteriores avulsas.
    ue("mxz-ha", r"^MXZ-\dHA", "MXZ-HA", "Multi-Split MXZ-HA"),
    ue("mxz", r"^MXZ-", "MXZ", "Multi-Split MXZ"),
    ue("pxz", r"^PXZ-", "PXZ", "Multi-Split com AQS PXZ"),
    ue("pumy-sm", r"^PUMY-S?M", "PUMY-SM", "Multi-Split PUMY-SM (R32)", segmento="comercial", fixos=R32),
    ue("pumy-sp", r"^PUMY-SP", "PUMY-SP", "Multi-Split PUMY-SP (R410A)", segmento="comercial", fixos=R410A),
    ue("pumy-p", r"^PUMY-P", "PUMY-P", "Multi-Split PUMY-P (R410A)", segmento="comercial", fixos=R410A),
    ue("puz-zm", r"^PUZ-ZM", "PUZ-ZM", "Power Inverter PUZ-ZM", "mono-split", "comercial"),
    ue("puz-m", r"^PUZ-M", "PUZ-M", "Classic Inverter PUZ-M", "mono-split", "comercial"),
    # Ecodan (p94-107).
    S("suz-swm", r"^SUZ-SWM", "Ecodan SUZ-SWM", BC, "unidade-exterior", "exterior", "bibloco", "domestico",
      "Ecodan Split SUZ-SWM"),
    S("puz-swm", r"^PUZ-SWM", "Ecodan PUZ-SWM", BC, "unidade-exterior", "exterior", "bibloco", "domestico",
      "Ecodan Split PUZ-SWM"),
    S("puhz-sw", r"^PUHZ-SW", "Ecodan PUHZ-SW", BC, "unidade-exterior", "exterior", "bibloco", "comercial",
      "Ecodan Split PUHZ-SW (R410A)", fixos=R410A),
    S("puz-wz", r"^PUZ-WZ", "Ecodan PUZ-WZ", BC, "unidade-exterior", "exterior", "bibloco", "domestico",
      "Ecodan Hydrosplit PUZ-WZ (R290)"),
    # Hydroboxes: um grupo por série (cada uma liga a outra UE: ERSC/ERST..C → PUMY, ERSD/ERST..D →
    # SUZ-SWM, ERSF/ERST..F → PUZ-SWM, ERSE → PUHZ-SW).
    *[S(f"ers{l.lower()}", rf"^ERS{l}-", f"Ecodan Hydrobox ERS{l}", BC, "unidade-interior", "modulo-hidraulico",
        "bibloco", "domestico", f"Ecodan Hydrobox Mural ERS{l} (para {ue})")
      for l, ue in (("C", "PUMY"), ("D", "SUZ-SWM"), ("E", "PUHZ-SW"), ("F", "PUZ-SWM"))],
    *[S(f"erst-{l.lower()}", rf"^ERST\d+{l}-", f"Ecodan Hydrobox Duo ERST {l}", BC, "unidade-interior", "integrada",
        "bibloco", "domestico", f"Ecodan Hydrobox Duo ERST..{l} (para {ue})")
      for l, ue in (("C", "PUMY"), ("D", "SUZ-SWM"), ("F", "PUZ-SWM"))],
    S("erpx", r"^ERPX", "Ecodan Hydrosplit", BC, "unidade-interior", "modulo-hidraulico", "bibloco", "domestico",
      "Ecodan Hydrosplit Mural"),
    S("erpt", r"^ERPT", "Ecodan Hydrosplit Duo", BC, "unidade-interior", "integrada", "bibloco", "domestico",
      "Ecodan Hydrosplit Duo"),
    S("mehp-ib", r"^MEHP-iB", "MEHP-iB", BC, "conjunto", None, "monobloco", "comercial",
      "Bomba de Calor Monobloco MEHP-iB"),
    S("cahv", r"^CAHV", "Ecodan CAHV", BC, "conjunto", None, "monobloco", "comercial",
      "Bomba de Calor Ecodan CAHV (R290)"),
    S("qahv", r"^QAHV", "Ecodan QAHV", BC, "conjunto", None, "monobloco", "comercial",
      "Bomba de Calor para AQS Ecodan QAHV (CO2)", fixos={"refrigerante": "R744"}),
    # Depósitos (p30, p120-125).
    S("est-pxz", r"^EST-", "Depósito PXZ", AQS, "deposito", "deposito", None, "domestico", "Depósito AQS para PXZ"),
    S("easydan-aqs-solar", r"^EASYDAN AQS\d+S", "EASYDAN AQS Solar", AQS, "deposito", "deposito", None,
      "domestico", "Depósito AQS EASYDAN Solar"),
    S("easydan-aqs", r"^EASYDAN AQS", "EASYDAN AQS", AQS, "deposito", "deposito", None, "domestico",
      "Depósito AQS EASYDAN"),
    S("easydan-tt", r"^EASYDAN TT", "EASYDAN TT", AQS, "deposito", "deposito", None, "domestico",
      "Depósito TT EASYDAN (AQS + Inércia)"),
    S("easydan-inst-solar", r"^EASYDAN INST\d+S", "EASYDAN INST Solar", AQS, "deposito", "deposito", None,
      "domestico", "Depósito de Produção Instantânea EASYDAN Solar"),
    S("easydan-inst", r"^EASYDAN INST", "EASYDAN INST", AQS, "deposito", "deposito", None, "domestico",
      "Depósito de Produção Instantânea EASYDAN"),
    S("easydan-in-solar", r"^EASYDAN IN\d+S", "EASYDAN IN Solar", AQS, "deposito", "deposito", None, "domestico",
      "Depósito de Inércia EASYDAN Solar"),
    S("easydan-in", r"^EASYDAN IN", "EASYDAN IN", AQS, "deposito", "deposito", None, "domestico",
      "Depósito de Inércia EASYDAN"),
    # Ventiloconvectores Climaveneta (p111-117).
    S("i-life2-slim-dlmv", r"^i-LIFE2 SLIM 2T DLMV", "i-LIFE2 Slim DLMV", FC, "conjunto", "consola", None,
      "domestico", "Ventiloconvector de Chão i-LIFE2 Slim DLMV"),
    S("i-life2-slim-dlrv", r"^i-LIFE2 SLIM 2T DLRV", "i-LIFE2 Slim DLRV", FC, "conjunto", "consola", None,
      "domestico", "Ventiloconvector de Chão com Painel Radiante i-LIFE2 Slim DLRV"),
    S("i-life2-slim-dliu", r"^i-LIFE2 SLIM 2T DLIU", "i-LIFE2 Slim DLIU", FC, "conjunto", "conduta", None,
      "domestico", "Ventiloconvector de Conduta i-LIFE2 Slim DLIU"),
    *[S(f"{m}-{f}".lower().replace(" ", "-"), rf"^{m}-{f.replace(' ', r' (\dT )?')}\d?\b", f"{m}-{f}", FC, "conjunto",
        tipo, None, "comercial",
        f"Ventiloconvector {nome} {m}-{f.replace('HWD', 'HWD2')} ({'motor AC' if m == 'a' else 'motor DC Inverter'})")
      for m in ("a", "i")
      for f, tipo, nome in (("LIFE3 DLMV", "consola", "de Chão"), ("LIFE3 DLIV", "consola", "de Chão sem Envolvente"),
                            ("LIFE3 DLIO", "conduta", "de Conduta Baixa Pressão"),
                            ("LIFE2 HP DLIO", "conduta", "de Conduta Média Pressão"),
                            ("HWD", "conduta", "de Conduta Alta Pressão"), ("CXW", "cassete", "Cassete"))],
    S("i-mxw", r"^i-MXW", "i-MXW", FC, "conjunto", "mural", None, "domestico", "Ventiloconvector Mural i-MXW"),
    # Ventilação (p127-131, p160-167).
    S("vl-80", r"^VL-\d+EU", "VL-80EU5", VENT, "conjunto", "vmc", None, "domestico",
      "Recuperador de Calor Lossnay VL-80EU5"),
    S("vl-czpvu", r"^VL-\d+CZPVU", "VL", VENT, "conjunto", "recuperador-de-calor", None, "domestico",
      "Recuperador de Calor Lossnay VL-CZPVU"),
    S("lgh-rvx3", r"^LGH-\d+RVX3", "LGH-RVX3", VENT, "conjunto", "recuperador-de-calor", None,
      "comercial", "Recuperador de Calor Lossnay LGH-RVX3"),
    S("lgh-rvxt3", r"^LGH-\d+RVXT3", "LGH-RVXT3", VENT, "conjunto", "recuperador-de-calor", None,
      "comercial", "Recuperador de Calor Lossnay LGH-RVXT3 (Altura 500 mm)"),
    S("lgh-rvs", r"^LGH-\d+RVS", "LGH-RVS", VENT, "conjunto", "recuperador-de-calor", None, "comercial",
      "Recuperador de Calor Lossnay LGH-RVS (Permutador Sensível)"),
    S("gux", r"^GUX-", "GUX", VENT, "conjunto", "recuperador-de-calor", None, "comercial",
      "Recuperador de Calor Lossnay GUX com Bateria DX"),
    *[S(f"s-airme-{t}-{v}".lower(), rf"^s-AIRME {t}/{v}\b", f"s-AIRME {t}/{v}", VENT, "conjunto", "uta", None,
        "comercial", f"UTA Compacta s-AIRME {t}/{v} ({versao})")
      for t in ("MF", "HR-P", "HR-E") for v, versao in (("C", "Básica"), ("I", "Intermédia"), ("B", "Booster"))],
    # Chillers (p138-139) e rooftops (p174-175).
    S("mech-is", r"^MECH-iS", "MECH-iS", CH, "conjunto", "chiller", None, "comercial", "Chiller Só Frio MECH-iS"),
    S("mehp-is", r"^MEHP-iS", "MEHP-iS", CH, "conjunto", "chiller", None, "comercial",
      "Chiller Bomba de Calor Reversível MEHP-iS"),
    S("wsm-ar", r"^WSM2-\d+-AR$", "WSM AR", AC, "conjunto", "rooftop", "rooftop", "comercial",
      "Rooftop WSM2 AR (100% Recirculação)"),
    S("wsm-mf", r"^WSM2-\d+-MF$", "WSM MF", AC, "conjunto", "rooftop", "rooftop", "comercial",
      "Rooftop WSM2 MF (Mistura de Caudal e Free-Cooling)"),
    S("wsm-ax-f", r"^WSM2-\d+-AX-F$", "WSM AX-F", AC, "conjunto", "rooftop", "rooftop", "comercial",
      "Rooftop WSM2 AX-F (Extração e Recuperação)"),
    S("wsm-ce", r"^WSM2-\d+-CE$", "WSM CE", AC, "conjunto", "rooftop", "rooftop", "comercial",
      "Rooftop WSM2 CE (Mistura, Extração e Free-Cooling)"),
    # Cortinas de ar e secadores de mãos (p215-217).
    S("gk", r"^GK-", "GK", CORT, "conjunto", "cortina-de-ar", None, "comercial", "Cortina de Ar GK"),
    # JT-SB (vertical) é a Jet Towel Slim e JT-S2AP (caixa) a Smart, como no site (/jet-towel-slim, /jet-towel-smart).
    S("jt-sb", r"^JT-SB", "JT-SB", OUT, "conjunto", None, None, "comercial", "Secador de Mãos Jet Towel Slim"),
    S("jt-s", r"^JT-S", "JT-S", OUT, "conjunto", None, None, "comercial", "Secador de Mãos Jet Towel Smart"),
    # Acessórios, comandos e controlo (agrupados pelo agrupar.py por esqueleto da ref).
    S("comandos", r".", None, ACESS, "comando", "comando", None, None, "Comando"),
    S("acessorios", r".", None, ACESS, "acessorio", "acessorio", None, None, "Acessório"),
]
_POR_ID = {s["id"]: s for s in SECCOES}

CONJUNTO_COMPONENTES = {"conjunto"}


def seccao_de(ref: str, componente: str | None, pagina: int) -> str:
    """Secção da ref. Com componente de produto, só as séries desse componente;
    sem componente (listas) ou 'acessorio'/'comando', a primeira série de produto
    cuja regex case (uma UE ou um hydrobox listados como opção) ou os acessórios."""
    comp = componente or "acessorio"
    for s in SECCOES:
        if s["componente"] in ("acessorio", "comando"):
            continue
        generico = comp in ("acessorio", "comando")
        if not generico and s["componente"] != comp:
            continue
        if s["rx"].search(ref):
            return s["id"]
    return "comandos" if comp == "comando" else "acessorios"


def seccao(id_: str) -> dict:
    return _POR_ID[id_]
