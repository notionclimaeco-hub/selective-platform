"""Daikin: o que cada ref é (componente, gama, tipo de unidade, série, cor).

As refs Daikin repetem-se por muitas páginas (a mesma UE RZAG71NV1 aparece
em todas as tabelas Sky Air; a UI FTXM35A no conjunto e na lista de UI multi),
por isso a classificação vive aqui, pela ref, e não secção a secção. A secção
dá o resto (família, segmento, sistema) e pode restringir as regras com
`regras: ["ac-domestico", …]`.

`classificar(ref, seccao)` → dict com `componente` e o que a ref decide
(`gama`, `tipoUnidade`, `serie`, `cor`, `fases`, `familia`, `sistema`,
`segmento`), ou None quando a ref não é um equipamento conhecido (acessório
de uma lista "Ref | Descrição | Preço").
"""
from __future__ import annotations

import re

# Cor pelo sufixo da ref (Emura FTXJ-AW/AS/AB, Stylish FTXA-CW/CS/CB e os
# painéis D: DP madeira clara, DY madeira escura, DL pele castanho escuro,
# DG tecido cinzento, DC tecido azul — p16).
COR_EMURA = {"W": "branco", "S": "prateado", "B": "preto"}
COR_STYLISH = {"CW": "branco", "CS": "prateado", "CB": "preto", "DP": "madeira-clara",
               "DY": "madeira-escura", "DL": "castanho", "DG": "cinzento", "DC": "azul"}

# Série Sky Air pelo sufixo do conjunto (unidade exterior): _AV/_ANV/_ANY = Alpha
# (RZAG), _ASV/_ASY = Advance (RZASG), _AZV/_AZY = Active (AZAS), _RXMR/_ARX =
# exterior Perfera (RXM/ARXM).
SERIE_SKY_AIR = (
    (re.compile(r"_A?N?[VY]$|_AV$"), "Alpha"),
    (re.compile(r"_AS[VY]$"), "Advance"),
    (re.compile(r"_AZA?[VY]$"), "Active"),
    (re.compile(r"_(RXMR?|ARX)$"), "RXM"),
    (re.compile(r"_RZAD$"), "RZA-D"),
)


def _serie_sky_air(ref: str) -> str | None:
    for rx, serie in SERIE_SKY_AIR[1:]:
        if rx.search(ref):
            return serie
    return "Alpha" if SERIE_SKY_AIR[0][0].search(ref) else None


def _r(rx: str, **kw) -> tuple[re.Pattern, dict]:
    return re.compile(rx), kw


def _litros(ref: str) -> dict:
    """Volume do depósito no código Daikin (EKHWSP150…, CKHWS230…, SB.EK260PCV…,
    EPSX10P30A → 300, EPVX10S18A → 180); a tabela imprime o mesmo valor na coluna
    "Volume"/"Depósito AQS"."""
    m = re.search(r"[PS](\d{2})[ADE]", ref.replace("SB.", ""))
    if m and re.match(r"^E[PTHB][SV]X", ref):
        return {"deposito-l": str(int(m.group(1)) * 10)}
    m = re.match(r"^(?:SB\.)?[A-Z]+?(\d{2,3})(?=[A-Z])", ref)
    return {"deposito-l": str(int(m.group(1)))} if m else {}


def _ui_altherma(ref: str) -> dict:
    """UI Altherma: classe de potência do modelo ("Classes 4-6-8" no título da
    página: EPSX10… = classe 10), depósito integrado (P30 = 300 L, S18 = 180 L) e
    a resistência de apoio (…4V/6V monofásica, …9W trifásica)."""
    out: dict[str, str] = {}
    m = re.match(r"^[A-Z]+?(\d{2})", ref)
    if m:
        out["classe-kw"] = str(int(m.group(1)))
    out.update(_litros(ref) if re.search(r"[PS]\d{2}[ADE]", ref) else {})
    if re.search(r"\dW\d?$", ref):
        out["alimentacao"] = "trifasica"
    elif re.search(r"\dV\d?$", ref) or ref.endswith(("4V", "6V")):
        out["alimentacao"] = "monofasica"
    return out


COLETOR = {"V21": "Coletor Vertical 2,1 m²", "V26": "Coletor Vertical 2,6 m²", "H26": "Coletor Horizontal 2,6 m²"}
COBERTURA = {"FP": "Cobertura Plana", "FI": "Cobertura Inclinada", "": "Sem Estrutura"}


def _gama_kit_solar(ref: str) -> str:
    """SB.EKSV26P/3DBFP = coletor vertical 2,6 m², 3 coletores, Drain-Back, cobertura plana
    (os títulos dos blocos nas p96-97 dizem o mesmo)."""
    m = re.match(r"^SB\.EKS([VH]\d\d)P/\d(DB|P)(FP|FI)?$", ref)
    if not m:
        return "Solar"
    sistema = "Drain-Back" if m.group(2) == "DB" else "Pressurizado"
    return f"Solar {sistema} {COLETOR[m.group(1)]} {COBERTURA[m.group(3) or '']}"


