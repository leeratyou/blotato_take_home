import type { FastifyBaseLogger } from 'fastify'
import type { BusEvent, EventBus } from '@/services/event_bus'

export async function generateAnswer(
  eventBus: EventBus,
  logger: FastifyBaseLogger,
  event: BusEvent,
): Promise<void> {
  // TODO: Load context and rules, generate an answer, and publish the resulting event.
  throw new Error('generateAnswer is not implemented')
}
