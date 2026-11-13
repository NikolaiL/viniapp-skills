# Farcaster notifications

Read this when a Farcaster miniapp needs to send notifications to users who opted in.

The app owns the whole loop: a webhook that checks signatures, a token table
in the app's own database, and a sender that runs only on the server. Verify
event names, payload shapes, and limits against the
[official notifications guide](https://miniapps.farcaster.xyz/docs/guides/notifications)
before you build. Durable storage is a prerequisite (see [../../data/SKILL.md](../../data/SKILL.md)).
Without it, show an in-app alert and record server notifications as deferred.

## Decide first

- Notify only about things the user can act on or that can't wait: a challenge,
  their turn, something they were waiting on finishing, a direct interaction.
  Don't send marketing, routine updates, every message in a busy chat, or
  anything they'll see on their next visit anyway.
- For events while the app is open, use in-app updates such as SSE or polling,
  not notifications.

## Consent and manifest

- Set `webhookUrl` in the miniapp manifest to an absolute HTTPS route of the app.
- Users opt in when they add the app. Call `sdk.actions.addMiniApp()` from a
  clear user gesture, guard it against double taps, and treat rejection as a
  normal outcome. It works only on the domain that matches the manifest.
- Hide the add prompt once `context.client.added` is true, or once the
  `miniappAdded` SDK event fires (`sdk.on`). Remove the listener on unmount. Never block
  gameplay or core flows behind the prompt.
- Users can turn notifications off in the client at any time. If the app sends
  two or more kinds of notification, add per-type toggles that default to on.

## Webhook events

The client POSTs a JSON Farcaster Signature (`header`, `payload`,
`signature`) signed by the user's app key. Decoded, the event is one of:

| `event` | Action |
| --- | --- |
| `miniapp_added` | Upsert the token if `notificationDetails` is present |
| `notifications_enabled` | Upsert `notificationDetails` (`url`, `token`) |
| `notifications_disabled` | Disable or delete the tokens for that fid and client |
| `miniapp_removed` | Delete the tokens for that fid and client |

- Verify before any write: `parseWebhookEvent(body, verifyAppKeyWithNeynar)`
  from `@farcaster/miniapp-node` checks the signing key is an active app key
  for the `fid`. That helper needs `NEYNAR_API_KEY`, an explicit prerequisite. Never skip verification, and
  never trust an fid that comes only from the body or a request header.
- Return 2xx only after the write is committed, 4xx for bad signatures, and
  5xx for storage failures or `VerifyAppKeyError` so the client retries. Make the handlers
  idempotent, because a replayed event must leave the same final state.

## Token storage

```sql
CREATE TABLE notification_tokens (
  fid BIGINT NOT NULL,
  url TEXT NOT NULL,          -- client's send endpoint
  token TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (fid, url)
);
```

- A user can have one token for each Farcaster client, so key by (fid, url),
  not by fid alone.
- Tokens are credentials. Keep them on the server only, and never return them
  from an API route or write them to logs.

## Sending

Send only from server code, right after the database write that confirms the
event. Never expose a public "send notification" endpoint. The recipient comes
from server-owned state tied to an authenticated action. For a self-targeted
request, it is the fid from a verified Quick Auth token. Wallet-only users
have no fid, so skip them without failing the action.

POST to each stored `url` with JSON `{ notificationId, title, body, targetUrl, tokens }`,
batching up to 100 tokens per URL. The response lists `successfulTokens`,
`invalidTokens`, and `rateLimitedTokens`. Delete invalid tokens, and retry
rate-limited ones later, not right away.

- Limits: title ≤ 32 characters, body ≤ 128, `notificationId` ≤ 128,
  `targetUrl` ≤ 1024 with the exact registered hostname (`www.` on a bare-domain
  app fails with `target_url_mismatch` and invalidates the tokens).
  Plan templates for the worst case: the longest username, the biggest number.
- Rate limits (Farcaster client): 1 per 30 seconds and 100 per day per token.
  For events that can fire quickly, add a per-(fid, event type) cooldown table.
  Stamp it only after a successful send, and keep a bypass list for one-off
  events like game over.
- Idempotency: sends dedupe on (fid, `notificationId`) for 24 hours. Make it deterministic, for example `{event}_{entityId}_{fid}`, so
  a retry or a duplicate trigger can't send twice. Include the recipient fid so
  one event sent to many users doesn't collide.
- Don't let a failed send block or roll back the main action. Log the event
  type and fid, and record failures for retry. Mark a queued notification as
  sent only after the send succeeds.
- Address the recipient in second person ("Your move").

## Scheduled and broadcast sends

- For reminders and announcements, run a protected cron (with a bearer secret
  compared in constant time). Select events inside a time window and claim each
  one with `INSERT ... ON CONFLICT DO NOTHING RETURNING` on a key like
  `{event}:{id}`. Overlapping runs then send once.
- Store each run's counts (matched, notified, skipped, failed).
- A broadcast that ignores per-type preferences should be explicit in the code
  and kept for time-critical events. The client's own opt-out still applies.

## Optional third-party provider

A provider such as Neynar can host the webhook, store tokens, and send through
its API with your key. Choose it explicitly and record it as a dependency.
Then the provider holds the tokens, not your table. Don't run both paths for
the same users.

## Verify

- Test signature rejection, idempotent upserts, token cleanup, and length checks.
- Real delivery needs the deployed domain and a client that added the app.
  See [../../security/SKILL.md](../../security/SKILL.md) for secrets.
