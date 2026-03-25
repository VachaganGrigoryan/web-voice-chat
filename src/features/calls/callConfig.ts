/**
 * How long to wait after an ICE connection drops before treating it as a
 * permanent disconnection and triggering the reconnect flow. A short grace
 * period absorbs brief network interruptions without surfacing reconnect UI.
 */
export const ICE_DISCONNECT_GRACE_MS = 3_000;

/**
 * After emitting a socket event to end or reject a call, how long to wait
 * before falling back to the REST API if no server acknowledgment arrives.
 * Keeps the call from hanging indefinitely when the socket is unreliable.
 */
export const TERMINAL_REST_FALLBACK_TIMEOUT_MS = 2_000;

/**
 * How long the end-call screen is shown before the call state resets to idle.
 * Long enough to read the message, short enough not to feel stuck.
 */
export const END_SCREEN_DURATION_MS = 2_500;
