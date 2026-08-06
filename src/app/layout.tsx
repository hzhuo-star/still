import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { ConvexClientProvider } from "@/components/convex-client-provider";
import { ShellLoading } from "@/components/shell-loading";
import { parsePublicConfig } from "@/config/public-config";
import { MemberSync } from "@/members/member-sync";

import "./globals.css";

/** Metadata shared by the Still preview routes. */
export const metadata: Metadata = {
  title: "Still — a finite social feed",
  description: "A reading-first social product showcase.",
};

/** Provides application configuration, Clerk, and Convex at the root. */
export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const config = parsePublicConfig({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  });

  if (config._tag === "err") {
    return (
      <html lang="en">
        <body>
          <main className="mx-auto flex min-h-screen max-w-feed items-center px-5">
            <section
              aria-labelledby="configuration-title"
              className="w-full rounded-card border border-danger/20 bg-danger-soft p-6"
            >
              <p className="text-label font-semibold tracking-wider text-danger uppercase">
                Configuration required
              </p>
              <h1
                className="mt-2 font-reading text-2xl text-ink"
                id="configuration-title"
              >
                Still cannot connect yet
              </h1>
              <p className="mt-3 text-body text-ink">
                Add the following environment variables, then restart the
                application:
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 font-mono text-sm text-danger">
                {config.error.issues.map((issue) => (
                  <li key={issue.name}>{issue.name}</li>
                ))}
              </ul>
            </section>
          </main>
        </body>
      </html>
    );
  }

  return (
    <html className="h-full antialiased" lang="en">
      <body className="min-h-full">
        <ClerkProvider publishableKey={config.value.clerkPublishableKey}>
          <Suspense fallback={<ShellLoading />}>
            <ConvexClientProvider url={config.value.convexUrl}>
              <MemberSync />
              {children}
            </ConvexClientProvider>
          </Suspense>
        </ClerkProvider>
      </body>
    </html>
  );
}
