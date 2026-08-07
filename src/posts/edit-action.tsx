"use client";

import { useMutation } from "convex/react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { api } from "../../convex/_generated/api";
import type { AuthoredPostView } from "../../convex/contract/post";
import * as PostContent from "../../convex/lib/postContent";
import { casesHandled } from "../../convex/lib/result";
import { useOnboardingNavigation } from "@/members/registration";

type EditActionProps = {
  /** The active authored Post whose text this control edits. */
  readonly post: AuthoredPostView;
};

type EditComposerProviderProps = {
  /** Post cards whose edit actions share one persistent dialog host. */
  readonly children: ReactNode;
};

/** What the editor was asked to resolve before its draft can be saved. */
type EditFailure =
  | PostContent.InvalidPostContentReason
  | "post-not-found"
  | "not-author"
  | "not-editable"
  | "unauthenticated"
  | "connection";

/** A newer save the editor must choose between keeping or taking. */
type EditConflict = {
  /** The revision a retry must submit. */
  readonly revision: number;
  /** The text the winning save stored. */
  readonly content: string;
};

type EditComposerState =
  | {
      readonly _tag: "editing";
      readonly draft: string;
      readonly revision: number;
      readonly failure: EditFailure | null;
      readonly conflict: EditConflict | null;
    }
  | {
      readonly _tag: "pending";
      readonly draft: string;
      readonly revision: number;
    };

type EditSelection = {
  readonly post: AuthoredPostView;
  readonly trigger: HTMLButtonElement;
};

type EditComposerContextValue = {
  readonly open: (post: AuthoredPostView, trigger: HTMLButtonElement) => void;
};

const EditComposerContext = createContext<EditComposerContextValue | null>(
  null,
);

const actionClassName =
  "flex min-h-touch min-w-touch cursor-pointer items-center justify-center bg-transparent p-0 text-sm text-muted transition-colors ease-still hover:text-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-default disabled:opacity-60";

function failureMessage(reason: EditFailure): string {
  switch (reason) {
    case "empty":
      return "An edited Post still needs text. Restore some wording or delete the Post instead.";
    case "too-long":
      return `Posts hold at most ${PostContent.MAX_POST_LENGTH} characters.`;
    case "post-not-found":
      return "This Post is no longer available.";
    case "not-author":
      return "Only the author can edit a Post.";
    case "not-editable":
      return "This Post was deleted and can no longer be edited.";
    case "unauthenticated":
      return "Your session ended. Sign in again to save this edit.";
    case "connection":
      return "Your edit didn’t reach Still. Your draft is safe — try again.";
    default:
      return casesHandled(reason);
  }
}

function counterAnnouncement(remaining: number): string {
  if (remaining < 0) {
    return `Over the ${PostContent.MAX_POST_LENGTH} character limit.`;
  }
  if (remaining <= 20 && remaining % 10 === 0) {
    return `${remaining} characters left.`;
  }
  return "";
}

function useEditComposer(): EditComposerContextValue {
  const composer = useContext(EditComposerContext);

  if (composer === null) {
    throw new Error("EditAction must be rendered inside EditComposerProvider");
  }

  return composer;
}

