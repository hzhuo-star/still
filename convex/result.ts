/** A successful outcome carrying the produced value. */
export type Ok<T> = { readonly _tag: "ok"; readonly value: T };

/** A failed outcome carrying the expected error value. */
export type Err<E> = { readonly _tag: "err"; readonly error: E };

/** The tagged outcome of an operation with expected failure modes. */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Wrap a value as a successful result.
 *
 * @param value - The produced value.
 * @returns A tagged `ok` result.
 */
export function ok<T>(value: T): Ok<T> {
  return { _tag: "ok", value };
}

/**
 * Wrap an expected error as a failed result.
 *
 * @param error - The expected failure value.
 * @returns A tagged `err` result.
 */
export function err<E>(error: E): Err<E> {
  return { _tag: "err", error };
}

/**
 * Signal that an internal invariant was violated.
 *
 * @param message - A safe description of the impossible condition.
 * @throws Always; reaching this call is a defect, not an expected failure.
 */
export function shouldNeverHappen(message: string): never {
  throw new Error(`Invariant violated: ${message}`);
}

/**
 * Assert at compile time that a union was handled exhaustively.
 *
 * @param unexpectedCase - The value TypeScript proved cannot exist.
 * @throws Always; reaching this call at runtime is a defect.
 */
export function casesHandled(unexpectedCase: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(unexpectedCase)}`);
}
