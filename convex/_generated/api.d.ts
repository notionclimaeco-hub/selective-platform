/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_health from "../admin/health.js";
import type * as catalogo from "../catalogo.js";
import type * as comercial from "../comercial.js";
import type * as crons from "../crons.js";
import type * as empresas from "../empresas.js";
import type * as empresasActions from "../empresasActions.js";
import type * as encomendas from "../encomendas.js";
import type * as http from "../http.js";
import type * as imagens from "../imagens.js";
import type * as importData from "../importData.js";
import type * as importacoes from "../importacoes.js";
import type * as lib_aprovacao from "../lib/aprovacao.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_catalogoFiltros from "../lib/catalogoFiltros.js";
import type * as lib_catalogoGrupos from "../lib/catalogoGrupos.js";
import type * as lib_clerkOrganizations from "../lib/clerkOrganizations.js";
import type * as lib_emailFornecedor from "../lib/emailFornecedor.js";
import type * as lib_encomendaEstados from "../lib/encomendaEstados.js";
import type * as lib_especificacoes from "../lib/especificacoes.js";
import type * as lib_imagensGrupo from "../lib/imagensGrupo.js";
import type * as lib_importSecret from "../lib/importSecret.js";
import type * as lib_importacoes from "../lib/importacoes.js";
import type * as lib_nif from "../lib/nif.js";
import type * as lib_paginas from "../lib/paginas.js";
import type * as lib_precoRevenda from "../lib/precoRevenda.js";
import type * as lib_slug from "../lib/slug.js";
import type * as lib_specRegistry from "../lib/specRegistry.js";
import type * as lib_stagedSku from "../lib/stagedSku.js";
import type * as marcas from "../marcas.js";
import type * as migrations from "../migrations.js";
import type * as pagamentos from "../pagamentos.js";
import type * as paginasCatalogo from "../paginasCatalogo.js";
import type * as precos from "../precos.js";
import type * as produtos from "../produtos.js";
import type * as revolut_cliente from "../revolut/cliente.js";
import type * as revolut_fluxo from "../revolut/fluxo.js";
import type * as revolut_regras from "../revolut/regras.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/health": typeof admin_health;
  catalogo: typeof catalogo;
  comercial: typeof comercial;
  crons: typeof crons;
  empresas: typeof empresas;
  empresasActions: typeof empresasActions;
  encomendas: typeof encomendas;
  http: typeof http;
  imagens: typeof imagens;
  importData: typeof importData;
  importacoes: typeof importacoes;
  "lib/aprovacao": typeof lib_aprovacao;
  "lib/auth": typeof lib_auth;
  "lib/catalogoFiltros": typeof lib_catalogoFiltros;
  "lib/catalogoGrupos": typeof lib_catalogoGrupos;
  "lib/clerkOrganizations": typeof lib_clerkOrganizations;
  "lib/emailFornecedor": typeof lib_emailFornecedor;
  "lib/encomendaEstados": typeof lib_encomendaEstados;
  "lib/especificacoes": typeof lib_especificacoes;
  "lib/imagensGrupo": typeof lib_imagensGrupo;
  "lib/importSecret": typeof lib_importSecret;
  "lib/importacoes": typeof lib_importacoes;
  "lib/nif": typeof lib_nif;
  "lib/paginas": typeof lib_paginas;
  "lib/precoRevenda": typeof lib_precoRevenda;
  "lib/slug": typeof lib_slug;
  "lib/specRegistry": typeof lib_specRegistry;
  "lib/stagedSku": typeof lib_stagedSku;
  marcas: typeof marcas;
  migrations: typeof migrations;
  pagamentos: typeof pagamentos;
  paginasCatalogo: typeof paginasCatalogo;
  precos: typeof precos;
  produtos: typeof produtos;
  "revolut/cliente": typeof revolut_cliente;
  "revolut/fluxo": typeof revolut_fluxo;
  "revolut/regras": typeof revolut_regras;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