def _coletores(ref: str) -> dict:
    m = re.match(r"^SB\.EKS[VH]\d\dP/(\d)", ref)
    return {"coletores": m.group(1)} if m else {}


def _cesi(ref: str) -> dict:
    """CESI 300 Plus / 500 Max: depósito ECH2O de 300/500 L (coluna "Volume")."""
    m = re.match(r"^SB\.EKSP(\d)", ref)
    return {"deposito-l": {"3": "300", "5": "500"}[m.group(1)]} if m and m.group(1) in "35" else {}


def _uta(ref: str) -> dict:
    """UTA Compact: tamanho no código (ARB03RAM = tamanho 3) e o lado das ligações
    (R direita / L esquerda, as colunas DIREITA/ESQUERDA da tabela)."""
    m = re.match(r"^(?:SB\.)?A[RTL]B(\d+)([RL])", ref)
    return {"tamanho": str(int(m.group(1))), "orientacao": "direita" if m.group(2) == "R" else "esquerda"} if m else {}


def _fc(pressao: str | None):
    def derivar(ref: str) -> dict:
        out = {"tubos": "2"}
        if pressao:
            out["pressao-estatica"] = pressao
        out["valvula-3-vias"] = "sim" if re.search(r"(T|DAT)[A-Z]?V|TV|HTVD|TV$", ref) and not ref.endswith("N") else "nao"
        return out
    return derivar


def _kw_caldeira(ref: str) -> dict:
    m = re.match(r"^D2[CT]ND0?(\d{2})", ref)            # D2CND024A1A = 24 kW (coluna "Potência Nominal")
    return {"calor-kw": str(int(m.group(1)))} if m else {}


DOM = {"segmento": "domestico", "sistema": "mono-split", "familia": "ar-condicionado"}
COM = {"segmento": "comercial", "sistema": "mono-split", "familia": "ar-condicionado", "fases": True}
UE_DOM = {**DOM, "componente": "unidade-exterior", "tipoUnidade": "exterior"}
UE_COM = {**COM, "componente": "unidade-exterior", "tipoUnidade": "exterior"}
MULTI = {"segmento": "domestico", "sistema": "multi-split", "familia": "ar-condicionado"}
BC_UE = {"segmento": "domestico", "sistema": "bibloco", "familia": "bombas-de-calor",
         "componente": "unidade-exterior", "tipoUnidade": "exterior", "fases": True}
BC_UI = {"segmento": "domestico", "sistema": "bibloco", "familia": "bombas-de-calor",
         "componente": "unidade-interior", "derivar": _ui_altherma}

