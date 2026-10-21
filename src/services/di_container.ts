import { aliasTo, asClass, asValue, createContainer, InjectionMode } from 'awilix'
import type { Cradle } from '@fastify/awilix'
import type { FastifyBaseLogger } from 'fastify'
import type { EventPublisher, IdempotencyStore, MessageSender } from '@/domain/ports'
import { EventBus } from '@/services/event_bus'
import { MemoryIdempotencyStore } from '@/services/memory_idempotency_store'
import { OuterReceiver } from '@/services/outer_receiver'
import { OuterSender } from '@/services/outer_sender'

// App-wide dependencies. Add each new registration here and in buildContainer.
declare module '@fastify/awilix' {
  interface Cradle {
    logger: FastifyBaseLogger
    eventBus: EventBus
    eventPublisher: EventPublisher
    outerReceiver: OuterReceiver
    outerSender: OuterSender
    messageSender: MessageSender
    idempotencyStore: IdempotencyStore
  }

  // Per-request dependencies, resolved from request.diScope.
  interface RequestCradle {}
}

export function buildContainer(logger: FastifyBaseLogger) {
  const container = createContainer<Cradle>({ injectionMode: InjectionMode.PROXY, strict: true })

  container.register({
    logger: asValue(logger),
    eventBus: asClass(EventBus).singleton(),
    eventPublisher: aliasTo('eventBus'),
    outerReceiver: asClass(OuterReceiver).singleton(),
    outerSender: asClass(OuterSender).singleton(),
    messageSender: aliasTo('outerSender'),
    idempotencyStore: asClass(MemoryIdempotencyStore).singleton(),
  })

  return container
}
