import type { IncomingEvent } from '@/domain/events'
import type { EventPublisher } from '@/domain/ports'

export async function receiveEvent(
  publisher: EventPublisher,
  event: IncomingEvent,
): Promise<void> {
  // TODO: Apply business matching and filtering, then publish a New event.
  throw new Error('receiveEvent is not implemented')
}
