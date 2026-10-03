"""(Cópia de .context/daikin/fotos.py: corre ao lado de sondas.json e hub-imgs.json.)
Daikin 2026 (#52): escolha das fotos do daikin.pt por grupo → product-scaffold/imagens/daikin.

Fontes: páginas de série `/pt_pt/products/product.html/<SERIE>.html` (packshots MDM, `sondas.json`)
e páginas residenciais (packshots b2c, `hub-imgs.json`). Cada entrada: (página, regex do nome do
ficheiro, extras). Página "b2c" = qualquer página residencial. "@grupo" reutiliza as fotos de
outro grupo (conjuntos = fotos da UI e depois da UE).

    python3 fotos.py            # descarrega e escreve candidatas.json (só grupos de equipamento)
"""
import json, re, subprocess, sys, hashlib
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
OUT = RAIZ / "product-scaffold/imagens/daikin"
SONDAS = json.loads((Path(__file__).parent / "sondas.json").read_text())
HUB = json.loads((Path(__file__).parent / "hub-imgs.json").read_text())

MS = "modelo anterior da mesma série"
BIV = "foto da versão bivalente (mesma carcaça)"

UI_UE = {  # UE de cada sufixo de conjunto Sky Air
    "alpha": "@daikin-sky-air-alpha-rzag-unidade-exterior",
    "advance": "@daikin-sky-air-advance-rzasg-unidade-exterior",
    "active": "@daikin-sky-air-active-azas-unidade-exterior",
    "rxm": ("b2c", r"^04_Cold_Packshot_RXM-R_3-4_FRONT"),
}

