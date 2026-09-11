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
import type * as comercial from "../comercial.js";
import type * as empresas from "../empresas.js";
import type * as empresasActions from "../empresasActions.js";
import type * as encomendas from "../encomendas.js";
import type * as imagens from "../imagens.js";
import type * as importData from "../importData.js";
import type * as lib_aprovacao from "../lib/aprovacao.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_clerkOrganizations from "../lib/clerkOrganizations.js";
import type * as lib_encomendaEstados from "../lib/encomendaEstados.js";
import type * as lib_nif from "../lib/nif.js";
import type * as lib_paginas from "../lib/paginas.js";
import type * as lib_precoRevenda from "../lib/precoRevenda.js";
import type * as lib_slug from "../lib/slug.js";
import type * as marcas from "../marcas.js";
import type * as migrations from "../migrations.js";
import type * as paginasCatalogo from "../paginasCatalogo.js";
import type * as precos from "../precos.js";
import type * as produtos from "../produtos.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/health": typeof admin_health;
  comercial: typeof comercial;
  empresas: typeof empresas;
  empresasActions: typeof empresasActions;
  encomendas: typeof encomendas;
  imagens: typeof imagens;
  importData: typeof importData;
  "lib/aprovacao": typeof lib_aprovacao;
  "lib/auth": typeof lib_auth;
  "lib/clerkOrganizations": typeof lib_clerkOrganizations;
  "lib/encomendaEstados": typeof lib_encomendaEstados;
  "lib/nif": typeof lib_nif;
  "lib/paginas": typeof lib_paginas;
  "lib/precoRevenda": typeof lib_precoRevenda;
  "lib/slug": typeof lib_slug;
  marcas: typeof marcas;
  migrations: typeof migrations;
  paginasCatalogo: typeof paginasCatalogo;
  precos: typeof precos;
  produtos: typeof produtos;
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
