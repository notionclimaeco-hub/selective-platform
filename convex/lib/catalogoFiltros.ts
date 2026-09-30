// The shop catalog's search, filters, facets and ordering, run in the browser
// over the listing index (`catalogo.indice`). Plain TypeScript with no Convex
// imports, like the spec registry: the client imports it to filter without a
// server round trip, and the backend tests cover it.
//
// The index is one compact line per product page (`LinhaIndice`), encoded on
// the server from `catalogoGrupos` by `codificarIndice` and decoded here by
// `lerIndice` into `GrupoIndice`. Encoding and decoding live side by side so
// the wire format cannot drift.

import {
  definicoesHero,
  PADRAO_CLASSE_ENERGETICA,
  type ChaveSpec,
} from "./specRegistry";

// --- Shared value helpers ------------------------------------------------------

/**
 * Search normalisation shared by the stored refs and the typed term: lower
 * case, no diacritics ("águas" and "aguas" must meet), single spaces.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Energy classes sort best-first (A+++ before A++ before B). */
export function ordemClasse(c: string): number {
  const letra = c.charCodeAt(0) - 65; // A = 0
  return letra * 10 - (c.length - 1);
}

function compararParClasses(a: string, b: string): number {
  // "-" (class not printed) after every class.
  const ordem = (lado: string | undefined) =>
    lado !== undefined && /^[A-G]\+*$/.test(lado) ? ordemClasse(lado) : 1000;
  const [af, ac] = a.split("/");
  const [bf, bc] = b.split("/");
  return ordem(af) - ordem(bf) || ordem(ac) - ordem(bc);
}

/**
 * Display order of a hero key's values: an enum's vocabulary order
 * (sim/opcional/nao, S…3XL); energy-class pairs best-first, cooling side then
 * heating side ("A+++/A+++" < "A+++/A++" < "A++/A+" < "-/A+"); otherwise
 * code-unit order.
 */
export function ordenarValores(
  def: ChaveSpec,
  valores: Iterable<string>,
): Array<string> {
  const vocabulario = def.tipo === "enum" ? (def.valores ?? []) : [];
  const posicao = (v: string) => {
    const i = vocabulario.indexOf(v);
    return i === -1 ? vocabulario.length : i;
  };
  const classes = def.padrao === PADRAO_CLASSE_ENERGETICA;
  return [...valores].sort(
    (a, b) =>
      posicao(a) - posicao(b) ||
      (classes ? compararParClasses(a, b) : 0) ||
      (a < b ? -1 : a > b ? 1 : 0),
  );
}

// --- Index -------------------------------------------------------------------------

/**
 * One hero spec of a product page, summarised over its published variants:
 * `numero` keys as a min–max span, `enum`/`texto` keys as their distinct
 * values in display order. Same shape as `destaqueValidator` in the schema.
 */
export type Destaque =
  | { chave: string; tipo: "intervalo"; min: number; max: number }
  | { chave: string; tipo: "valores"; valores: Array<string> };

/**
 * One product page as the index ships it. Short keys and omitted defaults keep
 * the whole catalog to one small cached payload; lines come newest first, so
 * their position is the "Novidades" order.
 */
export type LinhaIndice = {
  /** grupoModelo */
  g: string;
  /** Canonical ref (the product-page link). */
  r: string;
  /** Page name (nomeGrupo). */
  n: string;
  /** marca */
  m: string;
  /** familia */
  f: string;
  /** Lowest PVP among published variants, integer cents. */
  p: number;
  /** Variant count, when more than one. */
  v?: number;
  /** Presentation weight (`catalogoGrupos.peso`), when not 0. */
  w?: number;
  /** Set when the page has no cover photo. */
  x?: 1;
  gama?: string;
  /** tipoUnidade */
  t?: string;
  /** Hero specs by key: [min, max] for numeric keys, the values otherwise. */
  d?: Record<string, Array<number> | Array<string>>;
  /** Normalised refs of the other variants, space-separated (search). */
  b?: string;
};