SEL: dict[str, list] = {
    # --- Purificadores ---------------------------------------------------------------------------
    "daikin-streamer-mc": [("b2c", r"^00_Cold_Packshot_MC30YV_1-1_FRONT"), ("b2c", r"^03_Cold_Packshot_MC30YV_3-4"),
                           ("MC55W", r"^MC55W_front"), ("b2c", r"^00_Packshot_MC80Z_1-1_FRONT")],
    "daikin-streamer-mck": [("b2c", r"^00_Cold_Packshot_MCK70ZW_WHITE_1-1_FRONT"),
                            ("b2c", r"^00_Cold_Packshot_MCK70ZH_BLACK_1-1_FRONT"),
                            ("b2c", r"^03_Cold_Packshot_MCK70ZW_WHITE_3-4", ),
                            ("b2c", r"^00_Cold_Packshot_MCK55W_1-1_FRONT", {"aviso": "MCK55W (o MCK555A não tem foto própria)"})],
    "daikin-astropure-2000": [("BR00000554", r"^BR0000554_[FLR]"), ("BR00000676", r"^AAF%20Front%20View"),
                              ("BR00000676", r"^BR00000676-678")],
    # --- Split doméstico -------------------------------------------------------------------------
    "daikin-ururu-sarara-ui": [("FTXZ-N", r"^FTXZ-N_[FLR]\.")],
    "daikin-ururu-sarara": ["@daikin-ururu-sarara-ui", ("b2c", r"^04_Cold_Packshot_RXZ-N_3-4")],
    "daikin-emura-unidade-interior": [
        ("FTXJ-AW9", r"^FTXJ-AW9_(front|left)\.", {"cor": "branco"}),
        ("FTXJ-AS9", r"^FTXJ-AS9_(front_schaduw|left)\.", {"cor": "prateado"}),
        ("FTXJ-AB9", r"^FTXJ-AB9_(front|left)\.", {"cor": "preto"})],
    "daikin-rxj-unidade-exterior": [("RXJ-A9", r"_regular%20logo_(front|left|right)\."),
                                    ("RXJ-A", r"^RXJ20-35A")],
    "daikin-emura": ["@daikin-emura-unidade-interior", ("RXJ-A9", r"_regular%20logo_front\.")],
    "daikin-stylish-unidade-interior": [
        ("FTXA-CW", r"^FTXA-CW%20(Front|Left)", {"cor": "branco"}),
        ("FTXA-CS", r"^FTXA-CS%20(Front|Left)", {"cor": "prateado"}),
        ("FTXA-CB", r"^FTXA-CB%20(Front|Left)", {"cor": "preto"}),
        ("b2c", r"^FTXA-DP_(1-1_front|3-4_front)", {"cor": "madeira-clara"}),
        ("b2c", r"^FTXA-DY_(1-1_front|3-4_front)", {"cor": "madeira-escura"}),
        ("b2c", r"^FTXA-DG_(1-1_front|3-4_front)", {"cor": "cinzento"}),
        ("b2c", r"^FTXA-DC_(1-1_front|3-4_front)", {"cor": "azul"}),
        ("b2c", r"^FTXA-DL_(1-1_front|3-4_front)", {"cor": "castanho"})],
    "daikin-rxa-unidade-exterior": [("RXA-A8", r"^RXA-A8(_[FL])?\."), ("RXA-B8", r"^RXA42-50B8_F")],
    "daikin-stylish": ["@daikin-stylish-unidade-interior", ("RXA-A8", r"^RXA-A8_F")],
    "daikin-perfera-unidade-interior": [("FTXM-A", r"^FTXM-A_[FLR]\.")],
    "daikin-rxm-unidade-exterior": [("RXM-A9", r"^RXM-A9_(FRONT|LEFT|RIGHT)"), ("RXM-A8", r"^RXM-A8_FRONT")],
    "daikin-perfera": ["@daikin-perfera-unidade-interior", ("RXM-A9", r"^RXM-A9_FRONT")],
    "daikin-comfora-unidade-interior": [("FTXP-N9", r"^FTXP-N9_[FLR]\.")],
    "daikin-rxp-unidade-exterior": [("RXP-N9", r"^RXP-N9_R"), ("b2c", r"^04_Cold_Packshot_RXP-N_3-4")],
    "daikin-comfora": ["@daikin-comfora-unidade-interior", ("RXP-N9", r"^RXP-N9_R")],
    "daikin-sensira-unidade-interior": [("FTXF-F", r"^FTXF-F(_[FL])?\.")],
    "daikin-rxf-unidade-exterior": [("RXF-F", r"^RXF-F\."), ("RXF-D9", r"^RXF-D9_[FL]")],
    "daikin-sensira": ["@daikin-sensira-unidade-interior", ("RXF-F", r"^RXF-F\.")],
    "daikin-perfera-de-chao-unidade-interior": [("FVXM-B", r"^FVXM-B-(front-1|left-1|right-1)"),
                                                ("CVXM-B", r"^CVXM-B-front-1")],
    "daikin-perfera-de-chao": [("FVXM-B", r"^FVXM-B-(front-1|left-1|right-1)"),
                               ("RXM-A9", r"^RXM-A9_FRONT", {"aviso": "UE genérica da gama Perfera"})],
    "daikin-baixo-perfil-fdxm-unidade-interior": [("FDXM-F9", r"^FDXM25-35F9(_[FL])?\.")],
    "daikin-baixo-perfil-fdxm": ["@daikin-baixo-perfil-fdxm-unidade-interior", UI_UE["rxm"]],
    "daikin-baixo-perfil-fdxm-com-comando-unidade-interior": ["@daikin-baixo-perfil-fdxm-unidade-interior"],
    "daikin-baixo-perfil-fdxm-alpha": ["@daikin-baixo-perfil-fdxm-unidade-interior", UI_UE["alpha"]],
    # --- Multi ---------------------------------------------------------------------------------------
    "daikin-multi-mxm-unidade-exterior": [("2MXM-A9", r"^2-3-4-5MXM-A9_(front|left|right)"), ("3MXM-A", r"^3-4-5MXM-A\.")],
    "daikin-multi-mwxm-unidade-exterior": [("4MWXM-A9", r"^4MWXM52A9_(front|left)"), ("5MWXM-A9", r"^5MWXM-A9_F")],
    "daikin-multi-sensira-unidade-interior": [("CTXF-F", r"^CTXF-F(_L)?\.")],
    # --- VRV -------------------------------------------------------------------------------------------
    "daikin-vrf-mini-vrv-compact-unidade-exterior": [("RXYSCQ-TV1", r"^RXYSCQ-TV1\.")],
    "daikin-vrf-mini-vrv-unidade-exterior": [("RXYSQ-TV9", r"^RXYSQ4-6TV9_TY9")],
    "daikin-vrf-era-para-uta-unidade-exterior": [("ERA-AV", r"^ERA-AV_AY(_Front|_Left)?\.")],
    # --- Sky Air: UI ---------------------------------------------------------------------------------
    "daikin-round-flow-fcag-unidade-interior": [("FCAG-B", r"^FCAG-B\.")],
    "daikin-totalmente-plana-ffa-unidade-interior": [("FFA-A9", r"^FFA-A9_(W|S-W)\.")],
    "daikin-a-vista-fua-unidade-interior": [("FUA-A", r"^FUA-A\.")],
    "daikin-horizontal-a-vista-fha-unidade-interior": [("FHA-A", r"^FHA60-71A")],
    "daikin-sky-air-faa-unidade-interior": [("FAA-B", r"^FAA100B_[FL]"), ("FAA-B", r"^FAA71B_F")],
    "daikin-fba-unidade-interior": [("FBA-A", r"^FBA35-50A")],
    "daikin-adea-unidade-interior": [("ADEA-A", r"^ADEA71-1250A"), ("ADEA-A", r"^ADEA35-60A")],
    "daikin-fna-unidade-interior": [("FNA-A9", r"^FNA-A9(_with_legs)?\.")],
    "daikin-fda-unidade-interior": [("FDA-A", r"^FDA125A"), ("FDA-A", r"^FDA200-250A_Product%20picture_Front"),
                                    ("FDA-A", r"^FDA200-250A\.")],
    "daikin-armario-vertical-fva-unidade-interior": [("FVA-A", r"^FVA71A_without%20remocon_[FL]"), ("FVA-A", r"^FVA71A\.")],
    "daikin-round-flow-fcag-com-painel-e-comando-unidade-interior": ["@daikin-round-flow-fcag-unidade-interior"],
    "daikin-round-flow-fcag-com-painel-unidade-interior": ["@daikin-round-flow-fcag-unidade-interior"],
    "daikin-totalmente-plana-ffa-com-painel-e-comando-unidade-interior": ["@daikin-totalmente-plana-ffa-unidade-interior"],
    "daikin-totalmente-plana-ffa-com-painel-unidade-interior": ["@daikin-totalmente-plana-ffa-unidade-interior"],
    "daikin-horizontal-a-vista-fha-com-comando-unidade-interior": ["@daikin-horizontal-a-vista-fha-unidade-interior"],
    "daikin-fba-com-comando-unidade-interior": ["@daikin-fba-unidade-interior"],
    "daikin-fna-com-comando-unidade-interior": ["@daikin-fna-unidade-interior"],
    # --- Sky Air: UE ---------------------------------------------------------------------------------
    "daikin-sky-air-alpha-rzag-unidade-exterior": [("RZAG-B", r"^RZAG-B_Right"),
                                                   ("RZAG-NV1", r"^RZAG-NV1_NY1\.")],
    "daikin-sky-air-advance-rzasg-unidade-exterior": [("RZASG-MV1", r"^RZASG71MV1_MY1"), ("RZASG-MV1", r"^RZASG100-140MV1_MY1")],
    "daikin-sky-air-active-azas-unidade-exterior": [("AZAS-MV", r"^AZAS100-140MV_MY")],
    "daikin-arxm-unidade-exterior": [("ARXM-A", r"^ARXM-A_(FRONT|LEFT|RIGHT)")],
    "daikin-sky-air-rza-d-unidade-exterior": [("RZA-D", r"^RZA-D\.")],
    "daikin-perfera-sky-air-alpha": [("FTXM-A", r"^FTXM-A_F\."), UI_UE["alpha"]],
    "daikin-sky-air-faa-rxm": ["@daikin-sky-air-faa-unidade-interior", "@daikin-arxm-unidade-exterior"],
    "daikin-adea-rxm": ["@daikin-adea-unidade-interior", "@daikin-arxm-unidade-exterior"],
    "daikin-fda-rza-d": [("FDA-A", r"^FDA200-250A_Product%20picture_Front"), "@daikin-sky-air-rza-d-unidade-exterior"],
    # --- Altherma ------------------------------------------------------------------------------------
    "daikin-altherma-4-h-unidade-exterior": [("EPSKS-AV3", r"^EPSKS-AV3(_[FL])?\."),
                                            ("b2c", r"^03_Packshot_Daikin-Altherma-4-Outdoor_3-4_FRONT")],
    "daikin-altherma-4-h-ech2o-unidade-interior": [("b2c", r"^0[013]_Packshot_Daikin-Altherma-4-ECH2O_(1-1_FRONT|1-1_LEFT|3-4_FRONT)")],
    "daikin-altherma-4-h-ech2o-bivalente-unidade-interior": [
        ("b2c", r"^0[03]_Packshot_Daikin-Altherma-4-ECH2O_(1-1_FRONT|3-4_FRONT)", {"aviso": "foto da versão não bivalente (mesma carcaça)"})],
    "daikin-altherma-4-h-w-unidade-interior": [("b2c", r"^0[013]_Packshot_Daikin-Altherma-4-EHBX_(1-1_FRONT|1-1_LEFT|3-4_FRONT)")],
    "daikin-altherma-4-h-f-unidade-interior": [("b2c", r"^0[013]_Packshot_Daikin-Altherma-4-EHVX_(1-1_FRONT|1-1_LEFT|3-4_FRONT)")],
    "daikin-altherma-3-h-ht-unidade-exterior": [("b2c", r"^04_Packshot_EPRA08_3-4", {"aviso": "UE EPRA08 (outro tamanho da gama)"})],
    "daikin-altherma-3-h-ht-ech2o-unidade-interior": [("b2c", r"^0[013]_Packshot_EHSXB-E_(1-1_FRONT|1-1_LEFT|3-4_FRONT)", {"aviso": BIV})],
    "daikin-altherma-3-h-ht-ech2o-bivalente-unidade-interior": [("b2c", r"^0[013]_Packshot_EHSXB-E_(1-1_FRONT|1-1_LEFT|3-4_FRONT)")],
    "daikin-altherma-3-h-ht-w-unidade-interior": [("b2c", r"^0[013]_Packshot_EHBX_(1-1_FRONT|1-1_LEFT|3-4_FRONT)")],
    "daikin-altherma-3-h-ht-f-unidade-interior": [("b2c", r"^0[013]_Packshot_EHVX_(1-1_FRONT|1-1_LEFT|3-4_FRONT)")],
    "daikin-altherma-3-r-erga-unidade-exterior": [("ERGA-EVH", r"^ERGA-EVH\(7\)_[FLR]\."), ("ERGA-EV", r"^ERGA-EV_F")],
    "daikin-altherma-3-r-erla-unidade-exterior": [("ERLA-DV37", r"^ERLA\(11-14\)D\(V3_W1\)7_[FLR]\."), ("ERLA-DV", r"^ERLA-DV\.")],
    "daikin-altherma-3-r-ech2o-ehsx-unidade-interior": [("b2c", r"^0[013]_Packshot_EHSXB-E_(1-1_FRONT|1-1_LEFT|3-4_FRONT)", {"aviso": BIV})],
    "daikin-altherma-3-r-ech2o-bivalente-ehsxb-unidade-interior": [("b2c", r"^0[013]_Packshot_EHSXB-E_(1-1_FRONT|1-1_LEFT|3-4_FRONT)")],
    "daikin-altherma-3-r-ech2o-ebsx-unidade-interior": [("b2c", r"^0[013]_Packshot_EHSXB-E_(1-1_FRONT|1-1_LEFT|3-4_FRONT)", {"aviso": "foto da EHSXB (mesma carcaça, bivalente)"})],
    "daikin-altherma-3-r-ech2o-bivalente-ebsxb-unidade-interior": [("b2c", r"^0[013]_Packshot_EHSXB-E_(1-1_FRONT|1-1_LEFT|3-4_FRONT)", {"aviso": "foto da EHSXB (mesma carcaça)"})],
    "daikin-altherma-3-r-w-ehbx-unidade-interior": [("EHBX-E6V", r"^EHB-E_[FLR]\.")],
    "daikin-altherma-3-r-w-ebbx-unidade-interior": [("EBBX-D6V", r"^EBB-D_[FLR]\.")],
    "daikin-altherma-3-r-f-ehvx-unidade-interior": [("b2c", r"^0[013]_Packshot_EHVX_(1-1_FRONT|1-1_LEFT|3-4_FRONT)")],
    "daikin-altherma-3-r-f-ebvx-unidade-interior": [("b2c", r"^0[013]_Packshot_EHVX_(1-1_FRONT|1-1_LEFT|3-4_FRONT)", {"aviso": "foto da EHVX (mesma carcaça)"})],
    "daikin-altherma-3-r-f-mini": [("url", "https://my.daikin.eu/content/dam/b2c/portugal/imagens/products/erla-mini/ehfh_1x1-front.jpg", "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/heat-pumps/air-to-water-heat-pumps/daikin-altherma-3-r-f-mini.html"),
                                   ("url", "https://my.daikin.eu/content/dam/b2c/portugal/imagens/products/erla-mini/ehfh_3x4-front.jpg", "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/heat-pumps/air-to-water-heat-pumps/daikin-altherma-3-r-f-mini.html"),
                                   ("EHFH-D3V", r"^EHFH\(Z\)-D3V"),
                                   ("url", "https://my.daikin.eu/content/dam/b2c/portugal/imagens/products/erla-mini/erlamini-1_1-front.jpg", "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/heat-pumps/air-to-water-heat-pumps/daikin-altherma-3-r-f-mini.html")],
    "daikin-altherma-3-m": [("b2c", r"^04_Packshot_EBLA09_(1-1_FRONT|1-1_LEFT|3-4_FRONT)")],
    "daikin-altherma-3-geo": [("b2c", r"^0[013]_Packshot_EGSAX-D9W_(1-1_FRONT|1-1_LEFT|3-4_FRONT)")],
    "daikin-altherma-3-ws": [("EWSAX-D9W", r"^EWSA\(H_X\)-\(U\)D9W_R")],
    # --- Altherma HPC ----------------------------------------------------------------------------------
    "daikin-altherma-hpc-de-chao": [("FWXV-A", r"^FWXV-A\."), ("b2c", r"^0[03]_Packshot_FWXV-ATV3_(1-1|3-4)_FRONT")],
    "daikin-altherma-hpc-de-chao-ligacoes-a-direita": ["@daikin-altherma-hpc-de-chao"],
    "daikin-altherma-hpc-encastrado": [("FWXM-ATV3", r"^FWXM-ATV3_[FLR]\.")],
    "daikin-altherma-hpc-encastrado-ligacoes-a-direita": [("FWXM-ATV3R", r"^FWXM-ATV3R_[FLR]\.")],
    "daikin-altherma-hpc-mural": [("FWXT-ATV3", r"^FWXT-ATV3(_[FL])?\.")],
    "daikin-altherma-hpc-mural-ligacoes-a-direita": ["@daikin-altherma-hpc-mural"],
    # --- AQS -----------------------------------------------------------------------------------------
    "daikin-altherma-m-aqs-performance-solar": [("EKHHE-PCV37", r"^EKHHE200PCV37_[FLR]\.", {"aviso": "foto do EKHHE200PCV37 (Altherma M HW)"})],
    "daikin-altherma-m-aqs-performance": [("EKHHE-CV37", r"^EKHHE200CV37_[FLR]\.", {"aviso": "foto do EKHHE200CV37 (Altherma M HW)"})],
    "daikin-altherma-m-aqs-comfort": [("EKHLE-CV3", r"^EKHLE200CV3_[FLR]\.")],
    "daikin-multi-de-parede-ekhwet-deposito": [("EKHWET-BV3", r"^EKHWET-BV3_(front|left|right)")],
    "daikin-multi-de-chao-ckhws-deposito": [("CKHWS-BV3", r"^CKHWS")],
    "daikin-pressurizado-ekhwsp-deposito": [("EKHWSP-D3V3", r"^EKHWSP-D3V3\."),
                                            ("url", "https://my.daikin.eu/content/dam/b2c/portugal/imagens/products/03_Packshot_EKHWSP_3-4_FRONT.jpg",
                                             "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories.html")],
    "daikin-ech2o-performance-deposito": [("EKHWP-B", r"^EKHWP-B\."),
                                          ("EKHWP-B", r"^EKHWP300B_EKSRPS3_[FL]", {"aviso": "com a estação solar EKSRPS3"})],
    "daikin-ech2o-performance-solar-pressurizado-deposito": [("EKHWP-PB", r"^EKHWP[35]00PB_EKSRPS3_R", {"aviso": "com a estação solar EKSRPS3"})],
    "daikin-ech2o-comfort-deposito": [("EKHWCH-B", r"^EKHWCH300B")],
    "daikin-ech2o-comfort-solar-pressurizado-deposito": [("EKHWCH-PB", r"^EKHWCH300PB")],
    "daikin-ech2o-comfort-dh-deposito": [("EKHWDH-B", r"^EKHWDH500B")],
    "daikin-ech2o-comfort-db-deposito": [("EKHWDB-B", r"^EKHWDB500B")],
    "daikin-ech2o-comfort-solar-deposito": [("EKHWC-B", r"^EKHWC500B")],
    "daikin-ech2o-comfort-bivalente-deposito": [("EKHWCB-B", r"^EKHWCB500B\.")],
    "daikin-ech2o-comfort-bivalente-solar-pressurizado-deposito": [("EKHWCB-PB", r"^EKHWCB500PB")],
    # --- Caldeiras -----------------------------------------------------------------------------------
    "daikin-caldeira-altherma-3-cw-combi": [("D2CND-A1A", r"^D2CND-A1A(_[FL])?\.")],
    "daikin-caldeira-altherma-3-cw": [("D2TND-A4A", r"^D2TND-A4A(_[FL])?\.")],
    # --- Ventilação ----------------------------------------------------------------------------------
    "daikin-ducobox-energy-sky": [("b2c", r"^00_PACKSHOT_Duco_1-1_(front_BLUE|left_BLUE|right)")],
    "daikin-ducobox-energy-premium": [("b2c", r"^03_Packshot_DUCO%20Energy%20Premium_3-4")],
    "daikin-ducobox-energy-comfort": [("b2c", r"^03_Cold_Packshot_DUCO_3-4_FRONT", {"aviso": "DucoBox Energy Comfort da página de ventilação (modelo não indicado)"}),
                                       ("b2c", r"^03_Packshot_DUCO%20Energy%20Premium_3-4", {"aviso": "foto da DucoBox Energy Premium (a página da Comfort usa-a)"})],
    "daikin-ducobox-energy-comfort-plus": [("b2c", r"^03_Cold_Packshot_DUCO_3-4_FRONT", {"aviso": "DucoBox Energy Comfort da página de ventilação (modelo não indicado)"}),
                                       ("b2c", r"^03_Packshot_DUCO%20Energy%20Premium_3-4", {"aviso": "foto da DucoBox Energy Premium (a página da Comfort Plus usa-a)"})],
    "daikin-vam-j8": [("VAM-J8", r"^VAM350-500J8_(Front|Left|Right)_Product"), ("VAM-J8", r"^VAM1500-2000J8_F")],
    "daikin-vam-j8-com-comando-e-sensor-co2": [("VAM-J8", r"^VAM350-500J8_(Front|Left)_Product")],
    "daikin-vam-fc9": [("VAM-FC9", r"^VAM150-250FC9")],
    "daikin-modulo-dx-ekvdx-a": [("EKVDX-A", r"^EKVDX50A(\.|_Air%20intake%20side_R)")],
    "daikin-vkm-jm": [("VKM-JM", r"^VKM-JM-[FLR]-")],
    "daikin-compact-l-pro": [("ALB-RB", r"^ALB-RB_[FLR]\.", {"aviso": "foto da Compact L (série ALB-RB)"})],
    "daikin-compact-l-pro-com-bateria-de-agua": [("ALB-RB", r"^ALB-RB_[FL]\.", {"aviso": "foto da Compact L (série ALB-RB)"})],
    "daikin-compact-l-smart": [("ALB-RB", r"^ALB-RB_[FL]\.", {"aviso": "foto da Compact L (série ALB-RB)"})],
    # --- Rooftops / chillers -------------------------------------------------------------------------
    "daikin-rooftop-base": [("UATYA-BBAY1", r"^UATYA(25-30|80-120)BBAY1")],
    "daikin-rooftop-fc2": [("UATYA-BFC2Y1", r"^UATYA(25-30|80-120)BFC2Y1")],
    "daikin-rooftop-fc3": [("UATYA-BFC3Y1", r"^UATYA(25-30|80-120)BFC3Y1")],
    "daikin-mini-chiller-ewaa": [("EWAA-DV3P", r"^EW\(A-Y\)A004-008DV3P_[FLR]")],
    "daikin-mini-chiller-bomba-de-calor-ewya": [("EWYA-DV3P", r"^EW\(A-Y\)A004-008DV3P_[FLR]")],
    "daikin-ewat-czp": [("EWAT-CZP", r"^EWAT(-CZ_R|032CZ_)")],
    "daikin-bomba-de-calor-ewyt-czp": [("EWYT-CZP", r"^EWYT(-CZ_R|032CZ_)")],
    "daikin-bomba-de-calor-70-c-ewye-czp": [("EWYE-CZP", r"^EWYE-CZ(_2|_3)?\.")],
    "daikin-ewak-czp-r-290": [("EWAK-CZP", r"^(EWA\(Y\)K-CZ_Vista_01|Vista_0[12])")],
    "daikin-bomba-de-calor-ewyk-czp-r-290": [("EWYK-CZP", r"^(EWA\(Y\)K-CZ_Vista_01|Vista_0[12])")],
    "daikin-scroll-ewat-b": [("EWAT-B-SS", r"^EWAT-B_(SingleV_[LR]|MultiV_Blue_L)")],
    "daikin-bomba-de-calor-multi-scroll-ewyt-b": [("EWYT-B-SS", r"^EWYT-B_(6-FAN_[FR]|14-FAN_L)")],
    "daikin-agua-agua-ewwq-kcw1n": [("EWWQ-KC", r"_hydracube_modulo_0[12]")],
    # --- Ventiloconvectores --------------------------------------------------------------------------
    "daikin-fwz-at": [("FWZ-AT", r"^FWZ-AT(_floor)?\.")],
    "daikin-fwr-at": [("FWR-AT", r"^FWR-AT(_AF_ceiling)?\.")],
    "daikin-fws-at": [("FWS-AT", r"^FWS-AT(_AF_ceiling)?\.")],
    "daikin-fwq-at": [("FWQ-A", r"^FWQ-A_1")],
    "daikin-fwp-ct": [("FWP-CTN", r"^FW\(B-P\)-C")],
    "daikin-fwb-ct": [("FWB-CTN", r"^FW\(B-P\)-C")],
    "daikin-fwn-at": [("FWN-AT", r"^FWN-AT_AF_(ceiling|floor)")],
    "daikin-fwv-dt": [("FWV-DAT", r"^FWV02CATN6V3_packright", {"aviso": "FWV-C (modelo anterior)"})],
    "daikin-fwl-dt": [("FWL-DAT", r"^FWL03CATN6V3_(ceiling|floor)", {"aviso": "FWL-C (modelo anterior)"})],
    "daikin-fwm-dt": [("FWM-DAT", r"^FWM01C_(ceiling|floor)", {"aviso": "FWM-C (modelo anterior)"})],
    "daikin-fwe-dt": [("FWE-DATN5V3-L", r"^FWE-DA\(F-N\)")],
    "daikin-fwe-ft": [("FWE-FT", r"^FWE-F\.")],
    "daikin-fwd-at": [("FWD-AT", r"^FWD04A_(ceiling|floor)_packright")],
    "daikin-cassete-fwf-bt": [("FWF-BT", r"^FWF-BT_BF_packright")],
    "daikin-cassete-fwc-bt": [("FWC-BT", r"^FWC-BT_BF_packright")],
    "daikin-cassete-fwf-dt": [("FWF-D", r"^FWF-D_packshot2025")],
    "daikin-cassete-fwc-dt": [("FWC-DT", r"^FWC-D_(white|black)")],
    "daikin-fwt-ht": [("FWT-HT", r"^FWT-HTV_[FR]")],
    "daikin-r-cycle": [("RRDQ-V1", r"^RRDQ220V1_[FLR]")],
    # --- Acessórios com página própria no daikin.pt --------------------------------------------------
    "daikin-brc1h52w7-comando": [("BRC1H52W7", r"^BRC1H52W7(_F)?\.", {"cor": "branco"}),
                                 ("BRC1H52K7", r"^BRC1H52K7(_F)?\.", {"cor": "preto"}),
                                 ("BRC1H52S7", r"^BRC1H52S7(_F)?\.", {"cor": "cinzento"})],
    "daikin-brc1kpd51w-comando": [("BRC1KPD51W", r"^BRC1KPD51W_[FL]\.png", {"cor": "branco"}),
                                  ("BRC1KPD51K", r"^BRC1KPD51K_[FL]\.png", {"cor": "preto"})],
    "daikin-brc1hhd-comando": [("b2c", r"^00_Packshot_BRC1HHDW_1-1_FRONT", {"cor": "branco"}),
                               ("b2c", r"^00_Packshot_BRC1HHDS_1-1_FRONT", {"cor": "prateado"}),
                               ("b2c", r"^00_Packshot_BRC1HHDK_1-1_FRONT", {"cor": "preto"})],
    "daikin-brp069c81-comando": [("BRP069C81", r"^BRP069C81(_F\.|\.jpg)")],
    "daikin-brp069c82-acessorio": [("BRP069C82", r"^BRP069C82(_F\.|\.jpg)")],
    "daikin-brp069b42-comando": [("BRP069B42", r"^BRP069B42_(F|FL)\.")],
    "daikin-brp069a61-acessorio": [("BRP069A61", r"^BRP069A61_[FL]\.")],
    "daikin-brp069a78-acessorio": [("BRP069A78", r"^BRP069A78\.")],
    "daikin-dcs302c51-comando": [("DCS302C51", r"^DCS302C51_F")],
    "daikin-dcs301b51-comando": [("DCS301B51", r"^DCS301B51\.")],
    "daikin-dcm601b51-acessorio": [("DCM601B51", r"^DCM601B51(_F)?\.")],
    "daikin-dcs601c51-acessorio": [("DCS601C51", r"^DCS601C51\.")],
    "daikin-brc1e53a-comando": [("BRC1E53A", r"^BRC1E53A-B-C_F_Product")],
    "daikin-bycq140egf-acessorio": [("BYCQ140EGF", r"^BYCQ140EG\(F\)_Frontal", {"cor": "branco"}),
                                    ("FCAG-B", r"^BYCQ140EGFB_R", {"cor": "preto", "aviso": "painel montado na UI"})],
    "daikin-bycq140ew-acessorio": [("BYCQ140EW", r"^BYCQ140EW_Frontal", {"cor": "branco"})],
    "daikin-bycq140ep-acessorio": [("FXFA-A", r"^FXFA-A_BYCQ140EPB_R", {"cor": "preto", "aviso": "painel montado numa UI VRV"})],
    "daikin-byfq60c-acessorio": [("BYFQ60CW", r"^BYFQ60CW\.", {"cor": "branco"}),
                                 ("FWF-D", r"^BYFQ60CS\.", {"cor": "cinzento"})],
    "daikin-byfq60b3-acessorio": [("BYFQ60B3", r"^BYFQ60B3\.")],
    "daikin-byfq60c-ekrp1cas5a-acessorio": ["@daikin-byfq60c-acessorio"],
    "daikin-bycq140e-cor-ekrp1cas5a-acessorio": ["@daikin-bycq140ew-acessorio"],
}

