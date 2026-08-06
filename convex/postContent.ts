import { err, ok, type Result } from "./result";

declare const postContentBrand: unique symbol;

/**
 * The parsed plain-text body of a Post: 1–280 characters after trimming
 * outer whitespace, with internal whitespace and line breaks preserved.
 */
export type PostContent = string & { readonly [postContentBrand]: true };

/** The maximum number of characters a Post may contain after trimming. */
export const MAX_POST_LENGTH = 280;

/** Why a draft could not become Post content. */
export type InvalidPostContentReason = "empty" | "too-long";

/** An expected failure to parse a Post draft into publishable content. */
export class InvalidPostContent extends Error {
  /** Stable error discriminator for exhaustive handling. */
  readonly _tag = "InvalidPostContent" as const;

  /**
   * Create a Post content parsing failure.
   *
   * @param reason - Why the draft was rejected.
   */
  constructor(readonly reason: InvalidPostContentReason) {
    super(`Invalid Post content: ${reason}`);
  }
}

/**
 * Parse an untrusted Post draft into publishable Post content.
 *
 * @param input - The raw draft text supplied by a Member.
 * @returns Trimmed Post content, or `InvalidPostContent` when the draft is
 *   blank or longer than {@link MAX_POST_LENGTH} characters after trimming.
 */
export function parse(input: string): Result<PostContent, InvalidPostContent> {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return err(new InvalidPostContent("empty"));
  }

  if (trimmed.length > MAX_POST_LENGTH) {
    return err(new InvalidPostContent("too-long"));
  }

  // SAFETY: TypeScript cannot express the brand. The trimmed string was
  // length-checked above, and callers cannot construct PostContent except
  // through this parser.
  return ok(trimmed as PostContent);
}

/**
 * Count the characters still available to a draft before it exceeds the
 * Post length limit, measured against the content that would publish.
 *
 * @param draft - The raw draft text currently in the composer.
 * @returns Remaining characters; negative when the trimmed draft is too long.
 */
export function remainingCharacters(draft: string): number {
  return MAX_POST_LENGTH - draft.trim().length;
}