REGRAS: dict[str, list[tuple[re.Pattern, dict]]] = {
    # --- Gama doméstica (p13-28) ---------------------------------------------------
    "ac-domestico": [
        _r(r"^SB\.FTXZ\d", **DOM, componente="conjunto", tipoUnidade="mural", gama="Ururu Sarara"),
        _r(r"^FTXZ\d", **DOM, componente="unidade-interior", tipoUnidade="mural", gama="Ururu Sarara"),
        _r(r"^RXZ\d", **UE_DOM, gama="RXZ"),
        _r(r"^SB\.FTXJ\d", **DOM, componente="conjunto", tipoUnidade="mural", gama="Emura", cor="emura"),
        _r(r"^FTXJ\d", **DOM, componente="unidade-interior", tipoUnidade="mural", gama="Emura", cor="emura"),
        _r(r"^RXJ\d", **UE_DOM, gama="RXJ"),
        _r(r"^SB\.FTXA\d", **DOM, componente="conjunto", tipoUnidade="mural", gama="Stylish", cor="stylish"),
        _r(r"^[FC]TXA\d", **DOM, componente="unidade-interior", tipoUnidade="mural", gama="Stylish", cor="stylish"),
        _r(r"^RXA\d", **UE_DOM, gama="RXA"),
        _r(r"^SB\.FTXM\d+A$", **DOM, componente="conjunto", tipoUnidade="mural", gama="Perfera"),
        _r(r"^[FC]TXM\d+[AR]$", **DOM, componente="unidade-interior", tipoUnidade="mural", gama="Perfera"),
        _r(r"^RXM\d", **UE_DOM, gama="RXM"),
        _r(r"^SB\.FTXP\d", **DOM, componente="conjunto", tipoUnidade="mural", gama="Comfora"),
        _r(r"^FTXP\d", **DOM, componente="unidade-interior", tipoUnidade="mural", gama="Comfora"),
        _r(r"^RXP\d", **UE_DOM, gama="RXP"),
        _r(r"^SB\.FTXF\d", **DOM, componente="conjunto", tipoUnidade="mural", gama="Sensira"),
        _r(r"^FTXF\d", **DOM, componente="unidade-interior", tipoUnidade="mural", gama="Sensira"),
        _r(r"^RXF\d", **UE_DOM, gama="RXF"),
        _r(r"^SB\.FVXM\d", **DOM, componente="conjunto", tipoUnidade="consola", gama="Perfera de Chão"),
        _r(r"^[FC]VXM\d", **DOM, componente="unidade-interior", tipoUnidade="consola", gama="Perfera de Chão"),
        _r(r"^SB\.FDXM\d+_FW_RXMR?$", **DOM, componente="conjunto", tipoUnidade="conduta-baixa-pressao",
           gama="Baixo Perfil FDXM"),
        _r(r"^FDXM\d+F\d?$", **DOM, componente="unidade-interior", tipoUnidade="conduta-baixa-pressao",
           gama="Baixo Perfil FDXM"),
        # Multi-split (p25-28): UE MXM/MXF, UI só para multi (CTXF).
        _r(r"^[2-5]MXM\d", **MULTI, componente="unidade-exterior", tipoUnidade="exterior", gama="Multi MXM"),
        _r(r"^[2-5]MXF\d", **MULTI, componente="unidade-exterior", tipoUnidade="exterior", gama="Multi Sensira MXF"),
        _r(r"^CTXF\d", **MULTI, componente="unidade-interior", tipoUnidade="mural", gama="Multi Sensira"),
        _r(r"^RXYSCQ\d", segmento="comercial", sistema="vrf", familia="ar-condicionado",
           componente="unidade-exterior", tipoUnidade="exterior", gama="Mini VRV Compact", fases=True),
        _r(r"^RXYSQ\d", segmento="comercial", sistema="vrf", familia="ar-condicionado",
           componente="unidade-exterior", tipoUnidade="exterior", gama="Mini VRV", fases=True),
    ],
    # --- UI multi vendidas com painel e comando (p26) ou só com painel (p45) -----
    "multi-kits": [
        _r(r"^SB\.FCAG\d+B?_S?FW$", segmento="comercial", sistema="multi-split", familia="ar-condicionado",
           componente="unidade-interior", tipoUnidade="cassete-4-vias", gama="Round Flow FCAG com Painel e Comando"),
        _r(r"^SB\.FCAG\d+B?_P$", segmento="comercial", sistema="mono-split", familia="ar-condicionado",
           componente="unidade-interior", tipoUnidade="cassete-4-vias", gama="Round Flow FCAG com Painel"),
        _r(r"^SB\.FFA\d+A?_WFW$", segmento="comercial", sistema="multi-split", familia="ar-condicionado",
           componente="unidade-interior", tipoUnidade="cassete-4-vias", gama="Totalmente Plana FFA com Painel e Comando"),
        _r(r"^SB\.FFA\d+A?_W$", segmento="comercial", sistema="mono-split", familia="ar-condicionado",
           componente="unidade-interior", tipoUnidade="cassete-4-vias", gama="Totalmente Plana FFA com Painel"),
        _r(r"^SB\.FHA\d+A?_FW$", segmento="comercial", sistema="multi-split", familia="ar-condicionado",
           componente="unidade-interior", tipoUnidade="chao-teto", gama="Horizontal à Vista FHA com Comando"),
        _r(r"^SB\.FNA\d+A?_FW$", segmento="comercial", sistema="multi-split", familia="ar-condicionado",
           componente="unidade-interior", tipoUnidade="chao-sem-envolvente", gama="FNA com Comando"),
        _r(r"^SB\.FBA\d+A?_FW$", segmento="comercial", sistema="multi-split", familia="ar-condicionado",
           componente="unidade-interior", tipoUnidade="conduta-media-pressao", gama="FBA com Comando"),
        _r(r"^SB\.FDXM\d+F?_FW$", segmento="comercial", sistema="multi-split", familia="ar-condicionado",
           componente="unidade-interior", tipoUnidade="conduta-baixa-pressao", gama="Baixo Perfil FDXM com Comando"),
    ],
    # --- Kit Multizonas Airzone (p47): plenos por tamanho. ----------------------------
    "multizonas": [
        _r(r"^AZEZ6DAI", segmento="comercial", familia="acessorios-e-controlo", componente="acessorio",
           gama="Kit Multizonas"),
    ],
    # --- Multi+ climatização + AQS (p53) -------------------------------------------
    "multi-plus": [
        _r(r"^[45]MWXM\d+A9$", segmento="domestico", sistema="multi-split", familia="ar-condicionado",
           componente="unidade-exterior", tipoUnidade="exterior", gama="Multi+ MWXM"),
        _r(r"^EKHWET\d+BV3$", segmento="domestico", familia="aqs", componente="deposito",
           tipoUnidade="deposito", gama="Multi+ de Parede EKHWET", derivar=_litros),
        _r(r"^CKHWS\d+BV3$", segmento="domestico", familia="aqs", componente="deposito",
           tipoUnidade="deposito", gama="Multi+ de Chão CKHWS", derivar=_litros),
    ],
    # --- Daikin Altherma (p59-75): UE e UI vendidas à parte; as células das matrizes
    # são a soma das duas (sem ref de conjunto). ECH2O = UI com depósito integrado
    # (B = bivalente), F = UI de chão com depósito, W = hydrobox mural. ------------------
    "altherma": [
        _r(r"^EPSKS?\d+A[VW]", **BC_UE, gama="Altherma 4 H"),
        _r(r"^EPSX\d+P\d+A$", **BC_UI, tipoUnidade="integrada", gama="Altherma 4 H ECH2O"),
        _r(r"^EPSXB\d+P\d+A$", **BC_UI, tipoUnidade="integrada", gama="Altherma 4 H ECH2O Bivalente"),
        _r(r"^EPVX\d+S\d+A", **BC_UI, tipoUnidade="integrada", gama="Altherma 4 H F"),
        _r(r"^EPBX\d+A", **BC_UI, tipoUnidade="modulo-hidraulico", gama="Altherma 4 H W"),
        _r(r"^EPRA\d+D[VW]", **BC_UE, gama="Altherma 3 H HT"),
        _r(r"^ETSX\d+P\d+E", **BC_UI, tipoUnidade="integrada", gama="Altherma 3 H HT ECH2O"),
        _r(r"^ETSXB\d+P\d+E", **BC_UI, tipoUnidade="integrada", gama="Altherma 3 H HT ECH2O Bivalente"),
        _r(r"^ETVX\d+S\d+E", **BC_UI, tipoUnidade="integrada", gama="Altherma 3 H HT F"),
        _r(r"^ETBX\d+E", **BC_UI, tipoUnidade="modulo-hidraulico", gama="Altherma 3 H HT W"),
        _r(r"^ERGA\d+E", **BC_UE, gama="Altherma 3 R ERGA"),
        _r(r"^ERLA\d+D[VW]\d", **BC_UE, gama="Altherma 3 R ERLA"),
        _r(r"^EHSX\d+P\d+E", **BC_UI, tipoUnidade="integrada", gama="Altherma 3 R ECH2O EHSX"),
        _r(r"^EHSXB\d+P\d+E", **BC_UI, tipoUnidade="integrada", gama="Altherma 3 R ECH2O Bivalente EHSXB"),
        _r(r"^EHVX\d+S\d+E", **BC_UI, tipoUnidade="integrada", gama="Altherma 3 R F EHVX"),
        _r(r"^EHBX\d+E", **BC_UI, tipoUnidade="modulo-hidraulico", gama="Altherma 3 R W EHBX"),
        _r(r"^EBSX\d+P\d+D", **BC_UI, tipoUnidade="integrada", gama="Altherma 3 R ECH2O EBSX"),
        _r(r"^EBSXB\d+P\d+D", **BC_UI, tipoUnidade="integrada", gama="Altherma 3 R ECH2O Bivalente EBSXB"),
        _r(r"^EBVX\d+S\d+D", **BC_UI, tipoUnidade="integrada", gama="Altherma 3 R F EBVX"),
        _r(r"^EBBX\d+D", **BC_UI, tipoUnidade="modulo-hidraulico", gama="Altherma 3 R W EBBX"),
        _r(r"^EBLA\d+[DE]\d", segmento="domestico", sistema="monobloco", familia="bombas-de-calor",
           componente="conjunto", tipoUnidade="exterior", gama="Altherma 3 M", fases=True),
        _r(r"^SB\.EHFH\d", segmento="domestico", sistema="bibloco", familia="bombas-de-calor",
           componente="conjunto", tipoUnidade="integrada", gama="Altherma 3 R F Mini"),
        _r(r"^EGSAX\d", segmento="domestico", familia="bombas-de-calor", componente="conjunto",
           tipoUnidade="integrada", gama="Altherma 3 GEO"),
        _r(r"^EWSAX\d", segmento="domestico", familia="bombas-de-calor", componente="conjunto",
           tipoUnidade="integrada", gama="Altherma 3 WS"),
    ],
    # --- Daikin Altherma HPC, ventiloconvectores para bombas de calor (p79) ---------
    "hpc": [
        # "*" na tabela: versão com ligações hidráulicas à direita (…R, mural …CL).
        *[_r(rx, segmento="domestico", familia="ventiloconvectores", componente="conjunto", tipoUnidade=tipo,
             gama=gama, rotulo="Ventiloconvector") for rx, tipo, gama in (
            (r"^FWXV\d+ABTV3R$", "consola", "Altherma HPC de Chão Ligações à Direita"),
            (r"^FWXV\d+ABTV3$", "consola", "Altherma HPC de Chão"),
            (r"^FWXM\d+ATV3R$", "conduta", "Altherma HPC Encastrado Ligações à Direita"),
            (r"^FWXM\d+ATV3$", "conduta", "Altherma HPC Encastrado"),
            (r"^FWXT\d+ABTV3CL$", "mural", "Altherma HPC Mural Ligações à Direita"),
            (r"^FWXT\d+ABTV3C$", "mural", "Altherma HPC Mural"))],
    ],
    # --- AQS (p86-89) ----------------------------------------------------------------
    "aqs": [
        _r(r"^SB\.EK\d+PCV", segmento="domestico", sistema="monobloco", familia="aqs", componente="conjunto",
           tipoUnidade="monobloco-aqs", gama="Altherma M AQS Performance Solar", derivar=_litros),
        _r(r"^SB\.EK\d+CV", segmento="domestico", sistema="monobloco", familia="aqs", componente="conjunto",
           tipoUnidade="monobloco-aqs", gama="Altherma M AQS Performance", derivar=_litros),
        _r(r"^SB\.EKHLE\d+CV", segmento="domestico", sistema="monobloco", familia="aqs", componente="conjunto",
           tipoUnidade="monobloco-aqs", gama="Altherma M AQS Comfort", derivar=_litros),
        _r(r"^EKHWSP\d+D3V3$", segmento="domestico", familia="aqs", componente="deposito",
           tipoUnidade="deposito", gama="Pressurizado EKHWSP", derivar=_litros),
        # ECH2O: uma gama por série (as linhas distinguem-se pelas serpentinas, não por
        # um valor): P…B = bomba de calor, …PB = + solar pressurizado, CH = caldeira,
        # CB = caldeira + 2.ª serpentina, DH/DB = sem Drain-Back, C = só solar.
        *[_r(rf"^{serie}\d+{suf}$", segmento="domestico", familia="aqs", componente="deposito",
             tipoUnidade="deposito", gama=gama, derivar=_litros) for serie, suf, gama in (
            ("EKHWP", "B", "ECH2O Performance"), ("EKHWP", "PB", "ECH2O Performance Solar Pressurizado"),
            ("EKHWCH", "B", "ECH2O Comfort"), ("EKHWCH", "PB", "ECH2O Comfort Solar Pressurizado"),
            ("EKHWCB", "B", "ECH2O Comfort Bivalente"), ("EKHWCB", "PB", "ECH2O Comfort Bivalente Solar Pressurizado"),
            ("EKHWDH", "B", "ECH2O Comfort DH"), ("EKHWDB", "B", "ECH2O Comfort DB"), ("EKHWC", "B", "ECH2O Comfort Solar"))],
    ],
    # --- Solar térmico Daikin Altherma ST (p93-97) -----------------------------------
    "solar": [
        _r(r"^SB\.EKSP\d", segmento="domestico", familia="aqs", componente="conjunto",
           gama="Solar CESI Drain-Back", rotulo="Conjunto", derivar=_cesi),
        _r(r"^SB\.EKS[VH]\d\dP/\d", segmento="domestico", familia="aqs", componente="conjunto",
           gama=_gama_kit_solar, rotulo="Conjunto", derivar=_coletores),
    ],
    # --- Ventilação (p104-121) ----------------------------------------------------------
    "ventilacao": [
        _r(r"^SB\.VAM\d+_FW_CO2$", segmento="comercial", familia="ventilacao", componente="conjunto",
           tipoUnidade="recuperador-de-calor", gama="VAM-J8 com Comando e Sensor CO2"),
        _r(r"^VAM\d+J8$", segmento="comercial", familia="ventilacao", componente="conjunto",
           tipoUnidade="recuperador-de-calor", gama="VAM-J8"),
        _r(r"^VAM\d+FC9$", segmento="comercial", familia="ventilacao", componente="conjunto",
           tipoUnidade="recuperador-de-calor", gama="VAM-FC9"),
        _r(r"^EKVDX\d+A$", segmento="comercial", familia="ventilacao", componente="conjunto",
           tipoUnidade="uta", gama="Módulo DX EKVDX-A", rotulo=""),
        _r(r"^VKM\d+JM", segmento="comercial", familia="ventilacao", componente="conjunto",
           tipoUnidade="recuperador-de-calor", gama="VKM-JM"),
        _r(r"^ERA\d+A[VY]F?$", segmento="comercial", sistema="vrf", familia="ar-condicionado",
           componente="unidade-exterior", tipoUnidade="exterior", gama="ERA para UTA", fases=True),
        # UTA Compact: direita (R) e esquerda (L) com o mesmo preço; NS = recuperador de
        # adsorção (Compact R), BS/BM = Smart/Pro (Compact T), CS/CM/CMW (Compact L).
        _r(r"^ARB\d+[RL]AM(NS)?$", segmento="comercial", familia="ventilacao", componente="conjunto",
           tipoUnidade="uta", gama=lambda r: "Compact R" + (" Adsorção" if r.endswith("NS") else ""),
           derivar=_uta),
        _r(r"^(SB\.)?ATB\d+[RL]B[MS]$", segmento="comercial", familia="ventilacao", componente="conjunto",
           tipoUnidade="uta", gama=lambda r: "Compact T " + ("Pro" if r.endswith("M") else "Smart"),
           derivar=_uta),
        _r(r"^ALB\d+[RL]C(M|MW|S)$", segmento="comercial", familia="ventilacao", componente="conjunto",
           tipoUnidade="uta", gama=lambda r: "Compact L " + {"M": "Pro", "MW": "Pro com Bateria de Água",
                                                             "S": "Smart"}[re.sub(r"^ALB\d+[RL]C", "", r)],
           derivar=_uta),
    ],
    "rooftops": [
        _r(r"^UATYA\d+B[A-Z0-9]+$", segmento="industrial", sistema="rooftop", familia="ar-condicionado",
           componente="conjunto", tipoUnidade="rooftop",
           gama=lambda r: "Rooftop " + {"BBAY1": "BASE", "BFC2Y1": "FC2", "BFC3Y1": "FC3", "BRS4": "RS4"}.get(
               re.sub(r"^UATYA\d+", "", r), re.sub(r"^UATYA\d+", "", r))),
    ],
    # --- Chillers (p126-134) ------------------------------------------------------------
    "chillers": [
        *[_r(rx, segmento="comercial", familia="chillers", componente="conjunto", tipoUnidade="chiller",
             gama=gama, fases=True) for rx, gama in (
            (r"^EWAA\d+D[VW]", "Mini Chiller EWAA"), (r"^EWYA\d+D[VW]", "Mini Chiller Bomba de Calor EWYA"),
            (r"^EWAT\d+CZP", "EWAT-CZP"), (r"^EWYT\d+CZP", "Bomba de Calor EWYT-CZP"),
            (r"^EWYE\d+CZP", "Bomba de Calor 70 °C EWYE-CZP"), (r"^EWAK\d+CZP", "EWAK-CZP R-290"),
            (r"^EWYK\d+CZP", "Bomba de Calor EWYK-CZP R-290"), (r"^EWAT\d+B-", "Scroll EWAT-B"),
            (r"^EWYT\d+B-", "Bomba de Calor Multi-Scroll EWYT-B"), (r"^EWWQ\d+KCW1N", "Água-Água EWWQ-KCW1N"))],
    ],
    # --- Ventiloconvectores (p136-144): N = sem válvula, V = com válvula de 3 vias. ----
    "ventiloconvectores": [
        *[_r(rx, segmento="comercial", familia="ventiloconvectores", componente="conjunto", tipoUnidade=tipo,
             gama=gama, rotulo="Ventiloconvector", derivar=_fc(pressao)) for rx, tipo, gama, pressao in (
            (r"^FWZ\d+AT", "consola", "FWZ-AT", None), (r"^FWR\d+AT", "chao-teto", "FWR-AT", None),
            (r"^FWS\d+AT", "conduta", "FWS-AT", "baixa"), (r"^FWQ\d+AT", "conduta", "FWQ-AT", "media"),
            (r"^FWP\d+CT", "conduta", "FWP-CT", "media"), (r"^FWN\d+AT", "conduta", "FWN-AT", "alta"),
            (r"^FWV\d+DT", "consola", "FWV-DT", None), (r"^FWL\d+DT", "chao-teto", "FWL-DT", None),
            (r"^FWM\d+DT", "conduta", "FWM-DT", "baixa"), (r"^FWE\d+DAT", "conduta", "FWE-DT", "baixa"),
            (r"^FWE\d+FT", "conduta", "FWE-FT", "baixa"), (r"^FWE\d+CT", "conduta", "FWE-CT", "media"),
            (r"^FWB\d+CT", "conduta", "FWB-CT", "media"), (r"^FWD\d+AT", "conduta", "FWD-AT", "alta"),
            (r"^FWF\d+BT", "cassete", "Cassete FWF-BT", None), (r"^FWC\d+BT", "cassete", "Cassete FWC-BT", None),
            (r"^FWF\d+DT", "cassete", "Cassete FWF-DT", None), (r"^FWC\d+DT", "cassete", "Cassete FWC-DT", None),
            (r"^FWT\d+HT", "mural", "FWT-HT", None))],
    ],
    # Painel e placa das cassetes de protocolo fechado (p142): preço numa célula fundida
    # a meio das linhas de cada cassete.
    "fc-paineis": [
        _r(r"^(BYFQ60B3|BYCQ140C|EKRP1C11)$", familia="acessorios-e-controlo", componente="acessorio"),
    ],
    "outros-equipamentos": [
        _r(r"^BR\d{8}$", segmento="comercial", familia="purificadores-de-ar", componente="conjunto",
           tipoUnidade="purificador", gama="Astropure 2000", rotulo="Purificador"),
        _r(r"^MCK?\d+[A-Z]+$", segmento="domestico", familia="purificadores-de-ar", componente="conjunto",
           tipoUnidade="purificador", gama=lambda r: "Streamer " + re.sub(r"\d.*", "", r), rotulo="Purificador"),
        _r(r"^RRDQ\d+V1$", segmento="comercial", familia="outros", componente="conjunto",
           gama="R-Cycle", rotulo="Unidade de Reciclagem de Fluido Frigorigéneo"),
    ],
    # --- Caldeiras a gás Altherma 3 CW (p87) ----------------------------------------
    "caldeiras": [
        _r(r"^D2CND\d+A\dA$", segmento="domestico", familia="outros", componente="conjunto",
           gama="Caldeira Altherma 3 CW Combi", rotulo="", derivar=_kw_caldeira),
        _r(r"^D2TND\d+A\dA$", segmento="domestico", familia="outros", componente="conjunto",
           gama="Caldeira Altherma 3 CW", rotulo="", derivar=_kw_caldeira),
    ],
    # --- Sky Air (p36-46) -------------------------------------------------------------
    "sky-air": [
        _r(r"^SB\.FCAG\d+_FWP?_", **COM, componente="conjunto", tipoUnidade="cassete-4-vias", gama="Round Flow FCAG"),
        _r(r"^FCAG\d+B$", **COM, componente="unidade-interior", tipoUnidade="cassete-4-vias", gama="Round Flow FCAG"),
        _r(r"^SB\.FFA\d+_WFW_", **COM, componente="conjunto", tipoUnidade="cassete-4-vias", gama="Totalmente Plana FFA"),
        _r(r"^FFA\d+A9$", **COM, componente="unidade-interior", tipoUnidade="cassete-4-vias", gama="Totalmente Plana FFA"),
        _r(r"^SB\.FUA\d+_FW_", **COM, componente="conjunto", tipoUnidade="cassete-4-vias", gama="À Vista FUA"),
        _r(r"^FUA\d+A$", **COM, componente="unidade-interior", tipoUnidade="cassete-4-vias", gama="À Vista FUA"),
        _r(r"^SB\.FHA\d+_FW_", **COM, componente="conjunto", tipoUnidade="chao-teto", gama="Horizontal à Vista FHA"),
        _r(r"^FHA\d+A9?$", **COM, componente="unidade-interior", tipoUnidade="chao-teto", gama="Horizontal à Vista FHA"),
        _r(r"^SB\.FAA\d+_FW_", **COM, componente="conjunto", tipoUnidade="mural", gama="Sky Air FAA"),
        _r(r"^FAA\d+[AB]$", **COM, componente="unidade-interior", tipoUnidade="mural", gama="Sky Air FAA"),
        _r(r"^SB\.FTXM\d+A_", **COM, componente="conjunto", tipoUnidade="mural", gama="Perfera Sky Air"),
        _r(r"^SB\.FBA\d+_FW_", **COM, componente="conjunto", tipoUnidade="conduta-media-pressao", gama="FBA"),
        _r(r"^FBA\d+A9?$", **COM, componente="unidade-interior", tipoUnidade="conduta-media-pressao", gama="FBA"),
        _r(r"^SB\.ADEA\d+A?_FW_", **COM, componente="conjunto", tipoUnidade="conduta-media-pressao", gama="ADEA"),
        _r(r"^ADEA\d+A$", **COM, componente="unidade-interior", tipoUnidade="conduta-media-pressao", gama="ADEA"),
        _r(r"^SB\.FDXM\d+_FW_A", **COM, componente="conjunto", tipoUnidade="conduta-baixa-pressao",
           gama="Baixo Perfil FDXM"),
        _r(r"^SB\.FDXM\d+_FW_RXMR?$", **DOM, componente="conjunto", tipoUnidade="conduta-baixa-pressao",
           gama="Baixo Perfil FDXM"),
        _r(r"^FDXM\d+F\d?$", **DOM, componente="unidade-interior", tipoUnidade="conduta-baixa-pressao",
           gama="Baixo Perfil FDXM"),
        _r(r"^SB\.FNA\d+_FW_", **COM, componente="conjunto", tipoUnidade="chao-sem-envolvente", gama="FNA"),
        _r(r"^FNA\d+A9?$", **COM, componente="unidade-interior", tipoUnidade="chao-sem-envolvente", gama="FNA"),
        _r(r"^SB\.FDA\d+_FW_", **COM, componente="conjunto", tipoUnidade="conduta-alta-pressao", gama="FDA"),
        _r(r"^FDA\d+A$", **COM, componente="unidade-interior", tipoUnidade="conduta-alta-pressao", gama="FDA"),
        _r(r"^SB\.FVA\d+_FW_", **COM, componente="conjunto", tipoUnidade="coluna", gama="Armário Vertical FVA"),
        _r(r"^FVA\d+A$", **COM, componente="unidade-interior", tipoUnidade="coluna", gama="Armário Vertical FVA"),
        _r(r"^RZAG\d", **UE_COM, gama="Sky Air Alpha RZAG"),
        _r(r"^RZASG\d", **UE_COM, gama="Sky Air Advance RZASG"),
        _r(r"^AZAS\d", **UE_COM, gama="Sky Air Active AZAS"),
        _r(r"^ARXM\d", **UE_COM, gama="ARXM"),
        _r(r"^RZA\d+D$", **UE_COM, gama="Sky Air RZA-D"),
        _r(r"^RXM\d", **UE_DOM, gama="RXM"),
        _r(r"^FTXM\d+A$", **DOM, componente="unidade-interior", tipoUnidade="mural", gama="Perfera"),
    ],
}


