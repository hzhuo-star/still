"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useState, type ReactNode } from "react";

type ConvexClientProviderProps = {
  readonly children: ReactNode;
  readonly url: string;
};

/** Provides one authenticated Convex client for the application lifetime. */
export function ConvexClientProvider({
  children,
  url,
}: ConvexClientProviderProps) {
  const [client] = useState(() => new ConvexReactClient(url));

  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
