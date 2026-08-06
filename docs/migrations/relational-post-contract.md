# Relational Post contract rehearsal

This runbook records the issue #15 rehearsal completed on 2026-08-06. It is evidence for a later production promotion, not authorization to change production. Production migration and deployment require a fresh explicit approval immediately before issue #16 performs them.

## Rehearsal scope

- Read-only source: production deployment `valiant-wolf-608`.
- Source snapshot export timestamp: `1786006291850779690`.
- Rehearsal target: personal development deployment `quirky-raven-776`.
- Preview fallback: `CONVEX_DEPLOY_KEY` was not configured, so the Convex migration-rehearsal procedure used its documented personal-development fallback rather than creating a paid-tier preview deployment.
- File storage was excluded because this migration changes only Post documents.
- Production received no write, schema push, migration, import, or deployment.

The production snapshot was imported under expansion commit `451d343`, which still accepted the legacy Standalone shape. The idempotent `migrations:backfillLegacyPosts` migration processed both legacy Posts in one batch. A second invocation returned `Migration already done` with unchanged start/finish timestamps and a processed count of two. The contracted schema then deployed successfully over the migrated snapshot.

## Assertions

The source snapshot contained 2 Posts, 1 Like, and 1 Member. Both Posts used the legacy missing-kind shape. After backfill it contained 2 explicit active Standalone Posts, 1 Like, 1 Member, and zero legacy rows.

Canonical before/after hashes matched for the fields that migration must preserve:

| Evidence                                                    | SHA-256                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Post IDs, creation times, authors, content, and Like counts | `621ebaed9576e74002375421fa54faf6158d706aedbdacc2f597da76644f8bae` |
| Like documents                                              | `487e3cceeffe4671c1425788368f958b34b8c413e5f7dc90c7bc44c24d57f97e` |
| Member documents                                            | `cf1a2c77e14e14ffa290cf5d20aa5e75a40e9675a97c499b6da08d5e97b9fdea` |
| Public Feed response                                        | `2582a6d81a2e6058cc178101aa682d6a212987686ba5538e6b7b51b0e0948f41` |
| Representative public Profile response                      | `6f6ba933e210e00827cb5509b180d108c584f50f0dffbbcbc50c337a93e02a01` |

After contraction, an inline deployment assertion reported 2 total Posts, 0 missing-kind Posts, and 0 malformed active Standalone Posts. The same Feed and Profile hashes still matched. Public smoke workflows on the snapshot-seeded target then proved Reply creation and Conversation resolution, Repost creation, Quote creation, Like creation, Profile inclusion of Quote/Repost/Standalone, authored deletion, and retained Conversation Tombstones.

The original development snapshot was restored through the same expand→backfill→contract sequence because it also contained two legacy Posts. Its final deployment contains the original 2 Posts, 1 Member, and 0 Likes, with 0 legacy rows. A canonical hash of Post IDs, creation times, authors, content, and Like counts matched before and after restoration: `c1ab498496ea421088d76aa4607d84dd1ba460099597ddcaac0534ceba082cdd`.

## Production promotion

Fresh issue #16 approval authorized production promotion on 2026-08-06. A new production snapshot was exported at timestamp `1786009278631343416` before any write or schema change. Expansion commit `451d343` deployed to `valiant-wolf-608`, and `migrations:backfillLegacyPosts` processed exactly two Posts in one batch at `2026-08-06T09:43:31.958Z`. Its second invocation returned `Migration already done` with the same start/finish timestamps and processed count.

Post-backfill assertions returned 2 Posts, 1 Like, 1 Member, zero legacy rows, and zero malformed active Standalone Posts. Canonical hashes matched before and after for normalized immutable Post fields (`da991314f2e7b5b28c4c1b3f05998626453c9e33c9648dcb00ac845c4f637e09`), Likes (`cef9185fdb3dcb8b5c5429af7fd5077c4a58b5744a506c41f3d5de614c7b8754`), and Members (`ed5d9010785da93dfaa328a9704767143745e90f5b8c641f31b6440e8a7dde10`). The Post hash normalizes integral Like counts because snapshot JSON serializes them as `0.0`/`1.0` while the live CLI serializes the same values as `0`/`1`.

Contracted commit `9a2e6f5` then passed production schema validation and unmounted the migrations component. GitHub main and Vercel Production deployment `5777168918` completed successfully. Production status, Feed, Profile, Conversation, and zero-legacy checks passed; the public Feed, Profile, and Conversation routes returned HTTP 200; and a browser smoke check rendered relational controls and focused contextual Reply composition with zero console errors. No rollback was required. The local sensitive snapshot and isolated expansion worktree were permanently deleted after verification and are not recoverable.

## Approved production procedure

Do not execute this section without fresh issue #16 approval and a new deployment-guard announcement before every command.

1. Export a new production snapshot immediately before the maintenance window and record its timestamp. Treat the archive as sensitive and never commit it.
2. From an isolated worktree at expansion commit `451d343`, deploy the expansion schema to the classified production deployment.
3. Run `npx convex run --prod migrations:backfillLegacyPosts '{}'` and retain its completed batch result.
4. Run the same command again and require `Migration already done` without changed timestamps or processed count.
5. Assert record totals, zero legacy rows, required counters, preserved immutable-field hashes, and representative Feed/Profile results.
6. From the approved contracted commit, deploy the required schema and application to production. The schema push itself is the final conformance gate.
7. Repeat the public Feed/Profile checks and relational Post smoke suite, then monitor logs and health before ending the maintenance window.

Use a short promotion window. If recovery is required, restore the fresh snapshot with `npx convex import <snapshot.zip> --replace-all --prod --yes` while targeting and announcing production. Snapshot restoration discards every write created after the snapshot timestamp; communicate that data-loss boundary before invoking it.

## Local artifact cleanup

The rehearsal archives lived only under a private temporary directory and were deleted after evidence capture. They are not recoverable from the working tree and were never staged or committed. Issue #16 must create a fresh snapshot rather than relying on the rehearsal copy.
