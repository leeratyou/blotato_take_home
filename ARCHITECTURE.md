# Architecture

One Node 26 / TypeScript / Fastify process. Awilix supplies dependencies; `tsx` runs the source without a build step. Instagram is the only supported source. The only HTTP route is `GET /healthcheck`.

## Processing flow

| Input | Processing | Output |
| --- | --- | --- |
| External payload | Receiver parses and deduplicates items | `comment_received`, `dm_message`, or `sending_confirm` |
| Comment or DM event | Answering engine uses fixed `Stub answer` text | `answer` |
| `answer` | Sender dispatches the reply and records its receipt | `send` |
| `sending_confirm` | Sender updates delivery state | No outgoing message |

The flow is wired but not live: `EventBus.send` and `OuterSender.send` throw; `OuterReceiver` only stores callbacks. No component consumes `send`.

Answers carry explicit account, participant, and reply-target IDs. Comment replies target the comment ID; DM replies target the participant ID. `conversationId` is used for correlation, never parsed for routing.

## Code map

- `src/domain/`: event types and dependency interfaces.
- `src/resources/`: application logic, handlers, subscriptions, and source adapters.
- `src/services/`: integration boundaries, in-memory stores, and DI registrations.
- `src/app.ts`: startup and shutdown. Consumers subscribe on readiness and unsubscribe on close.

Use cases depend on domain interfaces; handlers resolve dependencies and log errors.

## State and limits

- Receiver deduplication lasts seven days. Concurrent claims and malformed collection handling have known gaps; see [PLAN.md](PLAN.md).
- Sender shares concurrent work for the same answer and saves receipts before publishing `send`, so publication retries reuse accepted sends.
- Delivery state is `sent` or `confirmed`. Early confirmations are retained. Confirmation means a provider echo, not recipient delivery or reading.
- State is local to one process and lost on restart. Delivery records have no retention limit; crash-safe processing and coordination across workers are not implemented.
- Matching, real answer generation, conversation loading, ordering, analytics, and durable queues remain future work.

See [RULES.md](RULES.md) for dependency rules.
