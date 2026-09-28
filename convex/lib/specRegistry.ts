// Spec registry (product schema v4). Plain TypeScript with no Convex imports so
// the extraction scripts, both front ends and the backend all read the same
// list of allowed `atributos` keys per product category.
//
// `atributos` stays the ordered {chave, valor} store on `produtos`; this file
// says which keys are canonical for each `familia`, their type, unit, label,
// where they are required and which three are the "hero specs" shown on cards
// and at the top of a product page on phones. Unknown keys warn, wrong types
// reject — see `validarAtributos`.
//
// Exported to JSON for the Python extractor with `pnpm registry:json`.

export type TipoSpec = "numero" | "texto" | "enum" | "booleano";

export type Componente =
  | "conjunto"
  | "unidade-interior"
  | "unidade-exterior"
  | "deposito"
  | "acessorio"
  | "comando";

export type ChaveSpec = {
  chave: string;
  tipo: TipoSpec;
  // Display unit, e.g. "kW". Values never carry units — labels do.
  unidade?: string;
  // Portuguese label without unit.
  rotulo: string;
  // Componentes where the key must be present. Empty = optional everywhere.
  obrigatorio: ReadonlyArray<Componente>;
  hero: boolean;
  // Closed vocabulary for `enum` keys.
  valores?: ReadonlyArray<string>;
  // Regex source a `texto` value must match in full.
  padrao?: string;
  // Componentes the key applies to. Undefined = every componente.
  componentes?: ReadonlyArray<Componente>;
};

export type CategoriaSpecs = {
  chaves: ReadonlyArray<ChaveSpec>;
};

export type Atributo = { chave: string; valor: string };

export type ResultadoValidacao = { erros: Array<string>; avisos: Array<string> };

// --- Value patterns ----------------------------------------------------------

export const PADRAO_NUMERO = "^\\d+(\\.\\d+)?$";
// `frio/calor`, each side an EU class or `-` when the PDF omits it.
export const PADRAO_CLASSE_ENERGETICA =
  "^(A\\+{0,3}|[B-G]|-)/(A\\+{0,3}|[B-G]|-)$";
// AxLxP in mm, no units, decimals allowed.
export const PADRAO_DIMENSOES = "^\\d+(\\.\\d+)?x\\d+(\\.\\d+)?x\\d+(\\.\\d+)?$";
// Comma list of refs or series codes; `;` is the CSV pair separator.
export const PADRAO_LISTA = "^[^;]+$";

export const CORES = [
  "branco",
  "branco-perola",
  "preto",
  "prateado",
  "vermelho",
  "cinzento",
  "inox",
] as const;

const UI: ReadonlyArray<Componente> = ["conjunto", "unidade-interior"];
const UE: ReadonlyArray<Componente> = ["conjunto", "unidade-exterior"];

// --- Shared key definitions --------------------------------------------------

type Base = Omit<ChaveSpec, "obrigatorio" | "hero"> &
  Partial<Pick<ChaveSpec, "obrigatorio" | "hero">>;

function chave(def: Base): ChaveSpec {
  return { obrigatorio: [], hero: false, ...def };
}

const numero = (c: string, rotulo: string, unidade?: string): Base => ({
  chave: c,
  tipo: "numero",
  rotulo,
  ...(unidade ? { unidade } : {}),
});

