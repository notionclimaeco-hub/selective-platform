"""Daikin 2026: nomes dos acessórios que a tabela não dá numa linha só.

Muitas listas imprimem uma descrição por bloco de refs (a mesma frase partida pelas
linhas do bloco) ou numa coluna ao lado de um rótulo, e a primeira frase lida não serve
de título ("também", "Necessário quando é adicionado", "56 motorizada de 3 vias …").
Estes nomes foram escritos a partir da linha do PDF (página entre parênteses) e
aplicam-se ao grupo da ref em `pos.py`. Sem cor nem capacidade (vão para os atributos).
"""

NOMES: dict[str, str] = {
    # --- Split / Sky Air (p21-48) ----------------------------------------------------
    "BRC1KPD51W": "Comando por cabo Madoka Plus",                                   # p21, p32
    "KRP4A54-9": "Adaptador para controlo externo por contactos secos",             # p21
    "KRP4A53": "Adaptador para controlo externo por contactos secos",
    "KRP4A52": "Adaptador para controlo externo por contactos secos",
    "KRP4A51": "Adaptador para controlo externo por contactos secos",
    "BYCQ140E": "Painel básico Round Flow standard",                  # p36
    "KRP1BA58": "Adaptador com 2 sinais de saída (compressor/erro, ventilador)",     # p36
    "KRP1B57": "Adaptador com 2 sinais de saída (compressor/erro, ventilador)",     # p37
    "EKRP1C12": "Adaptador com 4 sinais de saída",                                  # p36
    "EKRP1B2": "Adaptador com 4 sinais de saída",                                   # p37
    "EKRP1C13": "Adaptador com 4 sinais de saída",                                  # p42
    "EKLN140-DPHT": "Resistência para tabuleiro de condensados da caixa de isolamento",
    "BYFQ60CW": "Painel totalmente plano 60x60",                                    # p37 (branco, incluído)
    "BYFQ60CS": "Painel totalmente plano 60x60",                                    # p37 (cinzento)
    "KDAJ25K140": "Adaptador de insuflação para conduta redonda",                   # p42
    "KHRQ22M20TA": "Derivador Sky Air",                                             # p46
    "KHRQ58T": "Derivador Sky Air",
    "KHRQ58H": "Derivador Sky Air",
    "KHRQ250H7": "Derivador Sky Air",
    "PT.AZAI6WSPDA0": "Aidoo Pro residencial Wi-Fi (Airzone Cloud, Modbus)",        # p47
    "PT.AZAI6WSCDA0": "Aidoo residencial Wi-Fi (Airzone Cloud)",
    "PT.AZAI6WSPDA1": "Aidoo Pro Sky Air/VRV Wi-Fi (Airzone Cloud, Modbus)",
    "PT.AZAI6WSCDA1": "Aidoo Sky Air/VRV Wi-Fi (Airzone Cloud)",
    "EKRHH": "Daikin Home Hub",                                                     # p53, p66
    # --- Altherma (p59-91) ----------------------------------------------------------
    "EKECDBCO3A": "Kit de ligação ao retorno solar Drain-Back",                    # p59
    "EKECDBCO1A": "Kit de ligação ao retorno solar Drain-Back",                    # p63
    "EKECDBCO2A": "Kit de ligação ao retorno solar Drain-Back",                    # p67
    "EKMSTC5": "Estrutura de montagem estética para unidade exterior",             # p65
    "EKMSTC4": "Estrutura de montagem estética para unidade exterior",
    "EKMST5": "Estrutura de montagem para unidade exterior",
    "EKMST4": "Estrutura de montagem para unidade exterior",
    "K.FF600H150": "Pés de assentamento para unidade exterior",
    "K.FF800H150": "Pés de assentamento para unidade exterior",
    "EKRTWA": "Termóstato ambiente por cabo",                                       # p65
    "EKRTRB": "Termóstato ambiente sem fios",
    "EKRSC1": "Sonda de temperatura exterior",
    "KRCS01-1": "Sonda de temperatura interior",
    "BRC1HHDW7": "Controlador Madoka para bomba de calor",
    "EKRTETS": "Sonda de temperatura do piso radiante",
    "164110-RTX": "Cabo de prioridade solar BSKK",
    "KDECOUP": "Separador hidráulico para renovações",
    "KBLNVALVE": "Válvula de balanceamento de caudais",
    "AFVALVE1": "Válvulas antigelo 1\"",
    "AFVALVE125": "Válvulas antigelo 1 1/4\"",
    "165215": "Válvula de enchimento e descarga (parte inferior do depósito ECH2O)",
    "165216": "Válvula de enchimento (parte superior do depósito ECH2O)",
    "141554": "Kit ZKL-H de recirculação de AQS (saída horizontal)",
    "165113": "Kit ZKL de recirculação de AQS (saída vertical)",
    "EKMIKHMA": "Grupo hidráulico com mistura (zona principal)",
    "EKMIKHUA": "Grupo hidráulico sem mistura (zona adicional)",
    "EKMIKPOA": "Módulo de controlo do grupo hidráulico",
    "EKMIKPHA": "Kit de mistura (grupo hidráulico e módulo de controlo)",
    "EKMIKBVA": "Separador hidráulico",
    "EKMIKDIA": "Distribuidor para grupos hidráulicos",
    "EKCC9-W": "Controlador centralizado para sistemas em cascata",
    "EKHY3PART": "Kit de ligação a depósito de AQS não Daikin",
    "EKHY3PART2": "Kit de ligação a depósito de AQS não Daikin (com resistência)",
    "BRP069A61": "Adaptador LAN com ligação fotovoltaica",                         # p73
    "BRP069A62": "Adaptador LAN para SmartApp Daikin Onecta",
    "EKTESE1": "Extensão da sonda de AQS até 30 m (depósito pressurizado)",
    "EKTESE2": "Extensão da sonda de AQS até 30 m (depósito ECH2O)",
    "EKDP008D": "Kit de recolha de condensados para unidade exterior",
    "EKFLSW1": "Fluxostato (instalação com glicol)",                               # p77
    "EKFLSW2": "Fluxostato para bomba de calor",
    "BZKA7V3": "Kit bizona completo",
    "EKRTCTRL1": "Controlo SMART TOUCH com ventilador modulante",                  # p80
    "EKRTCTRL2": "Controlo SMART TOUCH com 4 velocidades",
    "EKWHCTRL0": "Placa PCB para unidades slave",
    "EKPCBO": "Placa PCB para termóstato de terceiros (ON/OFF)",
    "EKPCB4S": "Placa PCB para termóstato de terceiros (4 velocidades)",
    "EKPCB10": "Placa PCB para termóstato de terceiros (modulante)",
    "EKEUR90": "Curva de 90º para válvula de 2 vias",
    "EKDIST": "Extensão hidráulica para válvula de 2 vias",
    "EKDIST3W": "Extensão hidráulica para válvula de 3 vias",
    "EKFA": "Pés estéticos",
    "EKM10CH": "Painel frontal para instalação no teto",
    "EKM10SV": "Grelha de saída de ar de dupla deflexão",
    "EKM10CA": "Grelha de saída de ar de difusão curva",
    "EKM10IS": "Grelha de entrada de ar de difusão reta",
    "EKM10IC": "Grelha de entrada de ar de difusão curva",
    "PT.PPR48E26": "Placa de piso radiante PPR48",                                 # p81
    "PT.PPR32E10": "Placa de piso radiante PPR32",
    "EMOPX14600A": "Tubo Monopex 14 para parede radiante",
    "EMOPX16240A": "Tubo Monopex 16 PE-X",
    "EMOPX16600A": "Tubo Monopex 16 PE-X",
    "EMOPX17120A": "Tubo Monopex 17 PE-X",
    "EMOPX17240A": "Tubo Monopex 17 PE-X",
    "EMOPX17600A": "Tubo Monopex 17 PE-X",
    "EPROTEPIP1621A": "Tubo de proteção corrugado",
    "EPROTEPIP1925A": "Tubo de proteção corrugado",
    "EPIPEBEND1418A": "Curva guia para tubo Monopex",
    "ESIDESTRIPRDSA": "Faixa perimetral RDS",
    "ESEALLINERDSB": "Junta de vedação RDS",
    "EXPANSIOJOICB": "Perfil de junta de dilatação DFP",
    "ESCREDEST2000A": "Aditivo para betonilha Estrolith H2000",
    "ESCREDESTROSA": "Aditivo para betonilha Estrothem S",
    "EPIPECLIPMOPXA": "Clipes de fixação para tubo Monopex",
    "ECLIPRAILA": "Trilho de fixação para parede radiante",
    "ECLIPRAILNAILA": "Prego de plástico para trilho de fixação",
    "ESERIMOPX1615A": "Kit de anilhas de aperto para tubo Monopex",                # p82
    "ESERIMOPX14A": "Kit de anilhas de aperto para tubo Monopex",
    "ESERIMOPX17A": "Kit de anilhas de aperto para tubo Monopex",
    "ECLUTCHNIPSKUA": "Kit de conexão SKU 3/4\" Eurocone",
    "ECALORIMETERA": "Kit de válvulas de corte WMS2 para contador de entalpia",
    "EIWRX14RV13CLA": "Caixa para coletor com contador de entalpia",
    "EXTENSIONZONEA": "Kit de acrescento de circuito para coletor",
    "EFLOSENDMRRMXA": "Regulador de caudal para coletor RMX",
    "ESHUTOFVALVEA": "Kit de válvulas de corte ASHS",
    "EKRCTRDI3BA": "Termóstato digital sem fios retroiluminado",                   # p83
    "EKRSIBDI1V3": "Caixa IO básica (só aquecimento)",
    "EKRMIBEV1V3": "Caixa IO para bombas de calor",
    "EKRRVATR2BA": "Termóstato para válvula de radiador",
    "EKRUFHT61V3": "Estação de controlo sem fios",
    "EKWCTRAN1V3": "Estação de controlo com fios",                                  # p84
    "EKFIL260": "Filtro de ar para Altherma M AQS",                                 # p86
    "EKPHK02": "Kit de sonda solar para depósito",
    "DOTROOMTHEAA": "Termóstato ambiente OpenTherm",                                # p87
    "DRMEEA60100BA": "Curva coaxial 90º 60/100 para caldeira",
    "DRDECO80125BA": "Adaptador de chaminé 60/100 para 80/125",
    "DRGATEWAYAA": "Adaptador LAN para caldeira",
    "DRVALVEKIC1AA": "Kit de válvulas C1 para caldeira combi",
    "DRVALVEKIT1AA": "Kit de válvulas T1 para caldeira com acumulação",
    "DRSLRTESENSAA": "Sonda solar para caldeira",
    "DRWTER60100AA": "Kit de exaustão 60/100 através da parede",
    "EKEPRHLT3HX": "Kit de ligação a depósito ECH2O (climatização + AQS)",          # p90
    "141067": "Sonda de AQS para depósito ECH2O",
    "165070": "Válvulas antitermossifão SKB",                                       # p91
    "156015": "Válvula termostática VTA32",
    "156016": "Kit de ligações para válvula VTA32",
    "EKBH3SD": "Resistência elétrica de 3 kW para depósito ECH2O",
    "EKBU2C": "Resistência elétrica autónoma de 2 kW",
    "EKBU6C": "Resistência elétrica autónoma de 2-6 kW",
    "160120": "Kit de interligação de dois depósitos (solar Drain-Back)",
    "160121": "Kit adicional para terceiro depósito (solar Drain-Back)",
    # --- Solar (p93-95) -------------------------------------------------------------
    "162066": "Calha de perfil para coletor EKSV21P",
    "162067": "Calha de perfil para coletor EKSV26P",
    "162068": "Calha de perfil para coletor EKSH26P",
    "162016-RTX": "Ligação entre coletores",
    "164709": "Proteção da furação para cobertura plana",
    "162058": "Estrutura para dois coletores verticais (cobertura plana)",
    "162059": "Acrescento de um coletor vertical (cobertura plana)",
    "162060": "Estrutura para um coletor horizontal (cobertura plana)",
    "162061": "Acrescento de um coletor horizontal (cobertura plana)",
    "162085": "Fixação para telha lusa",
    "164703-RTX": "Fixações de parafuso para cobertura ondulada",
    "164723": "Fixações reguláveis para telha lisa",
    "164704-RTX": "Fixações para cobertura de chapa metálica",
    "162017": "Estrutura de integração no telhado para 2 coletores EKSV21P",
    "162018": "Acrescento de um coletor EKSV21P integrado no telhado",
    "162019": "Estrutura de integração no telhado para 2 coletores EKSV26P",
    "162020": "Acrescento de um coletor EKSV26P integrado no telhado",
    "164616-RTX": "Kit de proteção para coletores integrados em ardósia",
    "EKSRPS4A": "Estação solar Drain-Back",
    "164243": "Kit de bomba circuladora adicional (Drain-Back)",
    "164231": "Kit base de ligações hidráulicas (coletores integrados)",
    "162037-RTX": "Kit de ligações hidráulicas para coletores integrados",
    "EKSRCRP": "Kit de ligações hidráulicas para cobertura inclinada",
    "EKSRCAP": "Kit de ligações hidráulicas para cobertura plana",
    "162038-RTX": "Kit de ligações hidráulicas para cobertura plana",
    "162035-RTX": "Ligação hidráulica entre duas séries de coletores",
    "162045": "Ligação hidráulica entre duas séries de coletores (pressurizado)",
    "164102-RTX": "Caudalímetro FlowGuard",
    "164732": "Tubagem de ida e retorno Drain-Back",
    "164733": "Tubagem de ida e retorno Drain-Back",
    "164261-RTX": "Extensão de tubagem de ida e retorno Drain-Back",
    "164262-RTX": "Extensão de tubagem de ida e retorno Drain-Back",
    "164263": "Extensão de tubagem de ida e retorno Drain-Back",
    "164264": "Extensão de tubagem de ida Drain-Back 8 m",
    "164245": "Suportes de proteção da tubagem Drain-Back",
    "EKSRDS2A": "Grupo hidráulico solar pressurizado",
    "EKSDSR1A": "Controlador diferencial solar",
    "156034": "Válvula de comutação de 3 vias 1\"",
    "162073": "Tubo solar flexível isolado DN16 15 m",
    "162074": "Tubo solar flexível isolado DN20 15 m",
    "162075": "Ligações DN16 para tubagem solar",
    "162076": "Ligações DN20 para tubagem solar",
    "162071": "Conector de tubagem DN16",
    "162072": "Conector de tubagem DN20",
    "162070": "Vaso de expansão solar",
    "162050": "Vaso de expansão solar",
    "162051-RTX": "Vaso de expansão solar",
    "162052-RTX": "Líquido solar térmico 20 L",
    # --- Ventilação (p104-124) --------------------------------------------------------
    "00004742": "Conjunto de filtros 65% + ePM1 70% (Energy Comfort D400 e Plus)",  # p104
    "00004950": "Conjunto de filtros 2 x coarse 65% (Energy Sky)",
    "00004945": "Placa de comunicação Wi-Fi 2.0 DucoBox",
    "00004569": "DucoFlex conduta circular isolada com acoplamento integrado L1000 mm",                        # p105
    "00004909": "DucoFlex conduta circular isolada com acoplamento integrado L1000 mm",
    "00004905": "DucoFlex conduta circular isolada com acoplamento integrado L1000 mm",
    "EKEACB": "Caixa de controlo para UTA (ERA)",                                   # p111
    "EKAFVJ50F6": "Filtro ePM10 70% (M6) para VAM",                                  # p112
    "EKAFVJ50F7": "Filtro ePM1 60% (F7) para VAM",
    "EKAFVJ50F8": "Filtro ePM1 70% (F8) para VAM",
    "BRP4A50A": "Adaptador para controlo externo de VAM",
    "UATYAC75A": "Filtro rooftop ISO coarse 75% (G4)",                               # p124
    "UATYAEPM1050A": "Filtro rooftop ISO ePM10 50% (M5)",
    "UATYAEPM1070A": "Filtro rooftop ISO ePM10 70% (M6)",
    "UATYAEPM150A": "Filtro rooftop ISO ePM1 50% (F7)",
    "UATYAEPM185A": "Filtro rooftop ISO ePM1 85% (F9)",
    "UATYACO2P": "Sonda de qualidade do ar (CO2) para conduta rooftop",
    "UATYACAP": "Transdutor de pressão constante para rooftop",
    "UATYARRP": "Sonda de temperatura de retorno rooftop",
    "UATYASA": "Detetor de fumo e incêndio rooftop",
    "UATYAWRC": "Comando remoto rooftop",
    "UATYAAVM1": "Suportes antivibração para rooftop",
    "UATYARPH1": "Cobertura de proteção contra a chuva para rooftop",
    # --- Chillers (p126-134) -----------------------------------------------------------
    "OPT-191": "Resistência de proteção antigelo para chiller EWAT/EWYT",           # p128
    "EKRSCIO": "Extensão I/O para chiller",
    "EKRSCTMS": "Sonda de temperatura master/slave/AQS para chiller",
    "EKRSCIOC": "Extensão I/O para chiller (caudal variável, AQS)",
    "EKRTSMSP": "Sonda de temperatura master/slave/AQS para chiller R-290",
    "EKRSCWI": "Sonda de temperatura de entrada de água",                           # p134
    "EKRSCLK": "Kit de instalação empilhada para chiller água-água",
    # --- Ventiloconvectores (p136-144) ---------------------------------------------------
    "FWCKRX": "Kit de montagem no móvel para FWEC2T/4T/10",                               # p136
    "FWCKLX": "Kit de montagem no móvel para FWEC2T/4T/10",
    "E4V2N05OV3WA": "Kit válvula 3 vias ON/OFF 230 V para FWP",                              # p138, p141
    "E4V2N08OV3WA": "Kit válvula 3 vias ON/OFF 230 V para FWP",
    "ED2MV04A6": "Válvula 3 vias ON/OFF 230 V com atuador para FWN",
    "ED2MV10A6": "Válvula 3 vias ON/OFF 230 V com atuador para FWN",
    "ESFH01D5": "Kit para instalação vertical de FWE-D",
    "EK04WV3V3C5A": "Kit válvula 3 vias ON/OFF 230 V para FWQ-AT/FWE-F",
    "EK06WV3V3C5A": "Kit válvula 3 vias ON/OFF 230 V para FWQ-AT/FWE-F",
    "EK02WV3V3W5A": "Kit válvula 3 vias ON/OFF 230 V para FWQ-AT/FWE-F",
    "EK02WV2V3W5A": "Kit válvula 2 vias ON/OFF 230 V para FWE-F",
    "EK04WV2V3C5A": "Kit válvula 2 vias ON/OFF 230 V para FWE-F",
    "EK06WV2V3C5A": "Kit válvula 2 vias ON/OFF 230 V para FWE-F",
}

