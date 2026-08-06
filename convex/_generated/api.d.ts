/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as memberContract from "../memberContract.js";
import type * as members from "../members.js";
import type * as model_members from "../model/members.js";
import type * as model_posts from "../model/posts.js";
import type * as postContent from "../postContent.js";
import type * as postContract from "../postContract.js";
import type * as posts from "../posts.js";
import type * as result from "../result.js";
import type * as status from "../status.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  memberContract: typeof memberContract;
  members: typeof members;
  "model/members": typeof model_members;
  "model/posts": typeof model_posts;
  postContent: typeof postContent;
  postContract: typeof postContract;
  posts: typeof posts;
  result: typeof result;
  status: typeof status;
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
