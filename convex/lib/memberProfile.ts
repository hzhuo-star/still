import { err, ok, type Result } from "./result";

declare const handleBrand: unique symbol;
declare const normalizedHandleBrand: unique symbol;
declare const displayNameBrand: unique symbol;
declare const biographyBrand: unique symbol;

/**
 * A parsed public Handle: 3–20 lowercase ASCII letters, digits, or underscores
 * beginning with a letter or digit.
 */
export type Handle = string & { readonly [handleBrand]: true };

/**
 * The case-folded Handle key that authoritatively owns a Handle. Two Members
 * may never hold the same normalized Handle, which is what makes Handle
 * comparison and uniqueness case-insensitive.
 */
export type NormalizedHandle = string & {
  readonly [normalizedHandleBrand]: true;
};

/** A parsed display name: 1–50 characters after trimming outer whitespace. */
export type DisplayName = string & { readonly [displayNameBrand]: true };

/** A parsed biography: 1–160 plain-text characters after trimming. */
export type Biography = string & { readonly [biographyBrand]: true };

/** The fewest characters a Handle may contain. */
export const MIN_HANDLE_LENGTH = 3;

/** The most characters a Handle may contain. */
export const MAX_HANDLE_LENGTH = 20;

/** The most characters a display name may contain after trimming. */
export const MAX_DISPLAY_NAME_LENGTH = 50;

/** The most characters a biography may contain after trimming. */
export const MAX_BIOGRAPHY_LENGTH = 160;

/** The Still-owned Profile field a Member submitted. */
export type ProfileField = "handle" | "display-name" | "biography";

/** Why a submitted Profile field could not become a parsed Profile value. */
export type InvalidProfileReason =
  "empty" | "too-short" | "too-long" | "invalid-format";

/** An expected failure to parse one submitted Still-owned Profile field. */
export class InvalidMemberProfile extends Error {
  /** Stable error discriminator for exhaustive handling. */
  readonly _tag = "InvalidMemberProfile" as const;

  /**
   * Create a Profile parsing failure naming the field the Member must fix.
   *
   * @param field - The submitted field that was rejected.
   * @param reason - Why that field was rejected.
   */
  constructor(
    readonly field: ProfileField,
    readonly reason: InvalidProfileReason,
  ) {
    super(`Invalid Member Profile ${field}: ${reason}`);
  }
}

/**
 * A claimed Handle beside the key that would own it.
 *
 * Both values are produced together so a caller cannot persist a Handle
 * without the key that makes its ownership case-insensitive. Folding makes
 * them equal today; keeping the key separate lets a later Handle change
 * release ownership without depending on the displayed field.
 */
export type HandleClaim = {
  /** The Handle Still shows on the Profile. */
  readonly handle: Handle;
  /** The case-folded key that owns the Handle. */
  readonly normalizedHandle: NormalizedHandle;
};

/** A parsed biography, or the explicit absence of one. */
export type MemberBiography =
  | { readonly _tag: "absent" }
  | { readonly _tag: "present"; readonly text: Biography };

/** The untrusted Still-owned Profile values a Member submitted. */
export type MemberProfileInput = {
  /** The requested public Handle. */
  readonly handle: string;
  /** The requested display name. */
  readonly displayName: string;
  /** The optional biography; blank text means no biography. */
  readonly biography: string;
};

/** Every Still-owned Profile value parsed from one submission. */
export type MemberProfileDraft = HandleClaim & {
  /** The parsed display name. */
  readonly displayName: DisplayName;
  /** The parsed biography, or its explicit absence. */
  readonly biography: MemberBiography;
};

// Anchored so the first character cannot be an underscore. Length is checked
// separately to tell "too short" and "too long" apart from a bad character.
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_]*$/iu;

/**
 * Parse an untrusted Handle submission into an ownable Handle claim.
 *
 * Handles are lowercase, so submitted capitals are folded rather than refused:
 * a Member who types capitals claims the same Handle as one who types
 * lowercase. Handle characters are ASCII, so the fold is locale-independent.
 *
 * @param input - The raw Handle text a Member submitted.
 * @returns The Handle claim, or `InvalidMemberProfile` when the trimmed text is
 *   blank, outside {@link MIN_HANDLE_LENGTH}–{@link MAX_HANDLE_LENGTH}
 *   characters, or contains anything but permitted characters.
 */
