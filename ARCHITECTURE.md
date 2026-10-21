# Architecture

An event-driven backend for social-network message automation. It currently runs as one Node 26 / TypeScript / Fastify application, with Awilix providing dependencies and `tsx` running the source.

## Components

| Component | Responsibility |
| --- | --- |
| Receiver | Converts provider payloads into internal events and deduplicates incoming work. |
| Event bus | Connects resources through typed events and subscriptions. |
| Answering engine | Consumes comments and DMs and produces replies. |
| Sender | Converts replies into provider requests, records accepted sends, and handles confirmations. |
| State stores | Track processed event IDs and outgoing message state. |

## Event flow

Comments and DMs become `comment_received` or `dm_message` events. The answering engine publishes `answer`; the sender dispatches it and publishes `send`.

Provider echoes become `sending_confirm` events and update sending state without triggering another reply. Events carry explicit routing IDs; `conversationId` correlates work across stages.

## Code structure

- `src/domain/`: event types and dependency interfaces.
- `src/resources/`: use cases, event handlers, and provider adapters.
- `src/services/`: integration boundaries, storage implementations, and DI setup.

Use cases depend on domain interfaces. Handlers resolve dependencies, manage subscriptions, and log failures. Subscriptions start on application readiness and stop on close.

## Current state

Instagram adapters, processing functions, and subscription wiring are implemented. Answer generation uses placeholder text, and state is stored in process memory. External intake, event-bus publication, and outbound transport remain stubs, so the pipeline is not live.

See [RULES.md](RULES.md) for dependency rules and [PLAN.md](PLAN.md) for remaining work and open questions.
