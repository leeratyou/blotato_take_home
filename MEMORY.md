# Memory

Decisions and learned facts. Move stale entries to [MEMORY_ARCHIVE.md](MEMORY_ARCHIVE.md).

## 2026-10-21: Receiver idempotency key

The diagram annotates the receiver adapter with `recipient_id` and `timestamp`. Neither is used for deduplication:

- Idempotency key: `${source}:${type}:${providerEventId}`, stored as the inbound event `id`. Provider retries reuse their event id, so a retry maps to the same key. `type` is included because a confirmation can share an id with the message it confirms. When a source has no event id, use the sha256 of the raw payload; this misses duplicates if the provider re-serializes on retry.
- `recipient_id` becomes `conversationId`. Only the answering engine uses it, to load the whole conversation.
- `timestamp` becomes `occurredAt`, the provider timestamp, never the receive time. It is used only for ordering, because an earlier event can arrive after a later one due to network latency.

Why not `recipient_id + timestamp`: two distinct messages to the same recipient in the same timestamp would collide, and the second would be dropped.

Deduplication happens in the receiver use case through an `IdempotencyStore` port with an atomic `claim` (for example Redis `SET NX EX` or Postgres `INSERT ... ON CONFLICT DO NOTHING`) and a TTL at least as long as the provider's redelivery window. If publishing the New event fails, the use case calls `release` so the provider's retry is not treated as a duplicate.

The TTL is seven days: after that a comment can no longer receive a private reply, so a later redelivery cannot start the flow. The current store is in memory (`MemoryIdempotencyStore`), so keys are lost on restart and not shared between instances. A crash between `claim` and publishing loses the event; a transactional outbox closes this gap.

## 2026-10-21: Receiver batch failures

One webhook can carry several events, so one bad item must not block the rest:

- A malformed entry or item is logged and dropped; the webhook still succeeds. Retrying cannot fix it, and endless failures make Meta unsubscribe the webhook. Dropped items survive only in logs until a dead-letter store exists.
- An unknown source or unusable body (not an object, wrong `object`, `entry` not an array) throws, because nothing in it can be processed.
- `receiveEvents` processes each event independently and throws one `AggregateError` for the failures. A provider retry re-processes only those, because published events are skipped as duplicates.
