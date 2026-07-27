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
import type * as imagens from "../imagens.js";
import type * as importData from "../importData.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_paginas from "../lib/paginas.js";
import type * as marcas from "../marcas.js";
import type * as migrations from "../migrations.js";
import type * as paginasCatalogo from "../paginasCatalogo.js";
import type * as produtos from "../produtos.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/health": typeof admin_health;
  imagens: typeof imagens;
  importData: typeof importData;
  "lib/auth": typeof lib_auth;
  "lib/paginas": typeof lib_paginas;
  marcas: typeof marcas;
  migrations: typeof migrations;
  paginasCatalogo: typeof paginasCatalogo;
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