def classificar(ref: str, seccao: dict) -> dict | None:
    for nome in seccao.get("regras") or REGRAS:
        for rx, regra in REGRAS[nome]:
            if rx.search(ref):
                out = dict(regra)
                if callable(out.get("gama")):
                    out["gama"] = out["gama"](ref)
                if out.get("cor") == "emura":
                    m = re.match(r"^(?:SB\.)?FTXJ\d+A([WSB])", ref)
                    out["cor"] = COR_EMURA.get(m.group(1)) if m else None
                elif out.get("cor") == "stylish":
                    m = re.match(r"^(?:SB\.)?[FC]TXA\d+([CD][A-Z])", ref)
                    out["cor"] = COR_STYLISH.get(m.group(1)) if m else None
                if out["componente"] == "conjunto" and nome == "sky-air" and out["segmento"] == "comercial":
                    out["serie"] = _serie_sky_air(ref)
                return {k: v for k, v in out.items() if v is not None}
    return None


def alimentacao_da_ref(ref: str) -> str | None:
    """Fase pelo sufixo Daikin: …V1/…MV/_ANV = monofásica, …Y1/…MY/_ANY = trifásica."""
    r = ref.split("_")[-1] if ref.startswith("SB.") else ref
    if re.search(r"(NY1|MY|Y1|TY9|[A-Z]Y|W1|W17)$", r):
        return "trifasica"
    if re.search(r"(NV1|MV|V1|TV9|TV1|[A-Z]V|V3|V37|EVH|EVH7)$", r):
        return "monofasica"
    return None


