/**
 * Studionet reports a contract refusal — for example `get_case` for an id that
 * does not exist — as a generic "execution failed" and drops the contract's own
 * message on the way back. Recognising that shape lets a page explain what
 * happened instead of printing raw transport text at the user.
 *
 * A network or transport failure must NOT match here: those deserve the real
 * message so the user can tell "this case does not exist" from "the RPC is
 * unreachable".
 */
export function isContractRefusal(message: string): boolean {
  return /execution failed|missing or invalid parameters/i.test(message);
}
