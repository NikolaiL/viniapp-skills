// Farcaster miniapp manifest. Verify field names and image limits against
// https://miniapps.farcaster.xyz/docs/guides/publishing before publishing.
// Prerequisites: a public HTTPS origin in NEXT_PUBLIC_APP_URL, real PNG assets
// in public/ (icon 1024×1024 no alpha, splash 200×200), and the owner's signed
// account association for that exact domain, generated at
// https://farcaster.xyz/~/developers/new (never copied or invented).
// imageUrl/buttonTitle are deprecated here; the fc:miniapp embed in layout.tsx sets them.
export const dynamic = "force-dynamic";

export function GET() {
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!origin) return Response.json({ error: "NEXT_PUBLIC_APP_URL is not configured." }, { status: 503 });

  let accountAssociation: unknown;
  try {
    accountAssociation = process.env.FARCASTER_ACCOUNT_ASSOCIATION ? JSON.parse(process.env.FARCASTER_ACCOUNT_ASSOCIATION) : undefined;
  } catch {
    return Response.json({ error: "FARCASTER_ACCOUNT_ASSOCIATION is not valid JSON." }, { status: 500 });
  }

  return Response.json({
    ...(accountAssociation ? { accountAssociation } : {}),
    miniapp: {
      version: "1",
      name: "Your app",
      homeUrl: origin,
      iconUrl: `${origin}/icon.png`,
      splashImageUrl: `${origin}/splash.png`,
      splashBackgroundColor: "#ffffff",
    },
  });
}