# Séries vendidas por tamanho que ficam num só produto: {ref: tamanho} (o tamanho é o
# que a tabela imprime na linha: comprimento, volume, diâmetro, modelo de VAM, A/B/C).
MESMO_GRUPO: dict[str, dict[str, str]] = {
    "EMOPX16": {"EMOPX16240A": "240 m", "EMOPX16600A": "600 m"},                     # p81
    "EMOPX17": {"EMOPX17120A": "120 m", "EMOPX17240A": "240 m", "EMOPX17600A": "600 m"},
    "EPROTEPIP": {"EPROTEPIP1621A": "16/21 mm", "EPROTEPIP1925A": "19/25 mm"},
    "TUBAGEM-DB": {"164732": "15 m", "164733": "20 m"},                              # p95
    "EXTENSAO-DB": {"164261-RTX": "2,5 m", "164262-RTX": "5 m", "164263": "10 m"},
    "VASO-SOLAR": {"162070": "12 L", "162050": "25 L", "162051-RTX": "35 L"},
    "DUCOFLEX-CONDUTA": {"00004569": "D160", "00004909": "D180", "00004905": "D200"},  # p105
    "EKAFVJ-F6": {"EKAFVJ50F6": "VAM 350-500", "EKAFVJ65F6": "VAM 650", "EKAFVJ100F6": "VAM 800-2000"},  # p112
    "EKAFVJ-F7": {"EKAFVJ50F7": "VAM 350-500", "EKAFVJ65F7": "VAM 650", "EKAFVJ100F7": "VAM 800-2000"},
    "EKAFVJ-F8": {"EKAFVJ50F8": "VAM 350-500", "EKAFVJ65F8": "VAM 650", "EKAFVJ100F8": "VAM 800-2000"},
    **{f"UATYA-{serie}": {f"UATYA{serie}{t}": t for t in "ABC"}                     # p124
       for serie in ("C75", "EPM1050", "EPM1070", "EPM150", "EPM185")},
    "UATYAAVM": {"UATYAAVM1": "1", "UATYAAVM2": "2"},
    "UATYARPH": {f"UATYARPH{i}": str(i) for i in range(1, 9)},
}