/** The `catalogoGrupos` fields the index is built from. */
export type GrupoCatalogo = {
  grupoModelo: string;
  ref: string;
  nome: string;
  marca: string;
  familia: string;
  gama?: string;
  tipoUnidade?: string;
  precoDesdeCents: number;
  numVariantes: number;
  destaques?: Array<Destaque>;
  capa: string | null;
  textoBusca: string;
  peso: number;
  criadoEm: number;
};

/** One product page, decoded from the index and ready to search. */
export type GrupoIndice = {
  grupoModelo: string;
  ref: string;
  nome: string;
  marca: string;
  familia: string;
  gama?: string;
  tipoUnidade?: string;
  precoDesdeCents: number;
  numVariantes: number;
  destaques: Array<Destaque>;
  temCapa: boolean;
  peso: number;
  /** Position in newest-first order ("Novidades"). */
  recencia: number;
  /** Normalised name, refs, gama, marca and grupoModelo. */
  texto: string;
};

export function codificarIndice(
  grupos: ReadonlyArray<GrupoCatalogo>,
): Array<LinhaIndice> {
  return [...grupos]
    .sort((a, b) => b.criadoEm - a.criadoEm)
    .map((g) => {
      const linha: LinhaIndice = {
        g: g.grupoModelo,
        r: g.ref,
        n: g.nome,
        m: g.marca,
        f: g.familia,
        p: g.precoDesdeCents,
      };
      if (g.numVariantes !== 1) linha.v = g.numVariantes;
      if (g.peso !== 0) linha.w = g.peso;
      if (g.capa === null) linha.x = 1;
      if (g.gama !== undefined) linha.gama = g.gama;
      if (g.tipoUnidade !== undefined) linha.t = g.tipoUnidade;
      const destaques = g.destaques ?? [];
      if (destaques.length > 0) {
        linha.d = Object.fromEntries(
          destaques.map((d) => [
            d.chave,
            d.tipo === "intervalo" ? [d.min, d.max] : d.valores,
          ]),
        );
      }
      if (g.textoBusca !== "") linha.b = g.textoBusca;
      return linha;
    });
}

/**
 * Destaques back in registry order: Convex returns object keys sorted, so
 * the record's own order is lost on the wire.
 */
function lerDestaques(familia: string, d: LinhaIndice["d"]): Array<Destaque> {
  if (d === undefined) return [];
  return definicoesHero(familia).flatMap(({ chave }): Array<Destaque> => {
    const valores = d[chave];
    if (valores === undefined || valores.length === 0) return [];
    return typeof valores[0] === "number"
      ? [
          {
            chave,
            tipo: "intervalo",
            min: valores[0],
            max: valores[1] as number,
          },
        ]
      : [{ chave, tipo: "valores", valores: valores as Array<string> }];
  });
}

export function lerIndice(
  linhas: ReadonlyArray<LinhaIndice>,
): Array<GrupoIndice> {
  return linhas.map((l, recencia) => ({
    grupoModelo: l.g,
    ref: l.r,
    nome: l.n,
    marca: l.m,
    familia: l.f,
    gama: l.gama,
    tipoUnidade: l.t,
    precoDesdeCents: l.p,
    numVariantes: l.v ?? 1,
    destaques: lerDestaques(l.f, l.d),
    temCapa: l.x !== 1,
    peso: l.w ?? 0,
    recencia,
    texto: normalizarTexto(
      `${l.n} ${l.r} ${l.b ?? ""} ${l.gama ?? ""} ${l.m} ${l.g}`,
    ),
  }));
}

// --- Filtering -----------------------------------------------------------------

export type Ordenacao =
  "relevancia" | "preco-asc" | "preco-desc" | "nome" | "recentes";

/**
 * A hero-spec filter: a range for `numero` keys (either end open), a set of
 * values for the others. Empty ranges and empty sets filter nothing.
 */
export type FiltroDestaque =
  { min?: number; max?: number } | { valores: Array<string> };

export type Contagem = { valor: string; contagem: number };

