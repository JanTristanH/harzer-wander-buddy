export const OFFLINE_WRITE_BLOCKED_MESSAGE =
  'Du bist offline. Diese Aktion ist nur mit Internetverbindung verfuegbar.';

export const OFFLINE_REFRESH_MESSAGE =
  'Du bist offline. Es werden lokal gespeicherte Daten angezeigt.';

export class NetworkUnavailableError extends Error {
  constructor(message = OFFLINE_WRITE_BLOCKED_MESSAGE) {
    super(message);
    this.name = 'NetworkUnavailableError';
  }
}

export function requireOnlineForWrite(canPerformWrites: boolean, message?: string) {
  if (!canPerformWrites) {
    throw new NetworkUnavailableError(message);
  }
}

export function isNetworkUnavailableError(error: unknown): error is NetworkUnavailableError {
  return error instanceof NetworkUnavailableError ||
    (error instanceof Error && error.name === 'NetworkUnavailableError');
}