# --- Segunda passagem: nomes partidos, títulos de secção e refs coladas ao título ------
NOMES.update({
    "KJB212A": "Caixa de derivação com terminal de terra",                          # p32
    "KJB311A": "Caixa de derivação com terminal de terra",
    "KKF936A4": "Proteção antirroubo para comando por cabo",
    "KKF910A4": "Proteção antirroubo para comando por cabo",
    "BYCQ140EGF": "Painel com auto-limpeza",                                         # p36
    "BYCQ140EGFB": "Painel com auto-limpeza",
    "BRC7FA532F": "Comando por infravermelhos para painel básico",
    "BRC7FA532FB": "Comando por infravermelhos para painel básico",
    "BRC7FB532F": "Comando por infravermelhos para painel design",
    "BRC7FB532FB": "Comando por infravermelhos para painel design",
    "BRYQ140B": "Sensor de presença para painel básico e auto-limpeza",
    "BRYQ140BB": "Sensor de presença para painel básico e auto-limpeza",
    "BRYQ140C": "Sensor de presença para painel design",
    "BRYQ140CB": "Sensor de presença para painel design",
    "RTD-10": "Interface Modbus com rotatividade e stand-by",
    "KDBHP49B140": "Kit de vedação para insuflação em 2 ou 3 direções",               # p37
    "EKRORO5": "Kit de cablagem para ligar/desligar remoto",
    "EKRORO4": "Kit de cablagem para ligar/desligar remoto",                         # p38
    "EKRORO3": "Kit de cablagem para ligar/desligar remoto",                         # p42
    "KRP1B54": "Adaptador de inter-cravamento para ventilador de ar novo",           # p38
    "KRP1C64": "Adaptador de inter-cravamento para ventilador de ar novo",           # p42
    "BRC7EA631": "Comando por infravermelhos para FAA71B",                           # p39
    "BRC7EA632": "Comando por infravermelhos para FAA100B",
    "EKEWTSC-1": "Cablagem para sensor sem fios K.RSS",
    "AZEZ6DAIST07XS2": "Kit Multizonas Airzone pleno standard",                     # p47
    "AZEZ6DAIBS07XS2": "Kit Multizonas Airzone pleno de baixo perfil",
    "AZEZ6DAISL01S2": "Kit Multizonas Airzone pleno slim",
    "AZCE6BLUEZEROCB": "Termóstato Airzone Blueface Zero (cabo)",
    "AZCE6LITECB": "Termóstato Airzone Lite (cabo)",
    "AZCE6LITERB": "Termóstato Airzone Lite (rádio)",
    "AZCE6THINKRB": "Termóstato Airzone Think (rádio)",
    "AZX6MCS": "Módulo de aquecimento para plenos médios Airzone",
    "AZX8CABLEBUS100": "Cabo de comunicação Airzone",
    "AZX8CABLEBUS15": "Cabo de comunicação Airzone",
    "AZCE8ACCOFF": "Módulo on/off de zona Airzone",
    "AZX6WSC5GER": "Webserver Airzone Cloud Wi-Fi/Ethernet",
    "AZX6WSPHUB": "Webserver HUB Airzone Cloud (calha DIN)",
    "AZX6WSPBAC": "Gateway BACnet Airzone",
    "AZX6KNXGTWAY": "Gateway KNX Airzone",
    "DAM411B51": "Placa BACnet DIII-net para mais 2 portas",                         # p48
    "DAM412B51": "Placa BACnet para contadores de energia",
    "EKCSS1P": "Sensor de potência monofásico para Home Hub",                         # p53
    "EKCSS3P": "Sensor de potência trifásico para Home Hub",
    "EKP1USB": "Cabo P1 para Home Hub",
    "SB.EKECBU1A3V": "Resistência inline com kit de ligação (Altherma 3 H HT)",       # p63
    "SB.EKECBU3A3V": "Resistência inline com kit de ligação (Altherma 3 R 4-8)",      # p67
    "SB.EKECBUA3V/2A": "Resistência inline com kit de ligação (Altherma 3 R 11-16)",  # p69
    "EKECBIVCO1A": "Kit de ligação à serpentina bivalente",
    "EKECBIVCO2A": "Kit de ligação à serpentina bivalente",
    "BRC1HHDS7": "Controlador Madoka para bomba de calor",                            # p65
    "BRC1HHDK7": "Controlador Madoka para bomba de calor",
    "BRP069A78": "Cartão WLAN para SmartApp Daikin Onecta",
    "EKRP1AHT": "Placa Demand PCB (limitação de potência)",
    "EKRP1HBA": "Placa digital I/O PCB",
    "156021": "Separador de sujidade magnético SAS1",
    "EKCLWS": "Sonda de AQS para sistemas centralizados",
    "SB.EKWHCTRL0_CTRL1": "Kit controlador mural SMART LCD com placa de ligação",      # p80
    "EK2VK0": "Válvula motorizada de 2 vias",
    "EKT2VK0": "Válvula motorizada de 2 vias",
    "EK3VK1": "Válvula motorizada de 3 vias",
    "EKT3VK1": "Válvula motorizada de 3 vias",
    "EKM10D90": "Curva de saída 90º para insuflação vertical",
    "EKM10DT": "Pleno telescópico de 30 a 59 cm",
    "EKWCVATR1V3": "Atuador de válvula",                                               # p83, p84
    "EKWUFHTA1V3": "Estação de controlo com fios",
    "EKWCTRDI1V3": "Termóstato digital com fios",
    "EKWCTRAN1V3": "Termóstato analógico com fios",
    "EKSV21P": "Coletor solar vertical 2,1 m²",                                        # p93
    "EKSV26P": "Coletor solar vertical 2,6 m²",
    "EKSH26P": "Coletor solar horizontal 2,6 m²",
    "EKSRCP": "Kit de ligações hidráulicas (pressurizado)",                            # p95
    "00004546": "Base de montagem no chão DucoBox",                                    # p104
    "00004740": "Base de montagem no chão DucoBox",
    "00004723": "Sensor de humidade DucoBox Energy Comfort",
    "00004374": "Sensor de humidade DucoBox",
    "00004605": "Comando e sensor de humidade RF/cabo",
    "00004563": "DucoFlex caixa de distribuição 12x63 D180",                           # p105
    "00004564": "DucoFlex caixa de distribuição 12x63 D180",
    "00004586": "DucoFlex silenciador flexível D125 1 m",
    "00004587": "DucoFlex silenciador semirrígido D160 1 m",
    "00004571": "DucoFlex curva isolada 90º com acoplamento D160",
    "00004609": "DucoFlex curva horizontal 90°/45° para conduta oval",
    "00004686": "DucoFlex adaptador 2x90 oval",
    "BRC301B61": "Comando por cabo para VAM",                                          # p112
    "EKPLEN200": "Pleno de repartição para VAM",
    "OPT-191": "Resistência de proteção antigelo para chiller EWAT/EWYT",               # p128
    "EKRSCBMS": "Ligação a GTC externa para chiller",
    "EKRSCPCS": "Display local/remoto HMI externo para chiller",
    "EKRSCIOR": "Extensão I/O para chiller R-290 (AQS)",
    "EKRCM200J": "Módulo de comunicação Modbus RTU para chiller",
    "EKRCMBACIP": "Módulo de comunicação BACnet/IP para chiller",
    "PT.DOS_CONNECT": "Monitorização remota Daikin on Site (DoS CONNECT)",
    "EDPVB6": "Tabuleiro de condensados auxiliar vertical (FWZ/FWR/FWS)",              # p136
    "EDPHB6": "Tabuleiro de condensados auxiliar horizontal (FWZ/FWR/FWS)",
    "FWEC3A": "Comando por cabo avançado",
    "FWEC10": "Comando por cabo analógico simplificado (motor BLDC)",
    "CDRP1A": "Bomba de elevação de condensados para ventiloconvector",
    "FWEDA+SHINKATOUCHBA": "Comando tátil a cores com Modbus",
    "FWEDA+SHINKATOUCHWA": "Comando tátil a cores com Modbus",
    "SHINKATOUCHBA": "Comando tátil a cores com Modbus",
    "SHINKATOUCHWA": "Comando tátil a cores com Modbus",
    "FWEDA": "Placa de interface para comando tátil",
    "E2MV03A6": "Kit válvula 3 vias ON/OFF 230 V",
    "E2MV06A6": "Kit válvula 3 vias ON/OFF 230 V",
    "E2MV10A6": "Kit válvula 3 vias ON/OFF 230 V",
    "E2MVD03A6": "Kit válvula 3 vias ON/OFF 230 V simplificado",
    "E2MVD06A6": "Kit válvula 3 vias ON/OFF 230 V simplificado",
    "E2MVD10A6": "Kit válvula 3 vias ON/OFF 230 V simplificado",
    "E2MV2B07A6": "Kit válvula 2 vias ON/OFF 230 V",
    "E2MV2B10A6": "Kit válvula 2 vias ON/OFF 230 V",
    "FWTSKA": "Sonda de temperatura ar/água para FWEC3A/FWEDA",
    "FWCSWA": "Sonda de temperatura ar/água para FWEC10",
    "FWECKA": "Kit de montagem no móvel para FWEC3A",
    "FWFCKA": "Kit de montagem na parede para FWEC3A",
    "EKC01Q5A": "Kit de instalação de FWEDA no FWQ-A",                                  # p137
    "EK08WV3V3D5A": "Kit válvula 3 vias ON/OFF 230 V",
    "EDPD7": "Tabuleiro de condensados auxiliar horizontal (FWP)",                      # p138
    "EDPD9": "Tabuleiro de condensados auxiliar horizontal (FWP)",
    "EDDPV10A6": "Tabuleiro de condensados auxiliar vertical (FWN)",
    "EDDPV18A6": "Tabuleiro de condensados auxiliar vertical (FWN)",
    "EDDPH10A6": "Tabuleiro de condensados auxiliar horizontal (FWN)",
    "EDDPH18A6": "Tabuleiro de condensados auxiliar horizontal (FWN)",
    "ED2MV18A6": "Válvula 3 vias ON/OFF 230 V com atuador",
    "FWEC1A": "Comando por cabo standard",                                              # p141
    "FWEC2A": "Comando por cabo com Modbus",
    "FWEC2T": "Comando por cabo analógico simplificado (2 tubos)",
    "FWEC4T": "Comando por cabo analógico simplificado (4 tubos)",
    "E3V2VN02V3WA": "Kit válvula 3 vias ON/OFF 230 V",
    "E2V2VN01V3WA": "Kit válvula 2 vias ON/OFF 230 V",
    "ESFD01D6": "Tabuleiro de condensados auxiliar horizontal (FWE-D)",
    "EPIB6": "Interface de alimentação para FWD 16-18",
    "BYFQ60B3": "Painel tradicional 600x600 para cassete FWF",                          # p142
    "EKRP1C11": "Placa de interface para cassete FWC/FWF",
    "BYCQ140C": "Painel tradicional 900x900 para cassete FWC",
    "BRC1HF7": "Comando por cabo para cassete FWC/FWF",
    "BRC7F532F": "Comando por infravermelhos para cassete FWC",
    "BRC7E530": "Comando por infravermelhos para cassete FWF",
    "EKFCMBCB": "Gateway Modbus para cassete FWC/FWF",
    "EKMV3C09B": "Kit válvula 3 vias ON/OFF 230 V para cassete FWC/FWF",
    "EKMV2C09B": "Kit válvula 2 vias ON/OFF 230 V para cassete FWC/FWF",
    "BYFQ60CW+EKRP1CAS5A": "Painel design 600x600 com adaptador",                       # p143
    "BYFQ60CS+EKRP1CAS5A": "Painel design 600x600 com adaptador",
    "BYCQ140E+EKRP1CAS5A": "Painel design 900x900 standard com adaptador",
    "BYCQ140EW+EKRP1CAS5A": "Painel design 900x900 com adaptador",
    "BYCQ140EB+EKRP1CAS5A": "Painel design 900x900 com adaptador",
    "EKWV3V3W5A": "Kit válvula 3 vias ON/OFF 230 V",
    "EKWV2V3W5A": "Kit válvula 2 vias ON/OFF 230 V",
    "EK10WV3V3C5A": "Kit válvula 3 vias ON/OFF 230 V",
    "EK10WV2V3C5A": "Kit válvula 2 vias ON/OFF 230 V",
    "EDT02D5A": "Tabuleiro de condensados adicional para válvulas",
    "EDT03D5A": "Tabuleiro de condensados adicional para válvulas",
    "BRC51D67": "Comando por cabo para FWT-HT",                                         # p144
    "ARC485B2": "Comando por infravermelhos para FWT-HT",
    "FCBAG": "Gateway Modbus para FWT-HT",
})

