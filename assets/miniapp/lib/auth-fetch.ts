"use client";

import { sdk } from "@farcaster/miniapp-sdk";

/**
 * fetch that proves the Farcaster user to your API: inside a Farcaster host it attaches a
 * Quick Auth token (verify it on the server with verifiedFid from lib/quick-auth); on the
 * open web it is plain fetch, so routes must still handle signed-out callers.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const inHost = await sdk.isInMiniApp().catch(() => false);
  return inHost ? sdk.quickAuth.fetch(input, init) : fetch(input, init);
}