# Gralhas do PDF nas refs (ver NOTAS.md).
GRALHAS = {"FTXJ20A9S": "FTXJ20AS9", "VAM80J8": "VAM800J8"}
# A p23 imprime os conjuntos Emura sem o 9 final da ficha (p14: SB.FTXJ20AW9, como
# as UI FTXJ20AW9 e o catálogo anterior): fica a ref da ficha.
NORMALIZAR = ((re.compile(r"^(SB\.FTXJ\d+A[WSB])$"), r"\g<1>9"),)


def _normalizar(ref: str) -> str:
    ref = GRALHAS.get(ref, ref)
    for rx, por in NORMALIZAR:
        ref = rx.sub(por, ref)
    return ref


def expandir_ref(texto: str) -> list[str]:
    """'FTXJ25AS9/AB9' → [FTXJ25AS9, FTXJ25AB9]; 'FTXA20DP/Y/G/C/L' → cinco
    refs; 'BRC1H52W7/S7/K7' → três. Cada parte depois da primeira troca o fim
    da primeira com o mesmo comprimento."""
    t = texto.strip().rstrip("*")
    if t.startswith("SB.") and not re.fullmatch(r"[^/]+(/[A-Z]{1,2}\d?)+", t):
        return [_normalizar(t)]                 # "SB.EK200PCV/FIL260", "SB.EKECBUA3V/2A": a ref inteira
    partes = t.split("/")
    if len(partes) == 1 or not all(partes):
        return [_normalizar(t)]
    base = GRALHAS.get(partes[0], partes[0])
    out = [base]
    for p in partes[1:]:
        if len(p) >= len(base) - 2:            # duas refs completas "A/B"
            out.append(p)
        else:
            out.append(base[: len(base) - len(p)] + p)
    return [_normalizar(r) for r in out]
