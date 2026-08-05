/**
 * The rule for a typed destructive confirmation.
 *
 * Pure so the match is asserted in tests rather than eyeballed, matching how
 * `headerActions.ts` and `inboxMenuItems.ts` keep their decisions out of
 * components.
 *
 * The comparison is exact and case-sensitive, like GitHub's repository delete.
 * A confirmation that accepted a constant word, or that matched loosely, would
 * protect against nothing: the keystrokes confirming the intended resource
 * would confirm an unintended one just as readily. Leading and trailing
 * whitespace is forgiven because it is a copy-paste artefact, not a signal of
 * intent.
 */
export const matchesConfirmPhrase = (
  typed: string,
  expected: string | null | undefined
): boolean => {
  if (!expected) return true; // No phrase required: a single-step confirmation.
  return typed.trim() === expected.trim();
};