# Variantes de cor que a tabela imprime em linhas separadas: um produto com `cor`.
MESMO_GRUPO_COR: dict[str, dict[str, str]] = {
    "BYFQ60C": {"BYFQ60CW": "branco", "BYFQ60CS": "cinzento"},                          # p37
    "BYCQ140EGF": {"BYCQ140EGF": "branco", "BYCQ140EGFB": "preto"},                     # p36
    "BRC7FA532F": {"BRC7FA532F": "branco", "BRC7FA532FB": "preto"},
    "BRC7FB532F": {"BRC7FB532F": "branco", "BRC7FB532FB": "preto"},
    "BRYQ140B": {"BRYQ140B": "branco", "BRYQ140BB": "preto"},
    "BRYQ140C": {"BRYQ140C": "branco", "BRYQ140CB": "preto"},
    "BRC1HHD": {"BRC1HHDW7": "branco", "BRC1HHDS7": "prateado", "BRC1HHDK7": "preto"},  # p65
    "SHINKATOUCH": {"SHINKATOUCHBA": "preto", "SHINKATOUCHWA": "branco"},               # p136
    "FWEDA+SHINKATOUCH": {"FWEDA+SHINKATOUCHBA": "preto", "FWEDA+SHINKATOUCHWA": "branco"},
    "BYFQ60C+EKRP1CAS5A": {"BYFQ60CW+EKRP1CAS5A": "branco", "BYFQ60CS+EKRP1CAS5A": "cinzento"},
    # o painel standard (BYCQ140E, sem cor na tabela) fica no seu produto
    "BYCQ140E-COR+EKRP1CAS5A": {"BYCQ140EW+EKRP1CAS5A": "branco", "BYCQ140EB+EKRP1CAS5A": "preto"},
}

