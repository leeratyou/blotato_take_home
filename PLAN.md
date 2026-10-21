# Plan

Current work. Move finished plans to [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md).

## Goal

Fix the receiver review findings so concurrent retries and malformed webhook collections cannot cause valid events to be lost.

## Steps

- [ ] **P1: Distinguish pending and completed idempotency claims.** A duplicate arriving during publication must await the original outcome or remain retryable; it must not report successful processing before publication succeeds.
- [ ] Add a regression test that blocks the first publication, submits a concurrent duplicate, then fails the publication. Verify the duplicate does not report success and a later retry can publish the event.
- [x] **P2: Isolate Instagram collection parsing.** Parse `changes` and `messaging` independently so a malformed collection cannot prevent valid sibling messages from being processed.
- [x] Add a regression test with `changes: {}` and valid `messaging`. Verify the valid message survives and the malformed collection is reported.
- [ ] Run typecheck and the receiver, adapter, resource, and idempotency-store tests.

## Next: Missing send confirmations

- [ ] Track **Sending unconfirmed** when an accepted send receives no `sending_confirm` within a defined timeout. Preserve the provider receipt and allow a late confirmation to change the status to `confirmed`. Missing confirmation alone must not trigger a resend.
- [ ] Add tests for on-time, missing, and late confirmations.

## Next: Kafka bus and high-volume ingestion

Goal: absorb bursts of 1M raw events without webhook timeouts while keeping each conversation in order.

Decisions:

- `events.comment_received`, `events.dm_message`, `events.sending_confirm`, `events.answer`, and `events.send` are keyed by `conversationId`. Kafka assigns `murmur2(key) % partitionCount`, so one conversation always lands in one partition within each topic; a partition holds many conversations, interleaved.
- `events.raw` has no key, so it spreads evenly. One webhook batch mixes conversations, and an account key would put a viral post on one partition. `occurredAt` restores order later.
- The partition count is chosen once, generously, and highly divisible (48 or 60). Adding partitions remaps keys and breaks per-conversation order.
- Every producer of a topic uses the same partitioner (`murmur2`); librdkafka clients default to a different hash.

Steps:

- [ ] Webhook endpoint: verify the signature, produce the raw body to `events.raw`, and return 200 without parsing.
- [ ] `OuterReceiver` consumes `events.raw` as a consumer group and calls the receiver handler with `(source, raw)`.
- [ ] Implement `EventBus.send`: topic `events.<type>`, key `conversationId`, idempotent producer.
- [ ] Replace `MemoryIdempotencyStore` with Redis `SET NX PX` shared by all workers (about 1 GB for 7M keys at a seven-day TTL).
- [ ] Retry failed raw messages with backoff, then move them to `events.raw.dlq`; send malformed items there too instead of only logging them.
- [ ] Consumers process different conversations in a partition concurrently and one conversation sequentially (for example Confluent Parallel Consumer, `ordering: KEY`). Commit offsets only up to the oldest unfinished event.
- [ ] Implement matching in `receiveEvent` before publishing, so non-matching comments never reach `events.comment_received`.
- [ ] Throttle the sender per account; drop events past provider windows (seven days for the first private reply, 24 hours for a follow-up) with a recorded reason.
- [ ] Load test with 1M raw events; measure consumer lag and end-to-end latency.
