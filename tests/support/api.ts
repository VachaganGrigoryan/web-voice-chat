/** The backend the real-backend spec talks to; the default is VoiceChat's local `api_test`. */
export const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:8001';

/** Set for vogi-server's dev stack, where `POST /dev/token` replaces the emailed code. */
export const DEV_SECRET = process.env.E2E_DEV_SECRET;

const API_HOSTS = ['localhost:8000', 'voca-api.notallow.cc', new URL(API_URL).host];

/** Requests the mocked specs intercept, whichever backend the app was started against. */
export function isApiRequest(url: string): boolean {
  return API_HOSTS.some((host) => url.includes(host));
}
