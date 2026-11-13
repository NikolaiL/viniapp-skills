# MiniPay

Read this when the user explicitly asks for the app to run inside Opera MiniPay.

MiniPay is a stablecoin wallet on Celo that opens web apps in its own browser
and injects an EIP-1193 provider. Check everything below against the current
[MiniPay docs](https://docs.minipay.xyz/) (there is also an
[LLM index](https://docs.minipay.xyz/llms.txt)) before you build on it.

## Detection

- Check `window.ethereum?.isMiniPay === true`. Never use Farcaster
  `sdk.isInMiniApp()`: it can return `false` in MiniPay while a wallet is present.
- On slow Android devices the provider can appear a little after first paint.
  Check on mount, check again after about 400 ms, then fall back to web.

```ts
const [isMiniPay, setIsMiniPay] = useState(false);
useEffect(() => {
  const detect = () => (window as any).ethereum?.isMiniPay === true;
  if (detect()) setIsMiniPay(true);
  const t = setTimeout(() => detect() && setIsMiniPay(true), 400);
  return () => clearTimeout(t);
}, []);
```

Keep detection in one provider, like the Farcaster one in [../SKILL.md](../SKILL.md).

## Wallet behavior

- The wallet is connected already. Connect to the injected connector on load;
  the docs say never to show a connect button inside MiniPay.
- The user's identity is their wallet address. Farcaster and World identities
  don't exist here, so wallet-only identity must work end to end.
- Message signing: the docs say not to ask users to sign a message to access
  the app or authenticate. Don't make SIWE, EIP-712 permits, or signed
  off-chain orders the only path; use an on-chain action or an app-owned
  server session. Whether `personal_sign`/typed data work at all is
  unverified; test on a device.
- Transaction types: unverified. Older guidance said legacy-only; current docs
  say MiniPay uses Celo fee-abstraction (CIP-64) transactions, which ethers.js
  doesn't support. Use viem and test a real send.

## Chain, assets, and fee currency

- Mainnet: Celo, chain ID `42220`. Testnet: Celo Sepolia (`11142220`); MiniPay
  supports only these two, not Alfajores.
- Users hold stablecoins, not CELO. Celo mainnet addresses from the
  [send-transaction reference](https://docs.minipay.xyz/technical-references/send-transaction.html)
  (testnet addresses and decimals differ; see that page):

| Token | Address | Decimals |
| --- | --- | --- |
| USDT | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 6 |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 |
| USDm (formerly cUSD) | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | 18 |

- Gas is paid in a stablecoin through Celo's `feeCurrency` field. MiniPay uses
  a requested `feeCurrency` only if the wallet holds a non-dust balance of it;
  otherwise it pays with the largest stablecoin balance. For 6-decimal tokens
  `feeCurrency` is an adapter address, not the token address. Copy it from the
  MiniPay reference or [Celo fee currencies](https://docs.celo.org/build/tools/contracts/fee-currencies); never guess.
- Put token addresses in configuration (environment variables) with empty
  placeholders in `.env.example`. Never hardcode them in components.
- If the app accepts several stablecoins, read `balanceOf` for each one in
  parallel with failures allowed. Normalize every balance to 18 decimals
  before comparing (USDT and USDC use 6) and pick the largest. Send the
  chosen token to the server, and make the server check it against an allowlist and verify payment in that exact token. A server that
  quietly verifies a different token produces "transaction rejected" errors.
- If the app supports only one stablecoin, name it in the UI. Don't imply that
  all of them work.
- Top-ups: the add-cash deeplink is `https://link.minipay.xyz/add_cash`
  (optional `?tokens=USDM,USDT,USDC`). The docs mark deeplinks "available
  soon" and say not to hardcode them; keep it in config. Save app or game state
  before opening it or any external swap link. Show a swap button only if the route it uses is confirmed to work on Celo.

For contract and transaction work in general, follow [../../wallets/SKILL.md](../../wallets/SKILL.md).
Verify payments on the server or on-chain, as [../../security/SKILL.md](../../security/SKILL.md) describes.

## Host UI

- Sharing: Farcaster compose isn't available. Use Web Share or an X intent
  link, with copy-link as the fallback.
- Hide links and calls to action that only make sense in another host, such as
  Farcaster token actions or World App flows.
- Don't brand the app as a MiniPay app unless the user asks.
- Layout: use `viewport-fit=cover` and paint `html`, `body`, and the app shell
  with the app background. Use `min-height: 100svh` and pad the bottom with the
  safe-area variables from [../../mobile/SKILL.md](../../mobile/SKILL.md).
  The host may report a `0` inset, so keep a small cushion. Check for a white
  strip at the bottom, a hidden footer, or a covered primary button.

## Testing

- In MiniPay (Android or iOS), tap the version in Settings > About to unlock
  Developer Settings, enable Developer Mode and "Use Testnet", then "Load test
  page" with your URL. Expose a local dev server with an HTTPS tunnel. See
  [Test in MiniPay](https://docs.minipay.xyz/getting-started/test-in-minipay.html).
- Desktop emulation with an injected mock provider tests layout and detection
  only. It doesn't prove signing, fee-currency, or payment behavior.
- Test a real stablecoin payment on testnet or with a small mainnet amount
  before you call the payment flow working.

## Listing prerequisites

- Follow the current [submission guidance](https://docs.minipay.xyz/getting-started/submit-your-miniapp.html).
  Listing is reviewed by MiniPay and happens outside the codebase.
- The owner needs a public HTTPS deployment, contracts verified on Celoscan,
  and sample transaction links for each user-facing contract method.
- Don't make up sample transaction links for a submission. If a funded payment
  test hasn't run yet, say so and leave the explorer links for the owner to add.
- Take token logos from the issuer's official media assets.
