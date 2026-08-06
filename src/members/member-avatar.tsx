import Image from "next/image";

type MemberAvatarProps = {
  /** The Member's projected display name, used for the fallback initial. */
  readonly displayName: string;
  /** The Member's projected avatar URL, when Clerk supplies one. */
  readonly avatarUrl: string | undefined;
  /** The rendered avatar size in pixels. */
  readonly sizePx: 34 | 56;
};

/**
 * Renders a Member's circular avatar, falling back to their initial on a
 * Sage-soft field when no avatar image is projected.
 */
export function MemberAvatar({
  displayName,
  avatarUrl,
  sizePx,
}: MemberAvatarProps) {
  const sizeClassName = sizePx === 34 ? "size-8.5 text-sm" : "size-14 text-xl";

  if (avatarUrl === undefined) {
    return (
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-pill bg-sage-soft font-medium text-sage ${sizeClassName}`}
      >
        {displayName.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <Image
      alt=""
      className={`shrink-0 rounded-pill bg-sage-soft object-cover ${sizeClassName}`}
      height={sizePx}
      src={avatarUrl}
      width={sizePx}
    />
  );
}
