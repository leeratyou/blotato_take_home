# Architecture

## Overview

The target system uses an event bus to connect social-network event ingestion, answer generation, message delivery, and analytics. Receiver adapters convert incoming integration events into internal events. Answering engines generate responses, sender adapters dispatch them through the existing integration, and analytics workers consume events for internal and external reporting.

The SNS Receiver and SNS Sender are existing integration boundaries, shown as black boxes.

This document describes the target design in [Architecture.pdf](Architecture.pdf). The current application contains a Fastify server, a health endpoint, inbound normalization, placeholder answering, sender adapters, and in-memory idempotency and delivery tracking. Event-bus publication and the external sender and receiver remain integration stubs managed through DI and lifecycle hooks. [Architecture.mermaid.md](Architecture.mermaid.md) contains the diagram transcription and source annotations.

## System diagram

Dashed arrows represent event connections. The solid connector associates the answering engine with its resource enclosure. Nodes marked "Multiple instances" represent the stacked workers in the PDF.

## Components

| Component | Responsibility |
| --- | --- |
| SNS Receiver | Supplies incoming SNS events and receives delivery-confirmation events when the integration provides them. |
| Load balancers | Distribute work at four boundaries: receiving, answering, sending, and analytics. Their concrete implementation is not selected in the PDF. |
| Receiver resource | Adapters validate and normalize incoming SNS events into domain types. The receiver use case applies business matching and filtering before publishing `comment_received`, `dm_message`, or `sending_confirm` events. The source groups these responsibilities and associates them with idempotency metadata. |
| Event bus | Connects producers and consumers of New, Answer, and Send events. The source lists `kafka`, `postgres`, `rabbit`, and `MtM dbs`; it does not select a technology or require all four. |
| Answering engines | Consume events and produce Answer events. Their associated resources include conversation context, customer rules, and an Answer. LLMs, patterns, and templates are listed as answer-generation approaches. |
| Sender adapters | Consume events from the bus, invoke the SNS Sender, and publish Send events. |
| SNS Sender | Performs outbound delivery through the existing integration. An available delivery-confirmation event returns to the SNS Receiver. |
| Analytics workers | Consume bus events and provide internal and external analytics outputs. The internal output is labeled `Graphna`; external outputs are Ads and Marketing. |

## Event flow

1. **Receive:** SNS Receiver emits an SNS event. The receiving load balancer routes it to a receiver adapter.
2. **Normalize:** The adapter validates and converts the external payload to a domain event. The receiver use case applies business matching and filtering, then publishes a `comment_received`, `dm_message`, or `sending_confirm` event to the bus. The source groups these as New events and lists `message`, `confirm`, and `any` as categories.
3. **Answer:** An answering consumer receives bus events through its distribution stage. Its answering engine uses the associated context, rules, and answer-generation resources, then publishes an Answer event back to the bus.
4. **Send:** A sender consumer receives an `answer` event. Its source adapter converts the reply target and text for SNS Sender. The sender records the accepted provider message ID, then publishes a `send` event. This records dispatch acceptance, not recipient delivery.
5. **Confirm:** When the integration provides a confirmation event, it returns to SNS Receiver and follows the ingestion path again. The sender consumes `sending_confirm` and updates the matching delivery record without sending another message. Instagram currently supplies message echoes, so `confirmed` records confirmation of sending rather than recipient delivery or reading.
6. **Observe:** Analytics workers consume bus events through their own distribution stage and feed the internal and external outputs.

The answering resource enclosure contains conversation context, customer rules, and an Answer without arrows between them. Their storage locations and read/write contracts remain open.

## Reliability and scaling

Receiver adapters, answering engines, sender adapters, and analytics workers are shown as groups of multiple instances. Each group has a separate load-balancing stage, allowing work distribution at each processing boundary.

The receiver adapter has two highlighted annotations: `Idempotency key: recipient_id` and `timestamp`. The design does not use either for deduplication (see [MEMORY.md](MEMORY.md)):

- **Idempotency key:** `${source}:${kind}:${providerEventId}`, carried as the inbound event `id`. Sources without an event id fall back to a sha256 of the raw payload. The receiver use case claims the key atomically in an idempotency store with a TTL that covers the provider's redelivery window, and releases it if publishing the inbound event fails.
- **`conversationId`** (from `recipient_id`): used only by the answering engine to load the whole conversation. It is also the intended bus partition key: inbound, Answer, and Send events all carry it, so every event of one conversation lands in the same partition and is consumed in order.
- **`occurredAt`** (from `timestamp`): the provider's timestamp, used only to order events that arrive out of order because of network latency. Ties are broken by `id`.

All four load-balancer annotations mention message volume affecting system timeouts and give "1M" as an example. The event-bus annotation additionally calls for parallel data handling under that condition. No unit, measured capacity, timeout budget, or numerical scaling threshold is specified.

## Open design decisions

The following contracts need to be defined before implementing the diagram:

- Event-bus technology, persistence, retention, and routing between processing stages.
- Event schemas, identifiers, correlation, and subscription filters for inbound, Answer, and Send events.
- Storage and update rules for conversation context, customer rules, answers, and idempotency records.
- How the answering engine handles an older message that arrives after a newer one was already answered.
- Consumer ownership, processing order, acknowledgements, retries, and recovery after worker failures.
- The meaning of `MtM dbs` and `Graphna`, preserved here as written in the source.

