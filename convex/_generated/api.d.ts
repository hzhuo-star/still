/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as contract_member from "../contract/member.js";
import type * as contract_post from "../contract/post.js";
import type * as lib_postContent from "../lib/postContent.js";
import type * as lib_result from "../lib/result.js";
import type * as members from "../members.js";
import type * as model_members from "../model/members.js";
import type * as model_posts from "../model/posts.js";
import type * as posts from "../posts.js";
import type * as status from "../status.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "contract/member": typeof contract_member;
  "contract/post": typeof contract_post;
  "lib/postContent": typeof lib_postContent;
  "lib/result": typeof lib_result;
  members: typeof members;
  "model/members": typeof model_members;
  "model/posts": typeof model_posts;
  posts: typeof posts;
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
