import type { FastifyBaseLogger } from 'fastify'
import type { BusEvent, EventBus } from '@/services/event_bus'
import type { OuterSender } from '@/services/outer_sender'

export async function sendAnswer(
  outerSender: OuterSender,
  eventBus: EventBus,
  logger: FastifyBaseLogger,
  event: BusEvent,
): Promise<void> {
  // TODO: Dispatch through the outer sender and publish the resulting Send event.
  throw new Error('sendAnswer is not implemented')
}
