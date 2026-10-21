import type { NewEvent } from '@/domain/events'
import type { EventPublisher } from '@/domain/ports'

export async function generateAnswer(
  publisher: EventPublisher,
  event: NewEvent,
): Promise<void> {
  // TODO: Load context and rules, generate an answer, and publish the resulting event.
  throw new Error('generateAnswer is not implemented')
}