function EditComposer({
  selection,
  close,
}: {
  readonly selection: EditSelection;
  readonly close: () => void;
}) {
  const { post, trigger } = selection;
  const [state, setState] = useState<EditComposerState>({
    _tag: "editing",
    draft: post.content,
    revision: post.revision,
    failure: null,
    conflict: null,
  });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editPost = useMutation(api.posts.edit);
  const onboarding = useOnboardingNavigation();

  const pending = state._tag === "pending";
  const draft = state.draft;
  const remaining = PostContent.remainingCharacters(draft);
  const conflict = state._tag === "editing" ? state.conflict : null;

  useEffect(() => {
    dialogRef.current?.showModal();
    textareaRef.current?.focus();
  }, []);

  const closeAndRestoreFocus = () => {
    dialogRef.current?.close();
    if (trigger.isConnected) {
      trigger.focus();
    }
    close();
  };

  const fail = (reason: EditFailure) => {
    setState({
      _tag: "editing",
      draft,
      revision: state.revision,
      failure: reason,
      conflict,
    });
  };

  const save = async () => {
    const parsed = PostContent.parse(draft);

    if (parsed._tag === "err") {
      fail(parsed.error.reason);
      return;
    }

    setState({ _tag: "pending", draft, revision: state.revision });

    try {
      const outcome = await editPost({
        postId: post.postId,
        expectedRevision: state.revision,
        content: parsed.value,
      });

      switch (outcome._tag) {
        case "ok":
          closeAndRestoreFocus();
          return;
        case "invalid-content":
          fail(outcome.reason);
          return;
        case "edit-conflict":
          // Keep the draft and let the author choose; never merge silently.
          setState({
            _tag: "editing",
            draft,
            revision: outcome.revision,
            failure: null,
            conflict: { revision: outcome.revision, content: outcome.content },
          });
          return;
        case "not-editable":
          fail("not-editable");
          return;
        case "post-not-found":
        case "not-author":
        case "unauthenticated":
          fail(outcome._tag);
          return;
        case "registration-required":
          onboarding.start();
          return;
        default:
          casesHandled(outcome);
      }
    } catch {
      fail("connection");
    }
  };

  return (
    <dialog
      aria-labelledby={`edit-title-${post.postId}`}
      className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-card border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) {
          closeAndRestoreFocus();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) {
          closeAndRestoreFocus();
        }
      }}
      ref={dialogRef}
    >
      <form
        className="p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending) {
            void save();
          }
        }}
      >
        <h2 className="text-lg font-semibold" id={`edit-title-${post.postId}`}>
          {post.kind === "quote" ? "Edit your commentary" : "Edit your Post"}
        </h2>
        <p className="mt-1 text-body text-muted">
          Editing keeps this Post where it is. Only the current wording is kept.
        </p>

        {conflict === null ? null : (
          <div
            className="mt-4 rounded-card border border-danger/20 bg-danger-soft p-4"
            role="alert"
          >
            <h3 className="text-body font-semibold text-danger">
              This Post changed somewhere else.
            </h3>
            <p className="mt-1 text-body text-ink">
              Your draft is kept. The saved wording is now:
            </p>
            <p className="mt-2 font-reading text-body whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">
              {conflict.content}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="min-h-touch cursor-pointer rounded-pill border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-sage focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
                onClick={() => {
                  setState({
                    _tag: "editing",
                    draft: conflict.content,
                    revision: conflict.revision,
                    failure: null,
                    conflict: null,
                  });
                  textareaRef.current?.focus();
                }}
                type="button"
              >
                Use the saved wording
              </button>
              <button
                className="min-h-touch cursor-pointer rounded-pill bg-sage px-4 text-sm font-medium text-white hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
                onClick={() => {
                  void save();
                }}
                type="button"
              >
                Keep my draft and save again
              </button>
            </div>
          </div>
        )}

        <label className="sr-only" htmlFor={`edit-draft-${post.postId}`}>
          {post.kind === "quote" ? "Quote commentary" : "Post text"}
        </label>
        <textarea
          aria-busy={pending}
          aria-describedby={`edit-counter-${post.postId}`}
          aria-invalid={
            state._tag === "editing" &&
            (state.failure === "empty" || state.failure === "too-long")
          }
          className="mt-4 min-h-28 w-full resize-y rounded-card border border-line bg-surface p-3 font-reading text-reading text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          id={`edit-draft-${post.postId}`}
          onChange={(event) => {
            if (state._tag === "editing") {
              setState({
                _tag: "editing",
                draft: event.target.value,
                revision: state.revision,
                failure: null,
                conflict: state.conflict,
              });
            }
          }}
          readOnly={pending}
          ref={textareaRef}
          rows={4}
          value={draft}
        />

        {state._tag === "editing" && state.failure !== null ? (
          <p className="mt-2 text-body text-danger" role="alert">
            {failureMessage(state.failure)}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p
            className={`text-meta ${remaining < 0 ? "text-danger" : "text-muted"}`}
            id={`edit-counter-${post.postId}`}
          >
            {remaining >= 0
              ? `${remaining} characters left`
              : `${-remaining} characters over`}
          </p>
          <p className="sr-only" role="status">
            {counterAnnouncement(remaining)}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="min-h-touch cursor-pointer rounded-pill px-4 text-sm text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-sage disabled:cursor-default disabled:opacity-60"
              disabled={pending}
              onClick={closeAndRestoreFocus}
              type="button"
            >
              Cancel
            </button>
            <button
              className="min-h-touch cursor-pointer rounded-pill bg-sage px-5 text-sm font-medium text-white hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-70"
              disabled={pending}
              type="submit"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}

/** Keeps one edit dialog alive even when its source card updates or unmounts. */
export function EditComposerProvider({ children }: EditComposerProviderProps) {
  const [selection, setSelection] = useState<EditSelection | null>(null);

  return (
    <EditComposerContext.Provider
      value={{
        open: (post, trigger) => {
          setSelection({ post, trigger });
        },
      }}
    >
      {children}
      {selection === null ? null : (
        <EditComposer
          close={() => {
            setSelection(null);
          }}
          key={selection.post.postId}
          selection={selection}
        />
      )}
    </EditComposerContext.Provider>
  );
}

/** Opens the shared edit dialog for a Post the viewer authored. */
export function EditAction({ post }: EditActionProps) {
  const composer = useEditComposer();

  return (
    <button
      aria-label={
        post.kind === "quote"
          ? "Edit your Quote commentary"
          : "Edit your Post text"
      }
      className={actionClassName}
      onClick={(event) => {
        composer.open(post, event.currentTarget);
      }}
      type="button"
    >
      Edit
    </button>
  );
}