MESMO_GRUPO.update({
    "KJB": {"KJB212A": "2 blocos", "KJB311A": "3 blocos"},                                # p32
    "AZX8CABLEBUS": {"AZX8CABLEBUS15": "15 m", "AZX8CABLEBUS100": "100 m"},              # p47
    "SB.EKECBU1A": {"SB.EKECBU1A3V": "3 kW 230 V", "SB.EKECBU1A6V": "6 kW 230 V", "SB.EKECBU1A9W": "9 kW 400 V"},
    "SB.EKECBU3A": {"SB.EKECBU3A3V": "3 kW 230 V", "SB.EKECBU3A6V": "6 kW 230 V", "SB.EKECBU3A9W": "9 kW 400 V"},
    "SB.EKECBUA-2A": {"SB.EKECBUA3V/2A": "3 kW 230 V", "SB.EKECBUA6V/2A": "6 kW 230 V",
                      "SB.EKECBUA9W/2A": "9 kW 400 V"},
    "EKRP1C-4S": {"EKRP1C12": "FCAG", "EKRP1B2": "FFA/FBA", "EKRP1C13": "FDA"},          # p36-42
    "EDDPV": {"EDDPV10A6": "04-10", "EDDPV18A6": "12-18"},
    "EDDPH": {"EDDPH10A6": "04-10", "EDDPH18A6": "12-18"},
    "EDPD": {"EDPD7": "04-08", "EDPD9": "10-17"},
    "DUCO-BASE-CHAO": {"00004546": "Energy Comfort", "00004740": "Energy Premium e Comfort D400/Plus"},  # p104
    "DUCO-CAIXA-12X63": {"00004563": "chão", "00004564": "teto"},                       # p105
    "DUCO-SILENC-D125": {"00004586": "standard", "00004630": "M/F"},
})

