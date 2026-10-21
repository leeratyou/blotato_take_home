# Architecture

## Overview

The target system uses an event bus to connect social-network event ingestion, answer generation, message delivery, and analytics. Receiver adapters convert incoming integration events into internal events. Answering engines generate responses, sender adapters dispatch them through the existing integration, and analytics workers consume events for internal and external reporting.

The SNS Receiver and SNS Sender are existing integration boundaries, shown as black boxes.

This document describes the target design in [Architecture.pdf](Architecture.pdf). The current application contains a Fastify server, a health endpoint, and service stubs managed through DI and lifecycle hooks; event processing is not implemented yet. [Architecture.mermaid.md](Architecture.mermaid.md) contains the diagram transcription and source annotations.

## System diagram

Dashed arrows represent event connections. The solid connector associates the answering engine with its resource enclosure. Nodes marked "Multiple instances" represent the stacked workers in the PDF.

## Components

| Component | Responsibility |
| --- | --- |
| SNS Receiver | Supplies incoming SNS events and receives delivery-confirmation events when the integration provides them. |
| Load balancers | Distribute work at four boundaries: receiving, answering, sending, and analytics. Their concrete implementation is not selected in the PDF. |
| Receiver adapters | Match, filter, and convert incoming SNS events into internal New events. The source associates these adapters with idempotency metadata. |
| Event bus | Connects producers and consumers of New, Answer, and Send events. The source lists `kafka`, `postgres`, `rabbit`, and `MtM dbs`; it does not select a technology or require all four. |
| Answering engines | Consume events and produce Answer events. Their associated resources include conversation context, customer rules, and an Answer. LLMs, patterns, and templates are listed as answer-generation approaches. |
| Sender adapters | Consume events from the bus, invoke the SNS Sender, and publish Send events. |
| SNS Sender | Performs outbound delivery through the existing integration. An available delivery-confirmation event returns to the SNS Receiver. |
| Analytics workers | Consume bus events and provide internal and external analytics outputs. The internal output is labeled `Graphna`; external outputs are Ads and Marketing. |

## Event flow

1. **Receive:** SNS Receiver emits an SNS event. The receiving load balancer routes it to a receiver adapter.
2. **Normalize:** The adapter applies matching, filtering, and conversion, then publishes a New event to the bus. The source lists `message`, `confirm`, and `any` as New-event categories.
3. **Answer:** An answering consumer receives bus events through its distribution stage. Its answering engine uses the associated context, rules, and answer-generation resources, then publishes an Answer event back to the bus.
4. **Send:** A sender consumer receives bus events through its distribution stage. Its adapter invokes SNS Sender and separately publishes a Send event to the bus. The PDF does not establish that a Send event means successful delivery.
5. **Confirm:** When the integration provides a delivery-confirmation event, it returns to SNS Receiver and follows the ingestion path again.
6. **Observe:** Analytics workers consume bus events through their own distribution stage and feed the internal and external outputs.

The answering resource enclosure contains conversation context, customer rules, and an Answer without arrows between them. Their storage locations and read/write contracts remain open.

## Reliability and scaling

Receiver adapters, answering engines, sender adapters, and analytics workers are shown as groups of multiple instances. Each group has a separate load-balancing stage, allowing work distribution at each processing boundary.

The receiver adapter has two highlighted annotations: `Idempotency key: recipient_id` and `timestamp`. Their role in key composition, duplicate detection, and deduplication state storage remains to be defined.

All four load-balancer annotations mention message volume affecting system timeouts and give "1M" as an example. The event-bus annotation additionally calls for parallel data handling under that condition. No unit, measured capacity, timeout budget, or numerical scaling threshold is specified.

## Open design decisions

The following contracts need to be defined before implementing the diagram:

- Event-bus technology, persistence, retention, and routing between processing stages.
- Event schemas, identifiers, correlation, and subscription filters for New, Answer, Send, and confirmation events.
- Storage and update rules for conversation context, customer rules, answers, and idempotency records.
- Consumer ownership, processing order, acknowledgements, retries, and recovery after worker failures.
- The meaning of `MtM dbs` and `Graphna`, preserved here as written in the source.

## Layout

- `src/app.ts`: Fastify server entry point
- `src/routes.ts`: HTTP route registration
- `src/resources.ts`: registers answering-engine, sender, and receiver resources.
- `src/resources/<name>/index.ts`: event-handler factories and subscription registration.
- `src/resources/<name>/<name>.usecases.ts`: plain use-case functions with explicit service and logger dependencies.
- `src/services/di_container.ts`: Awilix DI container; registers the logger and service singletons.
- `Architecture.pdf`: source diagram for the target system.
- `Architecture.mermaid.md`: editable Mermaid transcription and source annotations.

## Resource handlers and lifecycle

Each resource follows the handler-factory pattern: resolve dependencies from `app.diContainer`, return an async event handler, and delegate to the resource's use-case functions. Handlers log errors and rethrow them. Use cases receive services, the logger, and event data explicitly; they do not depend on Fastify.

The answering engine subscribes to `new` events, the sender subscribes to `answer` events, and the receiver subscribes to external events. Resources register subscriptions in `onReady`, with bus consumers registered before external intake. Each `onClose` hook calls the service's `unsubscribe` method with the same handler before DI disposal. Subscription methods retain callbacks and also return cleanup functions; external event delivery, sends, and business use cases remain explicit stubs.

`SIGINT` and `SIGTERM` call `app.close()`; startup errors also close the app before exiting with a failure status. Worker-only processes can use `app.ready()` to run the same registration lifecycle without opening an HTTP listener.

## Routes

- `GET /healthcheck`: liveness check; returns `app`, `ok`, and `date`, plus optional `commit` and `id` metadata from the environment.
