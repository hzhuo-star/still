/**
 * Order Posts newest-first by publication time.
 *
 * Equal publication times fall back to descending id, so every merge of the
 * same indexed ranges renders one deterministic order regardless of which
 * range produced each Post.
 *
 * @param left - One stored Post's ordering fields.
 * @param right - The other stored Post's ordering fields.
 * @returns A comparator result placing the newer Post first.
 */
export function byNewestFirst<
  T extends { readonly _creationTime: number; readonly _id: string },
>(left: T, right: T): number {
  return (
    right._creationTime - left._creationTime || (left._id < right._id ? 1 : -1)
  );
}