# Kits Multizonas Airzone (p47): AZEZ6DAI + pleno (ST07 standard, BS07 baixo perfil, SL01 slim) +
# tamanho do pleno (XS…XL) + nº de zonas (a coluna "Número de registos motorizado").
_AZEZ = ("ST07XS2 ST07S2 ST07XS3 ST07S3 ST07S4 ST07M4 ST07M5 ST07L5 ST07M6 ST07L6 ST07L7 ST07XL7 ST07L8 ST07XL8 "
         "BS07XS2 BS07S2 BS07XS3 BS07S3 BS07M3 BS07S4 BS07M4 BS07L4 BS07S5 BS07M5 BS07L5 BS07XL5 BS07M6 BS07L6 "
         "BS07XL6 SL01S2 SL01S3 SL01M4 SL01L5").split()
for _c in _AZEZ:
    _pleno, _tam, _zonas = _c[:4], _c[4:-1], _c[-1]
    MESMO_GRUPO.setdefault(f"AZEZ6DAI{_pleno}", {})[f"AZEZ6DAI{_c}"] = f"{_tam}, {_zonas} zonas"

# Segunda revisão (p104-143): nomes que a primeira leitura deixou sem o modelo a que servem.
NOMES.update({
    "00004547": "Conjunto de filtros 2 x coarse 65% (Energy Comfort)",
    "00004376": "Sifão plano (Energy Comfort e Premium)",
    "00004416": "Conjunto de filtros coarse 65% + ePM1 70% (Energy Premium)",
    "00004417": "Conjunto de filtros 2 x coarse 65% (Energy Premium)",
    "00004661": "Conjunto de filtros 65% + ePM1 55% (Energy Comfort D325)",
    "00004741": "Conjunto de filtros 2 x 65% (Energy Comfort D400 e Plus)",
    "00004951": "Conjunto de filtros coarse 65% + ePM1 55% (Energy Sky)",
    "00004422": "Base de montagem na parede DucoBox (Energy Premium)",
    "00004723": "Sensor de humidade DucoBox (Energy Comfort e Comfort Plus)",
    "00004374": "Sensor de humidade DucoBox (Energy Premium)",
    "00004418": "Cabo coaxial 8 m (Energy Premium, Comfort e Comfort Plus)",
    "00004807": "Resistência elétrica DucoBox (Energy Comfort e Comfort Plus)",
    "00004761": "Válvula multizona DucoBox Ø125 (Energy Comfort e Plus, sensorless)",
    "00004760": "Válvula multizona DucoBox Ø160 (Energy Comfort e Plus, sensorless)",
    "00004763": "Fonte de alimentação 230 VAC - 24 VDC/20 W",
    "00004762": "Adaptador elétrico com cabo 230 VAC - 24 VDC/20 W",
    "00004946": "Kit de configuração Duco",
    "00004174": "Contacto de interruptor RF/230 V",
    "00004769": "DucoVent Comfort (insuflação e exaustão)",
    "00007006": "DucoVent Design quadrado standard AK (exaustão) - RAL 9010",
    "00007007": "DucoVent Design quadrado XL AK (insuflação e exaustão) - RAL 9010",
    "00007012": "DucoVent Design quadrado redondo standard AK (exaustão) - RAL 9010",
    "00007013": "DucoVent Design quadrado redondo XL AK (insuflação e exaustão) - RAL 9010",
    "00007008": "DucoVent Design redondo AK (insuflação e exaustão) - RAL 9010",
    "00004178": "DucoVent Basic (insuflação e exaustão)",
    "00004836": "Regulador de caudal 30-60 m³/h D125",
    "00004837": "Regulador de caudal 30-120 m³/h D125",
    "00004722": "Regulador de caudal 15-30 m³/h D80",
    "00004565": "DucoFlex caixa de distribuição (chão) 12x63 + 2 condutas de ar oval",
    "00004701": "DucoFlex caixa de distribuição (chão e teto) 3 condutas oval (F) + 1 conduta oval (M)",
    "00004687": "DucoFlex caixa de distribuição (chão e teto) 4 condutas oval (F) D160",
    "00004724": "DucoFlex peça de ligação com junta e borracha D160/D160 (M/M)",
    "00004725": "DucoFlex peça de ligação com junta e borracha D180/D160 (M/M)",
    "00004726": "DucoFlex peça de ligação com junta e borracha D180/D180 (M/M)",
    "00004727": "DucoFlex peça de ligação com junta e borracha D200/D180 (M/M)",
    "00004949": "DucoFlex peça de ligação 45° com junta e borracha D160/D160 (M/M)",
    "00004552": "DucoFlex conduta redonda semirrígida D63 (50 m)",
    "00004674": "DucoFlex conduta redonda semirrígida D75 (50 m)",
    "00004692": "DucoFlex conduta redonda semirrígida D90 (50 m)",
    "00004571": "DucoFlex curva isolada 90° com acoplamento integrado D160",
    "00004573": "DucoFlex curva isolada 45° com acoplamento D160",
    "00004609": "DucoFlex curva horizontal rígida 90°/45° para conduta oval",
    "00004555": "DucoFlex grampo de fixação D63 (30 peças)",
    "00004829": "DucoFlex grampo de fixação D75/D90 (30 peças)",
    "00004553": "DucoFlex O-ring D63 (10 unidades)",
    "00004675": "DucoFlex O-ring D75 (10 unidades)",
    "00004676": "DucoFlex O-ring D90 (10 unidades)",
    "00004586": "DucoFlex silenciador flexível D125 L1000 mm",
    "00004631": "DucoFlex silenciador flexível D160 (M/M) L1000 mm",
    "00004632": "DucoFlex silenciador flexível D180 (M/M) L1000 mm",
    "00004918": "DucoFlex silenciador flexível D200 (M/F) L1000 mm",
    "00004587": "DucoFlex silenciador semirrígido D160 (M/M) L1000 mm",
    "00004588": "DucoFlex silenciador semirrígido D180 (M/M) L1000 mm",
    "00004919": "DucoFlex silenciador semirrígido D200 (M/M) L1000 mm",
    "00004638": "DucoFlex conector horizontal oval D125",
    "00004700": "DucoFlex conector horizontal D160 2 x oval",
    "00004543": "DucoFlex redutor 160/80",
    "00004542": "DucoFlex redutor 125/80",
    "00004578": "DucoFlex terminal universal para telhado D160/180 (1,0 m)",
    "00004915": "DucoFlex terminal universal para telhado D200 (1,0 m)",
    "BRYMA65": "Sensor de CO2 para VAM",
    "GSIEKA10009": "Resistência elétrica de pré-tratamento do ar novo para VAM",
    "EKMP25VAM": "Placa de fixação para PCB de adaptação para VAM",
    "KAF241H80M": "Filtro de ar de substituição para VKM",
    "EKPLEN200": "Pleno de repartição para VAM 1500-2000",
    "ARF01G4A": "UTA Compact R: Filtro G4 (ISO coarse 55%)",
    "ARF01M5A": "UTA Compact R: Filtro M5 (ePM10 55%)",
    "ARF01F7B": "UTA Compact R: Filtro F7 (ePM1 50%)",
    "ARF01F9B": "UTA Compact R: Filtro F9 (ePM1 80%)",
    "ARD03UDSAR": "UTA Compact R: Bateria DX",
    "ARD01UWSAR": "UTA Compact R: Bateria a água",
    "ARA01DEA": "UTA Compact R: Separador de gotas",
    "ARA01EKA": "UTA Compact R: Telhado",
    "ALD02HWUA": "UTA Compact R e L: Reaquecimento a água",
    "ALA02EDA": "UTA Compact R e L: Registo externo",
    "AUE00ASDA": "UTA Compact: Atuador de retorno por mola para registo externo",
    "ALP00TEA": "UTA Compact: Sonda de temperatura",
    "ALP00HUA": "UTA Compact: Sonda de humidade relativa",
    "ALP00COA": "UTA Compact: Sonda de CO2",
    "ALC00895A": "UTA Compact: Comando POL 895 (para configuração)",
    "ALC00955A": "UTA Compact R e L: Módulo de expansão do controlador",
    "AUC00BACA": "UTA Compact R: Módulo BACnet",
    "AUC00MODA": "UTA Compact R: Módulo Modbus",
    "AUC00RTSA": "UTA Compact R: Comando HMI Standard",
    "AUC00RTPA": "UTA Compact R: Comando HMI Premium",
    "ATF03G4A": "UTA Compact T: Filtro G4 (ISO coarse 55%)",
    "ATF03M5A": "UTA Compact T: Filtro M5 (ePM10 55%)",
    "ATF03F7A": "UTA Compact T: Filtro F7 (ePM1 50%)",
    "ATF03F9A": "UTA Compact T: Filtro F9 (ePM1 80%)",
    "ATD03UDSAR": "UTA Compact T: Bateria DX (direita)",
    "ATD03UDSAL": "UTA Compact T: Bateria DX (esquerda)",
    "ATD03UWSAR": "UTA Compact T: Bateria a água (direita)",
    "ATD03UWSAL": "UTA Compact T: Bateria a água (esquerda)",
    "ATD03HWSAR": "UTA Compact T: Reaquecimento a água (direita)",
    "ATD03HWSAL": "UTA Compact T: Reaquecimento a água (esquerda)",
    "ATA05MDA": "UTA Compact T: Registo de mistura",
    "ATE00AMDA": "UTA Compact T: Atuador modulante para registo de mistura",
    "ATA03EDA": "UTA Compact T: Registo externo",
    "ALC00908A": "UTA Compact T e L: Módulo BACnet POL 908",
    "ALC00902A": "UTA Compact T e L: Módulo Modbus POL 902",
    "ATE00DPUA": "UTA Compact: Placa de controlo adicional",
    "ALF02G4A": "UTA Compact L: Filtro G4 (ISO coarse 55%)",
    "ALF02M5A": "UTA Compact L: Filtro M5 (ePM10 55%)",
    "ALF02F7A": "UTA Compact L: Filtro F7 (ePM1 50%)",
    "ALF02F9A": "UTA Compact L: Filtro F9 (ePM1 80%)",
    "ALD05CDSA": "UTA Compact L: Bateria DX",
    "ALD02CWSA": "UTA Compact L: Bateria a água",
    "ALA02RLA": "UTA Compact L: Calha para portas",
    "AUE00PTUA": "UTA Compact L: Transdutor de pressão",
    "FWEC1A": "Comando por cabo standard (motor AC)",
    "FWEC2A": "Comando por cabo com Modbus (motor AC)",
    "FWEC3A": "Comando por cabo com Modbus (motor BLDC)",
    "FWEC2T": "Comando por cabo analógico simplificado 2 tubos (motor AC)",
    "FWEC4T": "Comando por cabo analógico simplificado 4 tubos (motor AC)",
    "FWECKA": "Kit de montagem no móvel para FWEC1A/2A/3A",
    "FWFCKA": "Kit de montagem na parede para FWEC1A/2A/3A",
    "FWTSKA": "Sonda de temperatura ar/água para FWEC1A/2A/3A ou FWEDA",
    "FWCSWA": "Sonda de temperatura ar/água para FWEC2T/4T/10",
    "E2MV03A6": "Kit válvula 3 vias ON/OFF 230 V para FWV/FWL/FWM/FWZ/FWR/FWS",
    "E2MV06A6": "Kit válvula 3 vias ON/OFF 230 V para FWV/FWL/FWM/FWZ/FWR/FWS",
    "E2MV10A6": "Kit válvula 3 vias ON/OFF 230 V para FWV/FWL/FWM/FWZ/FWR/FWS",
    "E2MVD03A6": "Kit válvula 3 vias ON/OFF 230 V simplificado para FWV/FWL/FWM/FWZ/FWR/FWS",
    "E2MVD06A6": "Kit válvula 3 vias ON/OFF 230 V simplificado para FWV/FWL/FWM/FWZ/FWR/FWS",
    "E2MVD10A6": "Kit válvula 3 vias ON/OFF 230 V simplificado para FWV/FWL/FWM/FWZ/FWR/FWS",
    "E2MV2B07A6": "Kit válvula 2 vias ON/OFF 230 V para FWV/FWL/FWM/FWZ/FWR/FWS",
    "E2MV2B10A6": "Kit válvula 2 vias ON/OFF 230 V para FWV/FWL/FWM/FWZ/FWR/FWS",
    "ED2MV18A6": "Válvula 3 vias ON/OFF 230 V com atuador para FWN",
    "EK08WV3V3D5A": "Kit válvula 3 vias ON/OFF 230 V para FWQ-AT/FWE-F",
    "E3V2VN02V3WA": "Kit válvula 3 vias ON/OFF 230 V para FWE-D",
    "E2V2VN01V3WA": "Kit válvula 2 vias ON/OFF 230 V para FWE-D",
    "EKWV3V3W5A": "Kit válvula 3 vias ON/OFF 230 V para cassete FWF-D",
    "EKWV2V3W5A": "Kit válvula 2 vias ON/OFF 230 V para cassete FWF-D",
    "EK10WV3V3C5A": "Kit válvula 3 vias ON/OFF 230 V para cassete FWC-D",
    "EK10WV2V3C5A": "Kit válvula 2 vias ON/OFF 230 V para cassete FWC-D",
    "EDT02D5A": "Tabuleiro de condensados adicional para válvulas (FWF-D)",
    "EDT03D5A": "Tabuleiro de condensados adicional para válvulas (FWC-D)",
})