# Conjuntos Sky Air: UI da gama + UE do sufixo.
for ui, nomes in {
    "daikin-round-flow-fcag-unidade-interior": ("daikin-round-flow-fcag", ("alpha", "rxm", "advance", "active")),
    "daikin-totalmente-plana-ffa-unidade-interior": ("daikin-totalmente-plana-ffa", ("alpha", "rxm")),
    "daikin-a-vista-fua-unidade-interior": ("daikin-a-vista-fua", ("alpha", "advance")),
    "daikin-horizontal-a-vista-fha-unidade-interior": ("daikin-horizontal-a-vista-fha", ("alpha", "rxm", "advance", "active")),
    "daikin-sky-air-faa-unidade-interior": ("daikin-sky-air-faa", ("alpha", "advance", "active")),
    "daikin-fba-unidade-interior": ("daikin-fba", ("alpha", "rxm", "advance", "active")),
    "daikin-adea-unidade-interior": ("daikin-adea", ("active",)),
    "daikin-fna-unidade-interior": ("daikin-fna", ("alpha", "rxm")),
    "daikin-fda-unidade-interior": ("daikin-fda", ("alpha", "advance")),
    "daikin-armario-vertical-fva-unidade-interior": ("daikin-armario-vertical-fva", ("alpha", "advance", "active")),
}.items():
    base, sufixos = nomes
    for s in sufixos:
        SEL.setdefault(f"{base}-{s}", [f"@{ui}", UI_UE[s]])
