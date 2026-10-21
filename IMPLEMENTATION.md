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
