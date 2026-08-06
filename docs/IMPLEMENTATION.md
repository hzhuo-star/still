# Microblogging Showcase Implementation

## Purpose

Deliver a one-day internal engineering showcase of disciplined AI-assisted development using Next.js, Convex, and Clerk. The result is a team preview, not a production service or a full Twitter clone.

Read [`../CONTEXT.md`](../CONTEXT.md) for canonical product language and [`adr/0001-nextjs-and-convex-for-the-showcase.md`](adr/0001-nextjs-and-convex-for-the-showcase.md) for the stack rationale.

Treat [`../DESIGN-SYSTEM.md`](../DESIGN-SYSTEM.md) and [`../tailwind-theme.css`](../tailwind-theme.css) as the visual source of truth. No separate desktop or mobile mockup exists; derive responsive composition from the settled rules below.

Before any TypeScript engineering, read and apply the installed [`coding-standards` skill](/Users/funrepeat/.agents/skills/coding-standards/SKILL.md). It is the authority for errors, parsing, domain types, module roles, testing, TypeScript safety, imports, documentation, and configuration.

For issue-tracker, triage-label, and domain-document conventions, read the relevant guide under [`agents/`](agents/).

## Status

Planning is confirmed and implementation is authorized. The implementation specification is published as [GitHub issue #1](https://github.com/hzhuo-star/still/issues/1); tracer-bullet implementation tickets are published as issues #2–#9 with native blocking relationships.

## Agreed product boundary

- Public Feed containing the newest 50 Posts in reverse chronological order.
- Clerk sign-in; authenticated Members can publish and like Posts.
- Text-only Posts contain 1–280 trimmed characters. Authors can delete, but not edit, their Posts.
- Public, read-only Profiles use Clerk-projected display names and avatars and list the Member's Posts.
- New Posts, deleted Posts, and Like counts update reactively across browser sessions.
- No replies, reposts, following, personalized feeds, media, search, notifications, bookmarks, direct messages, profile editing, pagination, or infinite scrolling.

## Agreed technical shape

- Deploy Next.js through Vercel and the backend through Convex before starting product features.
- Use Clerk development credentials and describe the deployment as a preview.
- Use npm with a committed lockfile, select Node `24.x` on Vercel, and align `.node-version` with the tested local Node 24 patch.
- Import the public GitHub repository into Vercel. Override its build command with `npx convex deploy --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --cmd "npm run build"` so every successful deployment builds Next.js against and deploys the selected Convex backend.
- Keep the production `CONVEX_DEPLOY_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` in Vercel's Production environment. Keep `CLERK_JWT_ISSUER_DOMAIN` in the production Convex deployment. Commit an `.env.example`, ignore real environment files, and keep secrets out of diagnostics.
- Treat issue #2 as a hard deployment gate: the public Vercel URL must prove Clerk sign-in/sign-out and a real Convex query before any product feature ticket starts.
- Project authenticated Clerk identity into Convex with an idempotent client-triggered mutation. A Clerk webhook is a production follow-up.
- Use `members`, `posts`, and `likes` tables. Enforce authorization, ownership, uniqueness, validation, counters, and cascading Like deletion inside Convex mutations.
- Expose cohesive `Members` (`ensureCurrent`, `getProfile`) and `Posts` (`listFeed`, `listByMember`, `create`, `remove`, `toggleLike`) modules. Keep their registered Convex files as thin validated handlers over deep plain-TypeScript modules under `convex/model`; pass the existing Convex context directly so each workflow stays in one transaction. Keep Like persistence internal to `Posts`; add no repository or speculative adapter layer.
- Return complete immutable Post display models rather than raw records. Include author details, Like count, viewer Like state, and delete permission.
- Parse Post content into a refined value at the backend interface. Return precise tagged result values for expected failures; reserve throws for defects.
- Keep the root layout and static shell as server components. Isolate the Convex provider and reactive product behavior in focused client components.
- Use `/` for the Feed and `/members/[memberId]` for Profiles.
- Use strict TypeScript with the additional safety flags required by `coding-standards`. Use direct imports and document every exported symbol.
- Keep dependencies narrow: Convex validators, a small local tagged `Result`, Clerk, Tailwind, Vitest, and `convex-test`. Add no ORM, global state library, generic repository, Effect, Zod, or component library unless the selected design creates a concrete need.
- Give coding agents version-aligned framework context without vendoring the Next.js or Convex repositories. Retain the Next.js-managed instructions in `AGENTS.md` so agents read the bundled documentation in `node_modules/next/dist/docs/`. After the application and local Convex dependency exist, run `npx convex ai-files install`; retain its generated guidelines and managed agent-file sections, and use `npx convex ai-files status` to detect stale guidance.

## Interaction contract

- Acknowledge every action immediately. A control enters a visible pending state at interaction start even when its data change is not optimistic.
- Optimistically update Like state and count, with rollback on failure.
- Keep the Post composer content and deleted Post visible while their mutations are pending; disable duplicate submission and commit the visible change only on success.
- Show precise tagged failures inline with a clear retry path.
- Treat Post content as plain text: trim outer whitespace, preserve internal whitespace and line breaks, and rely on React escaping. Do not parse Markdown, links, mentions, or hashtags.
- Enable Next.js 16.3 Cache Components and Partial Prefetching with `cacheComponents: true` and `partialPrefetching: true`.
- Use prefetched static route shells, meaningful `loading.tsx` fallbacks, and default `<Link>` prefetching for navigation. Use `useLinkStatus` only as supplemental feedback when navigation can still block.
- Keep Convex Feed and Profile data uncached and reactive. Render local client-side skeletons while each `useQuery` subscription is pending because Partial Prerendering does not preload Convex data.

## Experience constraints

- Require semantic landmarks, keyboard operation, visible focus, labeled icon controls, sufficient contrast, reduced-motion support, and an accessible character counter.
- Use Next.js error boundaries, safe structured backend diagnostics, and explicit retry states. Add no analytics or third-party monitoring today.
- Use the supplied three-column shell at 1000px and wider, remove the context rail below 1000px, and use a sticky compact top bar below 800px.
- Use a text-only `Still` wordmark in the reading typeface. Add no separate logo asset.
- The desktop context rail contains one quiet “About Still” card describing the finite, live-updating Feed; it contains no trends, recommendations, rankings, or calls to action.
- Query 51 recent Posts, render at most 50, and use the extra result only to detect truncation. End the Feed with “You’re caught up” when complete or “Showing the latest 50 posts” when truncated.
- Use `Like` consistently in domain, code, tests, and interface copy. The selected state is `Liked`.
- Use the accessible Muted token `#6B726C`; reserve Danger `#9B3B3B` and Danger soft `#F5E9E7` for destructive and error feedback.

## Verification contract

- Vitest and `convex-test` cover authentication, Post length boundaries, ownership, Like uniqueness and counts, cascading deletion, and unauthenticated public reads.
- Manually verify the complete workflow and reactive behavior using two browser sessions on the deployed URL.
- Confirm coherent loading, empty, error, unauthorized, mobile, and desktop states with no known type or console errors.

## Implementation sequence

Complete and verify one milestone before beginning the next. Update the handoff ledger and create one cohesive Git commit after each verified milestone.

1. Scaffold the application and deploy a minimal authenticated shell through Clerk, Convex, and Vercel. Product feature work begins only after the deployed integration is verified.
2. Add the Post domain parser, Convex schema, deep module interfaces, and backend tests.
3. Complete the reactive Feed, publishing, Likes, deletion, and Profiles as one vertical slice.
4. Apply the selected design system, responsive behavior, accessibility, and immediate interaction feedback.
5. Deploy the completed preview, verify two-browser reactivity, prepare demo content, and finish documentation.

Initialize Git locally when implementation begins. The intended remote is a public repository; publishing it remains an explicit implementation action.

## Scope-pressure rule

If time or agent allowance becomes tight, remove work in this order: decorative motion and fine visual polish; optimistic Like updates while retaining immediate pending feedback; Profile-specific polish by reusing Feed cards; then nonessential README prose. Preserve server authorization, input parsing, core backend tests, reactive behavior, responsive usability, deployment, and the complete hero workflow.

## Showcase documentation

The final README briefly distinguishes human decisions from agent research, implementation, and verification; identifies Claude as a documented fallback; links the glossary and ADR; and lists verification commands. Raw chat transcripts are not part of the repository.

## Handoff ledger

Update this section after every milestone so a fresh agent can resume without chat history.

- Completed: product purpose, scope, language, stack, data ownership, reactive boundary, Vercel-first deployment gate, test strategy, interaction contract, visual system, responsive behavior, and implementation sequence agreed; specification #1 and tracer-bullet tickets #2–#9 published with `ready-for-agent` and verified native blockers; Next.js 16.3, strict TypeScript, Tailwind CSS v4, npm, and Node 24.18.1 scaffolded; Cache Components and Partial Prefetching enabled; Clerk and Convex configured; a responsive, accessible Still shell and public `status:get` Convex query implemented; Convex development and production deployments created; production environment values configured; the Convex-wrapped Vercel production build deployed to [still-virid.vercel.app](https://still-virid.vercel.app); `hzhuo-star/still` connected through the Vercel GitHub App with a successful repository-triggered production deployment; version-aligned Next.js and Convex agent guidance installed without vendoring framework repositories; the complete backend implemented — `members`/`posts`/`likes` schema with indexes, the `PostContent` domain parser (1–280 trimmed characters), and stable public `Members` (`ensureCurrent`, `getProfile`) and `Posts` (`listFeed`, `listByMember`, `create`, `remove`, `toggleLike`) interfaces returning complete immutable display models and precise tagged expected failures, with authorization, Like uniqueness, counter maintenance, and cascading Like deletion enforced inside Convex mutations and covered by 30 `convex-test` contract tests; the registered Convex files are thin validated handlers over deep `convex/model` workflow modules, the Posts model consumes a smaller Members interface without raw Member documents or Clerk projection mechanics, bounded Feed/Profile construction is local to the Posts model, and the pure client-safe `postContract` owns the display model, Feed limit, list ending, and expected outcomes without importing registered functions.
- Waiting on: the human-only remainder of the release ticket (#9) — two-browser manual verification on the deployed URL and demonstration content.
- Next action: on [still-virid.vercel.app](https://still-virid.vercel.app), verify the hero workflow in two independent browser sessions (sign-in, publish, Like, unlike, Profile navigation, author deletion, live cross-session updates), the signed-out/keyboard/reduced-motion/zoom/mobile passes, and the console-error check; prepare two Clerk development identities and six to ten realistic Posts manually; then close #9 recording the evidence here.
- Verification: `npm run format`, `npm run lint`, `npm run typecheck`, all Vitest suites (37 tests), and `npm run build` pass locally after the vertical-slice and hardening milestones; after the handler/model architecture refactor, the same 37 tests, typecheck, lint, formatting, and production build pass, and `npx convex dev --once` pushed the unchanged public function surface cleanly to development deployment `quirky-raven-776`; a fresh two-axis review of that refactor resolved null-encoded expected failures, a shallow Members middle man, stale JSDoc, and temporary handler-side outcome reconstruction, then passed both Standards and Spec with no remaining findings; the Profile route builds as a Partial Prerender; the development deployment previously returned an empty complete Feed from `posts:listFeed`; the dev server served `/` and `/members/[memberId]` with HTTP 200, and the rendered Feed route exposes the skip link, labeled primary navigation, `main#main-content`, the About Still rail, an sr-only page heading, and a labeled Feed region. The integrated experience covers skeleton/empty/retry/not-found states, pessimistic publishing and deletion with inline tagged failures, optimistic Likes with rollback feedback, threshold-based counter announcements, label-based Liked state, reduced-motion-safe placeholders, and 44px touch targets. A two-axis code review (Standards and Spec) ran against the milestone diff; its fixes landed in commit `2e9a382`, with two deliberate deviations recorded: Members key on `identity.tokenIdentifier` rather than the raw Clerk subject (mandated by the Convex auth guidelines), and Profile Post lists share the Feed's 50-Post bound with honest truncation copy (mandated by the bounded-query guideline). Pushing `main` (commit `c225d3e`) triggered the repository-connected Vercel production build, which deployed the Convex backend and reached the public URL: [still-virid.vercel.app](https://still-virid.vercel.app) serves the new Feed shell, and the production Convex deployment (`valiant-wolf-608`) answers `posts:listFeed` with an empty complete Feed over the public query API. Issues #3–#8 are closed with evidence comments. After the client/server import fix, the local Feed loaded with zero console errors; the remaining Clerk development-key warning is expected, and formatting, lint, typecheck, and all 37 tests pass. Remaining for #9 (manual, needs a browser): two-session reactive verification, signed-out affordances, keyboard/focus walkthrough, reduced motion, 200% zoom, mobile and desktop passes, console-error check, and demo identities and content; the README is complete.
