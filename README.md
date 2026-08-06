# Still

Still is a finite, reading-first social showcase built with Next.js, Convex, and Clerk. This first tracer bullet establishes the deployed responsive shell, authentication path, and a live read-only Convex query before product features are added.

Preview: [still-virid.vercel.app](https://still-virid.vercel.app)

The canonical product language lives in [CONTEXT.md](./CONTEXT.md). The implementation sequence and handoff ledger live in [docs/IMPLEMENTATION.md](./docs/IMPLEMENTATION.md), and the stack decision is recorded in [ADR 0001](./docs/adr/0001-nextjs-and-convex-for-the-showcase.md).

## What is implemented

- Next.js 16.3 App Router with Cache Components and Partial Prefetching
- strict TypeScript safety flags, Tailwind CSS v4, npm, and Node 24.18.1
- responsive Still shell with three-, two-, and one-column layouts
- Clerk development authentication with sign-in and account/sign-out controls
- Clerk-authenticated Convex provider composition
- public Convex `status:get` query rendered reactively in the browser
- meaningful prefetched shell, route error state, reduced-motion support, semantic landmarks, and visible keyboard focus

This is a preview deployment. Publishing, Posts, Likes, deletion, and Profiles belong to later tracer-bullet tickets.

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

The Convex test exercises the public function interface with the real schema through `convex-test`. Provider authentication and deployed reactivity are verified manually because the Clerk-hosted flow is intentionally outside the local automated seam.

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

Human decisions set the product boundary, domain language, stack, visual direction, interaction contract, and milestone order. Agents performed documentation research, ticket shaping, implementation, testing, deployment setup, and verification within those constraints. Claude is documented as a fallback implementation session; repository docs and the handoff ledger remain the shared source of truth.