const FRIO_KW = numero("frio-kw", "Frio", "kW");
const CALOR_KW = numero("calor-kw", "Calor", "kW");
const CLASSE_ENERGETICA: Base = {
  chave: "classe-energetica",
  tipo: "texto",
  rotulo: "Classe energética",
  padrao: PADRAO_CLASSE_ENERGETICA,
};
const BTU = numero("btu", "BTU");
const SEER = numero("seer", "SEER");
const SCOP = numero("scop", "SCOP");
const EER = numero("eer", "EER");
const COP = numero("cop", "COP");
const REFRIGERANTE: Base = {
  chave: "refrigerante",
  tipo: "texto",
  rotulo: "Refrigerante",
};
const WIFI: Base = {
  chave: "wifi",
  tipo: "enum",
  rotulo: "Wi-Fi",
  valores: ["sim", "opcional", "nao"],
};
const COR: Base = { chave: "cor", tipo: "enum", rotulo: "Cor", valores: CORES };
const ALIMENTACAO: Base = {
  chave: "alimentacao",
  tipo: "enum",
  rotulo: "Alimentação",
  valores: ["monofasica", "trifasica"],
};
const PRESSAO_ESTATICA: Base = {
  chave: "pressao-estatica",
  tipo: "enum",
  rotulo: "Pressão estática",
  valores: ["baixa", "media", "alta"],
};
const NIVEL_SONORO = numero("nivel-sonoro-db", "Nível sonoro", "dB");
const CAUDAL = numero("caudal-m3h", "Caudal", "m³/h");
const DEPOSITO_L = numero("deposito-l", "Depósito", "L");
const DIMENSOES: Base = {
  chave: "dimensoes",
  tipo: "texto",
  rotulo: "Dimensões AxLxP",
  unidade: "mm",
  padrao: PADRAO_DIMENSOES,
};
const DIMENSOES_UI: Base = {
  ...DIMENSOES,
  chave: "dimensoes-ui",
  rotulo: "Dimensões UI AxLxP",
  componentes: UI,
};
const DIMENSOES_UE: Base = {
  ...DIMENSOES,
  chave: "dimensoes-ue",
  rotulo: "Dimensões UE AxLxP",
  componentes: UE,
};
const FILTROS: Base = { chave: "filtros", tipo: "texto", rotulo: "Filtros" };
const COMPATIVEL_COM: Base = {
  chave: "compativel-com",
  tipo: "texto",
  rotulo: "Compatível com",
  padrao: PADRAO_LISTA,
};
const TIPO: Base = { chave: "tipo", tipo: "texto", rotulo: "Tipo" };

// --- Registry ----------------------------------------------------------------

const ACESSORIOS: CategoriaSpecs = {
  chaves: [
    chave({ ...TIPO, hero: true }),
    chave({ ...COMPATIVEL_COM, hero: true }),
    chave({ ...COR, hero: true }),
  ],
};