## Layout

- `src/app.ts`: Fastify server entry point
- `src/routes.ts`: HTTP route registration
- `src/resources.ts`: registers answering-engine, sender, and receiver resources.
- `src/domain/events.ts`: the normalized `InboundEvent` and the `comment_received`, `dm_message`, `sending_confirm`, Answer, and Send bus event types.
- `src/domain/deliveries.ts`: accepted-send receipts and tracked delivery states.
- `src/resources/receiver/adapters/`: one parser per event source (currently `instagram.ts`) and the source-to-parser lookup in `index.ts`.
- `src/resources/sender/adapters/`: source-specific outgoing request conversion and receipt normalization (currently Instagram).
- `src/domain/ports.ts`: narrow event-publishing and message-sending interfaces.
- `src/resources/<name>/index.ts`: event-handler factories and subscription registration.
- `src/resources/<name>/<name>.usecases.ts`: plain use-case functions with explicit port and domain-event dependencies.
- `src/services/memory_idempotency_store.ts`: in-memory `IdempotencyStore` with a seven-day TTL; per-process only.
- `src/services/memory_delivery_store.ts`: in-memory delivery records and answer-to-provider-message correlation; per-process only.
- `src/services/message_sender.ts`: `MessageSender` implementation that selects a source adapter and delegates to `OuterSender`.
- `src/services/di_container.ts`: Awilix DI container; registers the logger, service singletons, and port bindings.
- `Architecture.pdf`: source diagram for the target system.
- `Architecture.mermaid.md`: editable Mermaid transcription and source annotations.

## Resource handlers and lifecycle

Each resource follows the handler-factory pattern: resolve dependencies from `app.diContainer`, return an async event handler, and delegate to the resource's use-case functions. Handlers log errors once and rethrow them. Use cases import only domain contracts and receive ports and domain-event data explicitly. Logging remains in handlers because the current use cases do not need a logging port.

`EventBus` implements `EventPublisher`; `SourceMessageSender` implements `MessageSender`; `MemoryIdempotencyStore` implements `IdempotencyStore`; `MemoryDeliveryStore` implements `DeliveryStore`. The DI container binds each port to its singleton implementation. `SourceMessageSender` delegates to `OuterSender` through a source adapter. The sender application helper shares the complete dispatch, receipt-storage, and publication operation for concurrent copies of the same answer. Subscription management remains in resource adapters and concrete services, outside the use-case ports.

`OuterReceiver` delivers each raw event together with a `source` name. The receiver handler selects that source's parser from `src/resources/receiver/adapters/`. The parser validates the payload and returns the normalized `InboundEvent`s plus an error for each malformed entry or item, because one webhook can batch several events. Unknown sources and unusable bodies raise `TypeError`. The handler logs and drops malformed items, because they would fail the same way on every retry, and passes the valid events to `receiveEvents`. That use case processes each event independently and throws one `AggregateError` for any failures. A provider retry re-processes only the failed events, since published ones are skipped as duplicates. The Instagram parser emits three kinds: `comment_received` for a participant's comment, `dm_message` for a participant's direct message, and `sending_confirm` for an echo of a message the account sent. It skips the account's own comment replies (their payload lacks the participant), deleted messages, read receipts, reactions, and other webhook fields. Answering and sender handlers reject mismatched event kinds before invoking their use cases.

The answering engine subscribes only to `comment_received` and `dm_message` events, the sender subscribes to `answer` and `sending_confirm` with a separate handler for each (`sendAnswerHandler` dispatches answers; `confirmSendingHandler` needs only the delivery store), and the receiver subscribes to external events. Resources register subscriptions in `onReady`, with bus consumers registered before external intake. Each `onClose` hook calls the service's `unsubscribe` method with the same handler before DI disposal. Subscription methods retain callbacks and also return cleanup functions; external transport, bus publication, and matching remain explicit stubs. The answering stub publishes an Answer event with placeholder text and a deterministic ID for each comment or DM, preserving the source, account, participant, reply target, and conversation ID. Adapters use explicit routing fields rather than parsing the opaque conversation ID. The Instagram sender addresses comment private replies by comment ID and DM replies by participant ID, following the [Meta request examples](https://github.com/fbsamples/messenger-platform-samples/blob/main/postman/instagram-platform-api.postman_collection.json#L1213-L1248). Send confirmations do not reach the answering engine. The receiver use case claims each event's idempotency key, replaces the normalized `kind` with the corresponding bus `type`, and releases the key if publishing fails.

The sender records an accepted receipt before publishing `send`, so a later bus-publication retry can reuse the receipt without resending the message. Delivery records are keyed by source, account ID, and provider message ID. A confirmation received before the send response is retained and merged when the answer is recorded; a confirmed record is never downgraded to sent. The current delivery store has no retention limit, is lost on restart, and is not shared between workers. Durable dispatch claims and receipt storage are required before relying on retries across workers or process failures; a provider acceptance followed by a crash before receipt storage remains ambiguous.

`SIGINT` and `SIGTERM` call `app.close()`; startup errors also close the app before exiting with a failure status. Worker-only processes can use `app.ready()` to run the same registration lifecycle without opening an HTTP listener.

## Routes

- `GET /healthcheck`: liveness check; returns `app`, `ok`, and `date`, plus optional `commit` and `id` metadata from the environment.
