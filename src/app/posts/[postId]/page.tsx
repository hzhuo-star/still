import type { Metadata } from "next";

import { AuthControls } from "@/components/auth-controls";
import { QueryBoundary } from "@/components/query-boundary";
import { StillShell } from "@/components/still-shell";
import { ConversationView } from "@/posts/conversation-view";

/** Metadata for every stable public Conversation route. */
export const metadata: Metadata = {
  title: "Conversation — Still",
};

/** Renders one stable public Conversation while retaining the requested URL. */
export default async function ConversationPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly postId: string }>;
  readonly searchParams: Promise<{
    readonly compose?: string | ReadonlyArray<string>;
  }>;
}) {
  const [{ postId }, query] = await Promise.all([params, searchParams]);
  const composeReply = query.compose === "reply";

  return (
    <StillShell activeRoute="none" auth={<AuthControls />}>
      <QueryBoundary regionLabel="this Conversation">
        <ConversationView composeReply={composeReply} postId={postId} />
      </QueryBoundary>
    </StillShell>
  );
}