export const REGISTO_SPECS = {
  "ar-condicionado": {
    chaves: [
      chave({
        ...FRIO_KW,
        hero: true,
        obrigatorio: ["conjunto", "unidade-interior", "unidade-exterior"],
      }),
      chave({
        ...CALOR_KW,
        hero: true,
        obrigatorio: ["conjunto", "unidade-interior"],
      }),
      chave({ ...CLASSE_ENERGETICA, hero: true, obrigatorio: ["conjunto"] }),
      chave(BTU),
      chave(SEER),
      chave(SCOP),
      chave(REFRIGERANTE),
      chave(WIFI),
      chave(COR),
      chave({
        ...numero("unidades-max", "UI máx."),
        componentes: UE,
      }),
      chave(PRESSAO_ESTATICA),
      chave(DIMENSOES_UI),
      chave(DIMENSOES_UE),
      chave({
        chave: "tubagem",
        tipo: "texto",
        rotulo: "Tubagem líq./gás",
        unidade: "mm",
      }),
      chave(numero("comprimento-max-m", "Comprimento máx.", "m")),
      chave(numero("desnivel-max-m", "Desnível máx.", "m")),
      chave(ALIMENTACAO),
      chave(NIVEL_SONORO),
      chave(numero("frio-kw-min", "Frio mín.", "kW")),
      chave(numero("frio-kw-max", "Frio máx.", "kW")),
      chave(numero("calor-kw-min", "Calor mín.", "kW")),
      chave(numero("calor-kw-max", "Calor máx.", "kW")),
      chave({ ...COMPATIVEL_COM, componentes: ["unidade-exterior"] }),
    ],
  },
  "bombas-de-calor": {
    chaves: [
      chave({
        ...CALOR_KW,
        hero: true,
        obrigatorio: ["conjunto", "unidade-interior", "unidade-exterior"],
      }),
      chave({ ...CLASSE_ENERGETICA, hero: true, obrigatorio: ["conjunto"] }),
      chave({ ...DEPOSITO_L, hero: true }),
      chave(FRIO_KW),
      chave(COP),
      chave(SCOP),
      chave(numero("temp-agua-max", "Temp. água máx.", "°C")),
      chave(REFRIGERANTE),
      chave(ALIMENTACAO),
      chave(DIMENSOES_UI),
      chave(DIMENSOES_UE),
      chave(WIFI),
    ],
  },
  aqs: {
    chaves: [
      chave({ ...DEPOSITO_L, hero: true, obrigatorio: ["conjunto", "deposito"] }),
      chave({ ...CALOR_KW, hero: true }),
      chave({ ...CLASSE_ENERGETICA, hero: true }),
      chave(COP),
      chave({
        chave: "perfil-carga",
        tipo: "enum",
        rotulo: "Perfil de carga",
        valores: ["S", "M", "L", "XL", "XXL", "3XL"],
      }),
      chave(REFRIGERANTE),
      chave(ALIMENTACAO),
      chave(DIMENSOES),
    ],
  },
  ventilacao: {
    chaves: [
      chave({ ...CAUDAL, hero: true, obrigatorio: ["conjunto"] }),
      chave({ ...numero("rendimento-pct", "Rendimento", "%"), hero: true }),
      chave({ ...NIVEL_SONORO, hero: true }),
      chave(numero("pressao-estatica-pa", "Pressão estática", "Pa")),
      chave(numero("consumo-w", "Consumo", "W")),
      chave(FILTROS),
      chave(DIMENSOES),
      chave({
        chave: "seccao-conduta",
        tipo: "texto",
        rotulo: "Secção da conduta",
        unidade: "mm",
      }),
    ],
  },
  ventiloconvectores: {
    chaves: [
      chave({
        ...FRIO_KW,
        hero: true,
        obrigatorio: ["conjunto", "unidade-interior"],
      }),
      chave({
        ...CALOR_KW,
        hero: true,
        obrigatorio: ["conjunto", "unidade-interior"],
      }),
      chave({
        chave: "tubos",
        tipo: "enum",
        rotulo: "Tubos",
        valores: ["2", "4"],
        hero: true,
      }),
      chave(CAUDAL),
      chave(PRESSAO_ESTATICA),
      chave(NIVEL_SONORO),
      chave(DIMENSOES),
    ],
  },
  chillers: {
    chaves: [
      chave({ ...FRIO_KW, hero: true, obrigatorio: ["conjunto"] }),
      chave({ ...CALOR_KW, hero: true }),
      chave({ ...ALIMENTACAO, hero: true }),
      chave(EER),
      chave(COP),
      chave(SEER),
      chave(SCOP),
      chave(REFRIGERANTE),
      chave({ chave: "compressor", tipo: "texto", rotulo: "Compressor" }),
      chave(DIMENSOES),
      chave(numero("peso-kg", "Peso", "kg")),
    ],
  },
  "cortinas-de-ar": {
    chaves: [
      chave({
        ...numero("comprimento-mm", "Comprimento", "mm"),
        hero: true,
        obrigatorio: ["conjunto"],
      }),
      chave({ ...CAUDAL, hero: true }),
      chave({ ...CALOR_KW, hero: true }),
      chave(ALIMENTACAO),
      chave(NIVEL_SONORO),
    ],
  },
  "purificadores-de-ar": {
    chaves: [
      chave({
        ...numero("area-m2", "Área", "m²"),
        hero: true,
        obrigatorio: ["conjunto"],
      }),
      chave({ ...numero("cadr-m3h", "CADR", "m³/h"), hero: true }),
      chave({ ...NIVEL_SONORO, hero: true }),
      chave(FILTROS),
      chave(DIMENSOES),
    ],
  },
  "acessorios-e-controlo": ACESSORIOS,
  outros: ACESSORIOS,
} as const satisfies Record<string, CategoriaSpecs>;

export type Familia = keyof typeof REGISTO_SPECS;