# Opções por tamanho de VAM (colunas da grelha da p112) e de UTA Compact (p115-119). As
# baterias de reaquecimento e os registos externos da Compact R são os da Compact L de outro
# tamanho (ALD03HWUA serve a R 01 e a L 03, ao mesmo preço): um produto com os dois.
MESMO_GRUPO.update({
    "BRYMA": {"BRYMA65": "VAM 350-650, VKM 50", "BRYMA100": "VAM 800-1000, VKM 80-100",
              "BRYMA200": "VAM 1500-2000"},
    "GSIEKA": {"GSIEKA10009": "VAM 150", "GSIEKA15018": "VAM 250", "GSIEKA20024": "VAM 350-500, VKM",
               "GSIEKA25030": "VAM 650-1000", "GSIEKA35530": "VAM 1500-2000"},
    "EKMP-VAM": {"EKMP25VAM": "VAM 150-250", "EKMP65VAM": "VAM 650", "EKMPVAM": "VAM 1500-2000"},
    "KAF241": {"KAF241H80M": "VKM 50", "KAF241H100M": "VKM 80-100"},
    "UTA-COMPACT-REAQUECIMENTO": {"ALD02HWUA": "L 2", "ALD03HWUA": "R 1 / L 3", "ARD02HWUA": "R 2",
                                  "ALD05HWUA": "R 3 / L 5", "ARD04HWUA": "R 4", "ALD07HWUA": "R 5 / L 7",
                                  "ARD06HWUA": "R 6", "ARD07HWUA": "R 7"},
    "UTA-COMPACT-REGISTO-EXTERNO": {"ALA02EDA": "L 2", "ALA03EDA": "R 1 / L 3", "ARA02EDA": "R 2",
                                    "ALA05EDA": "R 3 / L 5", "ARA04EDA": "R 4", "ALA07EDA": "R 5 / L 7",
                                    "ARA06EDA": "R 6", "ARA07EDA": "R 7"},
    "UTA-T-BATERIA-DX-DIREITA": {"ATD03UDSAR": "3", **{f"ATD0{t}UDSBR": t for t in "4567"}},
    "UTA-T-BATERIA-DX-ESQUERDA": {"ATD03UDSAL": "3", **{f"ATD0{t}UDSBL": t for t in "4567"}},
    "FWCKX": {"FWCKRX": "direita", "FWCKLX": "esquerda"},
    "E2MV": {"E2MV03A6": "01-03", "E2MV06A6": "04-06", "E2MV10A6": "08-10, FWP 10-17"},
    "E2MVD": {"E2MVD03A6": "01-03", "E2MVD06A6": "04-06", "E2MVD10A6": "08-10"},
    "E2MV2B": {"E2MV2B07A6": "01-06", "E2MV2B10A6": "08-10"},
    "E4V2N": {"E4V2N05OV3WA": "04-05", "E4V2N08OV3WA": "06-08"},
    "ED2MV": {"ED2MV04A6": "04", "ED2MV10A6": "06-10", "ED2MV18A6": "12-18, só válvula e servomotor"},
    "EK-WV3V": {"EK02WV3V3W5A": "FWQ 04-07, FWE-F 04-12", "EK08WV3V3D5A": "FWQ 09-14",
                "EK04WV3V3C5A": "FWE-F 14-16", "EK06WV3V3C5A": "FWQ 17-25, FWE-F 20-24"},
    "EK-WV2V": {"EK02WV2V3W5A": "04-12", "EK04WV2V3C5A": "14-16", "EK06WV2V3C5A": "20-24"},
})