/**
 * What the Filtros sheet offers for one hero key: the span of a numeric key,
 * or each value with the number of product pages carrying it.
 */
export type Faceta =
  | { chave: string; tipo: "intervalo"; min: number; max: number }
  | { chave: string; tipo: "valores"; valores: Array<Contagem> };

export type PedidoCatalogo = {
  busca?: string;
  familia?: string;
  marca?: string;
  /**
   * Hero-spec filters keyed by hero key, e.g. {"frio-kw": {min: 2, max: 4}}.
   * Only applied with a `familia`, and only for that familia's hero keys.
   */
  filtros?: Record<string, FiltroDestaque>;
  ordenar?: Ordenacao;
};

export type ResultadoCatalogo = {
  /** Every product page matching every filter, in the requested order. */
  grupos: Array<GrupoIndice>;
  /**
   * Families available given marca+busca (familia filter lifted) and brands
   * available given familia+busca+hero filters (marca filter lifted), so
   * picking one never hides the alternatives.
   */
  familias: Array<Contagem>;
  marcas: Array<Contagem>;
  /**
   * Hero-spec facets of the selected familia, in registry order, each over the
   * pages passing every other filter (its own lifted). Empty without a
   * familia; a key no remaining page carries is left out.
   */
  facetas: Array<Faceta>;
};

export function filtroAtivo(f: FiltroDestaque): boolean {
  return "valores" in f
    ? f.valores.length > 0
    : f.min !== undefined || f.max !== undefined;
}

/**
 * A range matches when the group's min–max overlaps it; a value set matches
 * when the group has any of the values. A group without the key never matches.
 */
function passaFiltro(
  destaque: Destaque | undefined,
  f: FiltroDestaque,
): boolean {
  if ("valores" in f) {
    return (
      destaque?.tipo === "valores" &&
      destaque.valores.some((valor) => f.valores.includes(valor))
    );
  }
  return (
    destaque?.tipo === "intervalo" &&
    (f.min === undefined || destaque.max >= f.min) &&
    (f.max === undefined || destaque.min <= f.max)
  );
}

function destaqueDe(g: GrupoIndice, chave: string): Destaque | undefined {
  return g.destaques.find((d) => d.chave === chave);
}

function contar(
  grupos: Array<GrupoIndice>,
  campo: "familia" | "marca",
): Array<Contagem> {
  const contagens = new Map<string, number>();
  for (const g of grupos) {
    contagens.set(g[campo], (contagens.get(g[campo]) ?? 0) + 1);
  }
  return [...contagens]
    .map(([valor, contagem]) => ({ valor, contagem }))
    .sort((a, b) => b.contagem - a.contagem || a.valor.localeCompare(b.valor));
}

function faceta(
  grupos: Array<GrupoIndice>,
  def: ChaveSpec,
): Faceta | undefined {
  const destaques = grupos
    .map((g) => destaqueDe(g, def.chave))
    .filter((d) => d !== undefined);
  if (def.tipo === "numero") {
    const intervalos = destaques.filter((d) => d.tipo === "intervalo");
    if (intervalos.length === 0) return undefined;
    return {
      chave: def.chave,
      tipo: "intervalo",
      min: Math.min(...intervalos.map((d) => d.min)),
      max: Math.max(...intervalos.map((d) => d.max)),
    };
  }
  const contagens = new Map<string, number>();
  for (const d of destaques) {
    if (d.tipo !== "valores") continue;
    for (const valor of d.valores) {
      contagens.set(valor, (contagens.get(valor) ?? 0) + 1);
    }
  }
  if (contagens.size === 0) return undefined;
  return {
    chave: def.chave,
    tipo: "valores",
    valores: ordenarValores(def, contagens.keys()).map((valor) => ({
      valor,
      contagem: contagens.get(valor) ?? 0,
    })),
  };
}

/**
 * How well a group matches the typed term, lower = better: a whole-word match
 * (typically an exact reference) beats a name that starts with the term, which
 * beats a name merely containing it, which beats a hit on refs/gama/marca.
 */
