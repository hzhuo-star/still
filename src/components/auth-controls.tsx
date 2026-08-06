"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";

/** Renders the Clerk sign-in entry point or the signed-in account menu. */
export function AuthControls() {
  return (
    <div className="flex min-h-touch items-center justify-end gap-3">
      <Show when="signed-out">
        <SignInButton>
          <button
            className="min-h-touch cursor-pointer rounded-pill bg-sage px-4 text-sm font-medium text-white transition-colors ease-still hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            type="button"
          >
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <span className="hidden text-meta text-muted feed:inline">
          Preview member
        </span>
        <UserButton
          appearance={{ elements: { userButtonAvatarBox: "size-touch" } }}
        />
      </Show>
    </div>
  );
}