export const FAMILIAS_REGISTO = Object.keys(REGISTO_SPECS) as Array<Familia>;

function categoria(familia: string): CategoriaSpecs | undefined {
  return (REGISTO_SPECS as Record<string, CategoriaSpecs>)[familia];
}

/** Hero keys of a familia, in display order. */
export function heroSpecs(familia: string): Array<string> {
  return (categoria(familia)?.chaves ?? [])
    .filter((c) => c.hero)
    .map((c) => c.chave);
}

/** Registered keys that apply to `componente` within `familia`. */
export function chavesDaCategoria(
  familia: string,
  componente: Componente,
): Array<ChaveSpec> {
  return (categoria(familia)?.chaves ?? []).filter(
    (c) => !c.componentes || c.componentes.includes(componente),
  );
}

// First definition wins when a key is shared by several familias — labels and
// units are the same everywhere by construction (shared Base constants).
const ROTULOS: Map<string, ChaveSpec> = new Map();
for (const familia of FAMILIAS_REGISTO) {
  for (const c of REGISTO_SPECS[familia].chaves) {
    if (!ROTULOS.has(c.chave)) ROTULOS.set(c.chave, c);
  }
}

/** Portuguese label with unit ("Frio (kW)"); unknown keys are humanised. */
export function rotuloChave(chave: string): string {
  const def = ROTULOS.get(chave);
  if (def) return def.unidade ? `${def.rotulo} (${def.unidade})` : def.rotulo;
  const texto = chave.replace(/-/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Type check of one value against its key definition. Returns the error. */
export function validarValor(def: ChaveSpec, valor: string): string | undefined {
  switch (def.tipo) {
    case "numero":
      if (!new RegExp(PADRAO_NUMERO).test(valor)) {
        return `${def.chave}: "${valor}" não é um número (ponto decimal, sem unidade)`;
      }
      return undefined;
    case "enum":
      if (!def.valores?.includes(valor)) {
        return `${def.chave}: "${valor}" não é um valor válido (${(def.valores ?? []).join(", ")})`;
      }
      return undefined;
    case "booleano":
      if (valor !== "sim" && valor !== "nao") {
        return `${def.chave}: "${valor}" não é booleano (sim, nao)`;
      }
      return undefined;
    case "texto":
      if (def.padrao && !new RegExp(def.padrao).test(valor)) {
        return `${def.chave}: "${valor}" não segue o formato esperado (${def.padrao})`;
      }
      return undefined;
  }
}

/**
 * Validate a SKU's `atributos` against the registry.
 * Errors (reject): unknown familia, wrong type / enum / pattern, duplicate key.
 * Warnings (review): unknown key, key outside its componentes, missing required.
 */
export function validarAtributos(
  familia: string,
  componente: Componente,
  atributos: ReadonlyArray<Atributo>,
): ResultadoValidacao {
  const erros: Array<string> = [];
  const avisos: Array<string> = [];
  const cat = categoria(familia);
  if (!cat) {
    return { erros: [`familia "${familia}" desconhecida no registo`], avisos };
  }
  const defs = new Map(cat.chaves.map((c) => [c.chave, c]));
  const vistas = new Set<string>();

  for (const { chave: k, valor } of atributos) {
    if (vistas.has(k)) {
      erros.push(`${k}: chave duplicada`);
      continue;
    }
    vistas.add(k);
    const def = defs.get(k);
    if (!def) {
      avisos.push(`${k}: chave desconhecida para ${familia}`);
      continue;
    }
    if (def.componentes && !def.componentes.includes(componente)) {
      avisos.push(
        `${k}: não se aplica a ${componente} (só ${def.componentes.join(", ")})`,
      );
    }
    const erro = validarValor(def, valor);
    if (erro) erros.push(erro);
  }

  for (const def of cat.chaves) {
    if (def.obrigatorio.includes(componente) && !vistas.has(def.chave)) {
      avisos.push(
        `${def.chave}: obrigatório em ${familia}/${componente} e está em falta`,
      );
    }
  }

  return { erros, avisos };
}
