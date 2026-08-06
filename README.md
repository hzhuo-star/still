# Still

Still is a finite, reading-first social showcase built with Next.js, Convex, and Clerk. Visitors read a public Feed and public Member Profiles; authenticated Members publish short text Posts, Like Posts, and delete their own Posts. New Posts, deletions, and Like counts update live across browser sessions, which is the point of the demonstration.

Preview: [still-virid.vercel.app](https://still-virid.vercel.app)

The canonical product language lives in [CONTEXT.md](./CONTEXT.md). The implementation sequence and handoff ledger live in [docs/IMPLEMENTATION.md](./docs/IMPLEMENTATION.md), the stack decision is recorded in [ADR 0001](./docs/adr/0001-nextjs-and-convex-for-the-showcase.md), relational Post deletion in [ADR 0002](./docs/adr/0002-model-relational-posts-with-tombstones.md), and the visual system in [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md). Issues [#1](https://github.com/hzhuo-star/still/issues/1)–[#9](https://github.com/hzhuo-star/still/issues/9) hold the original specification and tracer-bullet tickets.

## What is implemented

- A public Feed of the newest 50 Posts, newest first, ending with “You’re caught up.” when complete or “Showing the latest 50 posts.” when older Posts exist
- Clerk sign-in; authenticated Members publish 1–280 character plain-text Posts through an accessible composer with a live character counter
- Optimistic Like/unlike with rollback feedback, one Like per Member and Post, and transactionally maintained counts
- Author-only Post deletion with pessimistic pending feedback and transactional Like cleanup
- Public, read-only Member Profiles at `/members/[memberId]` with the Member's projected Clerk identity and Posts
- Reactive updates across browser sessions without refresh, through Convex subscriptions
- Precise tagged expected failures (unauthenticated, invalid content, forbidden, not found) handled exhaustively with inline retry paths
- Responsive three-, two-, and one-column Still shell, semantic landmarks, keyboard operation, visible focus, reduced-motion support, and 44px touch targets

## Planned extension—not yet implemented

The agreed next extension adds Replies, flat bounded Conversations, Quote Posts with shallow live previews, and unique reversible Reposts. Its complete product, persistence, interaction, migration, and verification contracts are recorded in [GitHub issue #10](https://github.com/hzhuo-star/still/issues/10) and [docs/IMPLEMENTATION.md](./docs/IMPLEMENTATION.md); implementation tickets [#11](https://github.com/hzhuo-star/still/issues/11)–[#16](https://github.com/hzhuo-star/still/issues/16) are dependency-linked and ready for agents. The extension is not yet implemented.

Still deliberately out of scope: following, personalized feeds, media, search, notifications, reporting, blocking, audience controls, moderation tooling, editing, pagination, and the other unchanged exclusions from issue #1.

## Preview limitations

This is a team preview, not a production service. Authentication uses Clerk development credentials on the Vercel domain, identity is projected into Convex by an idempotent client-triggered operation (Clerk webhooks are a documented follow-up), and there is no analytics, monitoring, or moderation tooling.

## Local setup

Use the Node version recorded in `.node-version`, then install dependencies:

```sh
npm install
```

Copy `.env.example` to `.env.local` and configure the documented names. Real environment files are ignored. Never commit or print credential values.

Connect Convex and synchronize the development deployment:

```sh
npx convex dev --once
```

The Convex deployment must define `CLERK_JWT_ISSUER_DOMAIN`, and the Clerk development instance must contain a JWT template named `convex` with audience `convex`.

Start the application:

```sh
npm run dev
```

## Verification

```sh
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npx convex ai-files status
```

The Vitest suites exercise the public `Members` and `Posts` Convex interfaces with the real schema through `convex-test`: authentication outcomes, identity projection idempotency, Post length boundaries and trimming, Feed ordering and truncation, Like uniqueness and counts, ownership enforcement, and cascading deletion. Provider authentication and deployed reactivity are verified manually because the Clerk-hosted flow is intentionally outside the local automated seam.

### Demonstration steps

1. Open the preview URL in two independent browser sessions and sign each into its own Clerk development identity.
2. Publish a Post in one session and watch it appear at the top of the other session's Feed without refresh.
3. Like and unlike the Post in one session and watch the count update live in the other.
4. Open the author's Profile from the Post, then delete the Post as its author and watch it disappear from both sessions.
5. Sign out and confirm the Feed and Profiles stay readable while write actions offer a sign-in path.

## Vercel deployment

Import the public GitHub repository into Vercel, select Node `24.x`, and override the production build command with:

```sh
npx convex deploy --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --cmd "npm run build"
```

Set these values only in Vercel's Production environment:

- `CONVEX_DEPLOY_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Set `CLERK_JWT_ISSUER_DOMAIN` on the production Convex deployment. Convex supplies `NEXT_PUBLIC_CONVEX_URL` to the Next.js build, so it does not need a separately maintained Vercel value.

## Human and agent roles

Human decisions set the product boundary, domain language, stack, visual direction, interaction contract, and milestone order. Agents performed documentation research, ticket shaping, implementation, testing, deployment setup, and verification within those constraints, including the backend contract tests and the two-axis standards/spec code review recorded in the ledger. Claude is documented as a fallback implementation session; repository docs and the handoff ledger remain the shared source of truth. Raw chat transcripts are intentionally not part of the repository.