# Kits solares: foto do coletor da orientação/tamanho do kit.
for g in json.loads((OUT / "alvos.json").read_text())["grupos"]:
    k = g["grupoModelo"]
    m = re.match(r"daikin-solar-(drain-back|pressurizado)-coletor-(vertical|horizontal)-(2-1|2-6)-m", k)
    if m:
        serie = "EKSV" if m.group(2) == "vertical" else "EKSH"
        SEL[k] = [(f"{serie}-P", rf"^{serie}{m.group(3).replace('-', '')}P\.")]


def _b2c_index():
    idx = {}
    for pagina, imgs in HUB.items():
        for p in imgs:
            p = p.replace("\\u002D", "-")
            nome = p.split("/")[-1]
            url = "https://www.daikin.pt/pt_pt/" + pagina.replace("__", "/")
            idx.setdefault(nome, (p, url))
    return idx


B2C = _b2c_index()


def _url_ficheiro(p: str) -> str:
    p = p.replace("\\/", "/")
    base = "https://my.daikin.eu/" + p
    if p.endswith(".tif"):
        return base + "/_jcr_content/renditions/cq5dam.web.1280.1280.jpeg"
    return base


def _resolver(entrada) -> list[dict]:
    if entrada[0] == "url":                         # ficheiro direto (b2c por país)
        return [{"src": entrada[1], "origemUrl": entrada[2]}]
    pagina, rx, *extra = entrada
    extra = extra[0] if extra else {}
    out = []
    if pagina == "b2c":
        for nome in sorted(B2C):
            if re.search(rx, nome):
                p, url = B2C[nome]
                out.append({"src": _url_ficheiro(p), "origemUrl": url, **extra})
    else:
        pag = SONDAS[pagina]
        vistos = set()
        for p in pag["imgs"]:
            nome = p.split("/")[-1]
            if nome in vistos or not re.search(rx, nome):
                continue
            vistos.add(nome)
            out.append({"src": _url_ficheiro(p),
                        "origemUrl": f"https://www.daikin.pt/pt_pt/products/product.html/{pagina}.html", **extra})
    if not out:
        print(f"  ⚠ nada para {pagina} {rx}", file=sys.stderr)
    return out


