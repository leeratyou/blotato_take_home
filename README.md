# blotato_take_home

## Me:

- Shocked that any developers use vim
- Absolutely sure that Claude and Codex are smarter & faster than i
- Im still wondering what made me start thinking about making this monadic
- I couldnt think of anything funny to say here - thats true
- In js everything is an object if you are brave enought

## Project:

- **!Important** - This repo is a single deployable app to keep the take-home simple. A real project should split into microservices (ingestion, automation engine, outbound sender, analytics) so each can scale and fail on its own

## Architecture:

[![Architecture diagram](Architecture.jpg)](Architecture.pdf)

Details: [ARCHITECTURE.md](ARCHITECTURE.md)

## Development workflow

1. Define the task
2. One LLM writes the code
3. A second LLM reviews it
4. A human reviews the result

For the next task, the LLMs swap implementation and review roles

## Log:
Who did what: me or an LLM

| # | Work | By |
| --- | --- | --- |
| 1 | Architecture design | Me |
| 2 | Stack choice | Me |
| 3 | RULES and the documentation LLMs need | Me |
| 4 | App setup following the chosen architecture and stack | LLM |
| 5 | Clean architecture implementation | LLM |
| 6 | Examples of the coding approach | Me |
| 7 | Hand-written examples in the codebase | Me |
| 8 | Fixes from review comments and documentation clarifications | LLM |
| 9 | Business logic, built iteratively in about 10 steps | Both |
| 10 | Architecture documentation review and update | Me |

Lines of code written by hand: 10

---

# How the project works

This document explains reliability, concurrency, the data model, and execution in the current code. The application runs in one Node.js process. Processing functions and subscriptions exist, but external intake, bus publication, and outbound transport are still stubs.

## 1. Reliability

Each stage (receiver, answering engine, sender) is built to run as multiple instances behind its own load balancer, so work is processed in parallel and one failed instance only delays it.

- **Duplicates:** webhook redeliveries are skipped by event `id` for seven days.
- **Retries:** if publishing fails, the receiver releases the event `id`, so the provider's retry goes through.
- **Bad input:** a malformed item is logged and dropped; the rest of the batch continues.
- **No double sends:** the sender stores the provider receipt before publishing `send`, so a retry reuses it.

### **Out of scope**
- Durable queues and storage in every service for mid-work failures and retries (idempotency keys and deliveries are in memory, per process)
- Transactional outbox
- Load balancing based on instance load

## 2. Concurrency considerations

Stages talk only through async events, so they never block each other or share state directly.

- **Order:** every event carries `conversationId`, the bus partition key, so one conversation is processed in order; `occurredAt` fixes events the network delivered out of order.
- **Parallelism:** different conversations run in parallel; adding instances spreads the load.
- **Same answer twice:** concurrent copies of one answer share a single send.

### **Out of scope**
- A duplicate webhook that arrives while the first copy is still publishing is reported as done, even if that publish fails
- Cross-instance locks (in-flight send sharing is per process)

## 3. Data model

Everything is a `BusEvent`, a union type that new event types can extend.

- `type`: what happened: `comment_received`, `dm_message`, `sending_confirm`, `answer`, or `send`
- `id`: idempotency key (`source:kind:providerId` for inbound events)
- `conversationId`: main key for the answering engine and the partition key for the whole flow
- `source`, `accountId`, `participantId`: where to send the reply
- `occurredAt`: provider time, used only for ordering

Delivery records link a sent answer to the provider message id and track it as `sent` or `confirmed`.

### **Out of scope**
- Event sourcing as the data model
- Event schema registry with versioned events

## 4. Execution model

Event-driven: nothing polls and no process waits.

- **Trigger:** a webhook becomes a `comment_received` or `dm_message` event; each resource reacts only to its own event types.
- **Unit of work:** one handler call per event, delivered at least once; idempotency keys make repeats safe.
- **Flow:** comment "pricing" → reply to the comment and DM asking for an email → conversation is marked "waiting for email" → the next `dm_message` with the same `conversationId` continues the run → DM with the link.
- **Waiting:** stored as conversation state with a deadline, not as a timer or open request; a missing reply expires at the deadline.
- **Order:** one conversation runs sequentially (partition key `conversationId`); different conversations run in parallel.

### **Out of scope**
- Conversation state and wait deadlines (the answering engine currently replies with a placeholder)
- Automation definitions and matching
- Canceling sending if new message received for conversation