export function parseHandle(
  input: string,
): Result<HandleClaim, InvalidMemberProfile> {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return err(new InvalidMemberProfile("handle", "empty"));
  }

  if (trimmed.length < MIN_HANDLE_LENGTH) {
    return err(new InvalidMemberProfile("handle", "too-short"));
  }

  if (trimmed.length > MAX_HANDLE_LENGTH) {
    return err(new InvalidMemberProfile("handle", "too-long"));
  }

  if (!HANDLE_PATTERN.test(trimmed)) {
    return err(new InvalidMemberProfile("handle", "invalid-format"));
  }

  const folded = trimmed.toLowerCase();

  // SAFETY: TypeScript cannot express either brand. The trimmed text was
  // length-checked and matched against HANDLE_PATTERN above, and callers
  // cannot construct a Handle or NormalizedHandle except through this parser.
  return ok({
    handle: folded as Handle,
    normalizedHandle: folded as NormalizedHandle,
  });
}

/**
 * Parse an untrusted display-name submission.
 *
 * @param input - The raw display name a Member submitted.
 * @returns The trimmed display name, or `InvalidMemberProfile` when it is blank
 *   or longer than {@link MAX_DISPLAY_NAME_LENGTH} characters.
 */
export function parseDisplayName(
  input: string,
): Result<DisplayName, InvalidMemberProfile> {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return err(new InvalidMemberProfile("display-name", "empty"));
  }

  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    return err(new InvalidMemberProfile("display-name", "too-long"));
  }

  // SAFETY: TypeScript cannot express the brand. The trimmed text was
  // length-checked above, and callers cannot construct a DisplayName except
  // through this parser.
  return ok(trimmed as DisplayName);
}

/**
 * Parse an untrusted biography submission, treating blank text as no biography.
 *
 * @param input - The raw biography a Member submitted.
 * @returns The parsed biography or its explicit absence, or
 *   `InvalidMemberProfile` when the trimmed text is longer than
 *   {@link MAX_BIOGRAPHY_LENGTH} characters.
 */
export function parseBiography(
  input: string,
): Result<MemberBiography, InvalidMemberProfile> {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return ok({ _tag: "absent" });
  }

  if (trimmed.length > MAX_BIOGRAPHY_LENGTH) {
    return err(new InvalidMemberProfile("biography", "too-long"));
  }

  // SAFETY: TypeScript cannot express the brand. The trimmed text was
  // length-checked above, and callers cannot construct a Biography except
  // through this parser.
  return ok({ _tag: "present", text: trimmed as Biography });
}

/**
 * Parse one complete Still-owned Profile submission, reporting the first
 * field a Member must fix in the order the form presents them.
 *
 * @param input - The raw Profile values a Member submitted.
 * @returns Every parsed Profile value, or the first `InvalidMemberProfile`.
 */
export function parse(
  input: MemberProfileInput,
): Result<MemberProfileDraft, InvalidMemberProfile> {
  const claim = parseHandle(input.handle);
  if (claim._tag === "err") {
    return claim;
  }

  const displayName = parseDisplayName(input.displayName);
  if (displayName._tag === "err") {
    return displayName;
  }

  const biography = parseBiography(input.biography);
  if (biography._tag === "err") {
    return biography;
  }

  return ok({
    ...claim.value,
    displayName: displayName.value,
    biography: biography.value,
  });
}

/**
 * Project public Profile text into the normalized form Member Search indexes.
 *
 * Display names carry arbitrary Unicode, so this fold is explicitly English —
 * matching the showcase's Latin-script search scope — while
 * {@link parseHandle} folds its ASCII-only alphabet locale-independently.
 * Legacy Members are indexed from an unparsed display name, so the parts stay
 * plain strings rather than parsed Profile values.
 *
 * @param parts - The public values to index, such as a Handle and display name.
 * @returns One case-folded, single-spaced projection of those values.
 */
export function searchProjection(parts: ReadonlyArray<string>): string {
  return parts
    .join(" ")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/gu, " ");
}

/**
 * Count the characters still available to a biography draft, measured against
 * the text that would be stored.
 *
 * @param draft - The raw biography text currently in the form.
 * @returns Remaining characters; negative when the trimmed draft is too long.
 */
export function remainingBiographyCharacters(draft: string): number {
  return MAX_BIOGRAPHY_LENGTH - draft.trim().length;
}