def expandir(grupo: str, pilha=()) -> list[dict]:
    fotos = []
    for e in SEL[grupo]:
        if isinstance(e, str):
            fotos += expandir(e[1:], pilha + (grupo,))
        else:
            fotos += _resolver(e)
    return fotos


def descarregar(url: str, destino: Path) -> bool:
    destino.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["curl", "-sL", "--max-time", "60", "-A", "Mozilla/5.0", "-o", str(destino),
                        "-w", "%{http_code}", url], capture_output=True, text=True)
    if r.stdout == "200" and destino.stat().st_size > 5000:
        return True
    if ".tif/_jcr_content" in url:                  # o regex das sondas corta ".tiff" em ".tif"
        return descarregar(url.replace(".tif/_jcr_content", ".tiff/_jcr_content"), destino)
    return False


def main():
    if "--seco" in sys.argv:
        alvos = {g["grupoModelo"]: g for g in json.loads((OUT / "alvos.json").read_text())["grupos"]}
        for grupo in SEL:
            if grupo in alvos:
                print(len(expandir(grupo)), grupo)
        sem = [k for k, g in alvos.items() if not g["acessorio"] and k not in SEL]
        print("sem seleção:", sem)
        return
    alvos = {g["grupoModelo"] for g in json.loads((OUT / "alvos.json").read_text())["grupos"]}
    cache: dict[str, str] = {}                      # url → ficheiro já descarregado
    cand = {}
    for grupo in SEL:
        if grupo not in alvos:
            continue
        lista, n = [], 0
        for f in expandir(grupo):
            if any(x["_src"] == f["src"] for x in lista):
                continue
            n += 1
            ext = ".png" if f["src"].endswith(".png") else ".jpg"
            # acessórios: o procurar-ref.mjs já escreve NN.jpg nessas pastas
            prefixo = "site-" if re.search(r"-(acessorio|comando)$", grupo) else ""
            rel = f"{grupo}/{prefixo}{n:02d}{ext}"
            dest = OUT / rel
            if f["src"] in cache and not dest.exists():
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes((OUT / cache[f["src"]]).read_bytes())
            elif not dest.exists() and not descarregar(f["src"], dest):
                print(f"  ✗ {grupo}: {f['src']}", file=sys.stderr)
                dest.unlink(missing_ok=True)
                n -= 1
                continue
            cache.setdefault(f["src"], rel)
            item = {"ficheiro": rel, "fonte": "site", "origemUrl": f["origemUrl"], "_src": f["src"]}
            for k in ("cor", "aviso"):
                if f.get(k):
                    item[k] = f[k]
            lista.append(item)
        cand[grupo] = [{k: v for k, v in x.items() if k != "_src"} for x in lista]
        print(f"{grupo}: {len(lista)}")
    (OUT / "candidatas-site.json").write_text(json.dumps(cand, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
