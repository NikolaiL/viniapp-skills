"use client";

import { useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export function MiniappProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const host = window as Window & { WorldApp?: unknown; ethereum?: { isMiniPay?: boolean } };
    if (host.WorldApp || host.ethereum?.isMiniPay) return;
    let cancelled = false;
    const style = document.documentElement.style;
    const previous = new Map<string, string>();
    // Splash dismissal must not wait for a cold context bridge.
    void sdk.actions.ready().catch(() => {});
    void (async () => {
      if (!(await sdk.isInMiniApp()) || cancelled) return;
      const context = await sdk.context;
      if (cancelled || !context.client.safeAreaInsets) return;
      const insets = context.client.safeAreaInsets;
      for (const side of ["top", "right", "bottom", "left"] as const) {
        const inset = insets[side];
        if (!Number.isFinite(inset) || inset < 0) continue;
        const name = `--safe-area-inset-${side}`;
        previous.set(name, style.getPropertyValue(name));
        style.setProperty(name, `max(env(safe-area-inset-${side}, 0px), ${inset}px)`);
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
      for (const [name, value] of previous) {
        if (value) style.setProperty(name, value);
        else style.removeProperty(name);
      }
    };
  }, []);

  return children;
}