function grauCorrespondencia(g: GrupoIndice, termo: string): number {
  if (g.texto.split(" ").includes(termo)) return 0;
  const nome = normalizarTexto(g.nome);
  if (nome.startsWith(termo)) return 1;
  if (nome.includes(` ${termo}`)) return 2;
  if (nome.includes(termo)) return 3;
  return 4;
}

const colacao = new Intl.Collator("pt");

export function filtrarCatalogo(
  todos: ReadonlyArray<GrupoIndice>,
  pedido: PedidoCatalogo,
): ResultadoCatalogo {
  const termo = normalizarTexto(pedido.busca ?? "");
  // Every word must appear somewhere in the text, in any order — "daikin
  // mural" and "mural daikin" find the same products.
  const palavras = termo === "" ? [] : termo.split(" ");
  const passaBusca = (g: GrupoIndice) =>
    palavras.every((p) => g.texto.includes(p));
  const passaFamilia = (g: GrupoIndice) =>
    pedido.familia === undefined || g.familia === pedido.familia;
  const passaMarca = (g: GrupoIndice) =>
    pedido.marca === undefined || g.marca === pedido.marca;

  const defsHero =
    pedido.familia === undefined ? [] : definicoesHero(pedido.familia);
  const filtrosAtivos = defsHero.flatMap((def) => {
    const filtro = pedido.filtros?.[def.chave];
    return filtro && filtroAtivo(filtro) ? [{ chave: def.chave, filtro }] : [];
  });
  // Every active hero filter except `excepto` (the facet being computed).
  const passaDestaques = (g: GrupoIndice, excepto?: string) =>
    filtrosAtivos.every(
      ({ chave, filtro }) =>
        chave === excepto || passaFiltro(destaqueDe(g, chave), filtro),
    );

  const base = todos.filter(passaBusca);
  // Hero filters belong to the selected familia, so lifting familia for its
  // facet lifts them too.
  const familias = contar(base.filter(passaMarca), "familia");
  const daFamilia = base.filter(passaFamilia);
  const marcas = contar(
    daFamilia.filter((g) => passaDestaques(g)),
    "marca",
  );
  const daFamiliaEMarca = daFamilia.filter(passaMarca);
  const facetas = defsHero.flatMap((def) => {
    const f = faceta(
      daFamiliaEMarca.filter((g) => passaDestaques(g, def.chave)),
      def,
    );
    return f ? [f] : [];
  });
  const grupos = daFamiliaEMarca.filter((g) => passaDestaques(g));

  const ordenar = pedido.ordenar ?? "relevancia";
  const graus =
    ordenar === "relevancia" && termo !== ""
      ? new Map(grupos.map((g) => [g, grauCorrespondencia(g, termo)]))
      : undefined;
  grupos.sort((a, b) => {
    switch (ordenar) {
      case "preco-asc":
        return a.precoDesdeCents - b.precoDesdeCents;
      case "preco-desc":
        return b.precoDesdeCents - a.precoDesdeCents;
      case "nome":
        return colacao.compare(a.nome, b.nome);
      case "recentes":
        return a.recencia - b.recencia;
      default: {
        if (graus) {
          const grau = (graus.get(a) ?? 4) - (graus.get(b) ?? 4);
          if (grau !== 0) return grau;
        }
        if (a.peso !== b.peso) return a.peso - b.peso;
        return colacao.compare(a.nome, b.nome);
      }
    }
  });

  return { grupos, familias, marcas, facetas };
}

/**
 * The slice of `total` results shown on a 0-based page, with the page clamped
 * into range (filters can shrink the results under a shared link's page).
 */
export function paginar(
  total: number,
  pagina: number,
  porPagina: number,
): { pagina: number; numPaginas: number; inicio: number; fim: number } {
  const numPaginas = Math.max(1, Math.ceil(total / porPagina));
  const atual = Math.min(Math.max(0, Math.floor(pagina)), numPaginas - 1);
  return {
    pagina: atual,
    numPaginas,
    inicio: atual * porPagina,
    fim: Math.min(total, (atual + 1) * porPagina),
  };
}
