import type { FastifyBaseLogger } from 'fastify'
import type { EventBus } from '@/services/event_bus'

export async function receiveEvent(
  eventBus: EventBus,
  logger: FastifyBaseLogger,
  event: unknown,
): Promise<void> {
  // TODO: Match, filter, convert, and publish incoming events.
  throw new Error('receiveEvent is not implemented')
}
