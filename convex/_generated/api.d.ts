/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as contract_list from "../contract/list.js";
import type * as contract_member from "../contract/member.js";
import type * as contract_post from "../contract/post.js";
import type * as lib_memberProfile from "../lib/memberProfile.js";
import type * as lib_postContent from "../lib/postContent.js";
import type * as lib_result from "../lib/result.js";
import type * as members from "../members.js";
import type * as model_follows from "../model/follows.js";
import type * as model_memberProjection from "../model/memberProjection.js";
import type * as model_members from "../model/members.js";
import type * as model_posts from "../model/posts.js";
import type * as posts from "../posts.js";
import type * as socialMigrations from "../socialMigrations.js";
import type * as status from "../status.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "contract/list": typeof contract_list;
  "contract/member": typeof contract_member;
  "contract/post": typeof contract_post;
  "lib/memberProfile": typeof lib_memberProfile;
  "lib/postContent": typeof lib_postContent;
  "lib/result": typeof lib_result;
  members: typeof members;
  "model/follows": typeof model_follows;
  "model/memberProjection": typeof model_memberProjection;
  "model/members": typeof model_members;
  "model/posts": typeof model_posts;
  posts: typeof posts;
  socialMigrations: typeof socialMigrations;
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

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
