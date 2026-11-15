import { createClient, Errors } from "@farcaster/quick-auth";

const client = createClient();

/** The host Quick Auth tokens are issued for: this app's public origin. */
function authDomain() {
  const url = process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("Set NEXT_PUBLIC_APP_URL to verify Quick Auth tokens.");
  return new URL(url).hostname;
}

// Bad tokens: jose ERR_JWS_*/ERR_JWT_*, plus a key id that is not in the issuer's key set
// (forged tokens). Other ERR_JWKS_* codes (timeouts, fetch failures) stay server errors.
const BAD_TOKEN_CODE = /^(ERR_JWS_|ERR_JWT_|ERR_JWKS_NO_MATCHING_KEY$|ERR_JWKS_MULTIPLE_MATCHING_KEYS$)/;

function isTokenError(error: unknown) {
  if (error instanceof Errors.InvalidTokenError) return true;
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && BAD_TOKEN_CODE.test(code);
}

/**
 * Server only. The verified Farcaster fid of the caller, or null when the request carries
 * no Quick Auth token. A forged, expired or malformed token throws a 401 Response; JWKS or
 * network failures throw as errors (answer 5xx). Never trust an fid from the request body.
 *
 *   const fid = await verifiedFid(request); // in a route handler
 *   if (fid === null) return Response.json({ error: "Sign in with Farcaster" }, { status: 401 });
 */
export async function verifiedFid(request: Request): Promise<number | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  if (!authorization.startsWith("Bearer ")) throw new Response("Invalid authorization", { status: 401 });
  try {
    const payload = await client.verifyJwt({ token: authorization.slice(7), domain: authDomain() });
    return Number(payload.sub);
  } catch (error) {
    if (isTokenError(error)) throw new Response("Invalid token", { status: 401 });
    throw error;
  }
}
