// injected/mock come from "wagmi", not the "wagmi/connectors" barrel: the barrel pulls in every
// wallet SDK (Base Account -> CDP SDK -> optional x402 modules) and breaks the webpack build.
import { createConfig, http, injected, mock } from "wagmi";
import { base, foundry } from "wagmi/chains";

// NEXT_PUBLIC_CHAIN_ID=31337 targets a local anvil chain and adds a connector for
// anvil's public test account, so browser tests can sign without an extension.
// Anything else targets Base. Slow polling: refetch explicitly after a write.
const local = process.env.NEXT_PUBLIC_CHAIN_ID === "31337";
export const targetChain = local ? foundry : base;

export const config = createConfig({
  chains: [targetChain],
  connectors: local ? [injected(), mock({ accounts: ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"] })] : [injected()],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
    [foundry.id]: http("http://127.0.0.1:8545"),
  },
  // Local anvil mines instantly; on Base poll slowly and pass pollingInterval: 1_000 to receipt waits.
  pollingInterval: local ? 1_000 : 30_000,
  ssr: true,
});
