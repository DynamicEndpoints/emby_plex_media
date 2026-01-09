/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admins from "../admins.js";
import type * as crons from "../crons.js";
import type * as friendCodes from "../friendCodes.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as notifications from "../notifications.js";
import type * as payments from "../payments.js";
import type * as revocations from "../revocations.js";
import type * as settings from "../settings.js";
import type * as stripe from "../stripe.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admins: typeof admins;
  crons: typeof crons;
  friendCodes: typeof friendCodes;
  http: typeof http;
  invites: typeof invites;
  notifications: typeof notifications;
  payments: typeof payments;
  revocations: typeof revocations;
  settings: typeof settings;
  stripe: typeof stripe;
  users: typeof users;
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
