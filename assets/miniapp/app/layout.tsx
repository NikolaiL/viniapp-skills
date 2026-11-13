import type { Metadata, Viewport } from "next";
import { MiniappProvider } from "../components/MiniappProvider";
import "./globals.css";

const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

// The embed needs absolute URLs, so it is emitted only when the public origin is known.
// Verify the embed shape against https://miniapps.farcaster.xyz/docs/guides/sharing.
// The legacy fc:frame tag carries the same JSON with type "launch_frame" for older clients.
const embedFor = (type: string) => JSON.stringify({
  version: "1",
  imageUrl: `${origin}/embed.png`, // 3:2, ≤ 1024 chars
  button: {
    title: "Open", // ≤ 32 chars
    action: { type, name: "Your app", url: origin, splashImageUrl: `${origin}/splash.png`, splashBackgroundColor: "#ffffff" },
  },
});

export const metadata: Metadata = {
  title: "Your app",
  description: "An independent app starter. Replace this metadata with the product's identity.",
  ...(origin ? { other: { "fc:miniapp": embedFor("launch_miniapp"), "fc:frame": embedFor("launch_frame") } } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><MiniappProvider>{children}</MiniappProvider></body></html>;
}
