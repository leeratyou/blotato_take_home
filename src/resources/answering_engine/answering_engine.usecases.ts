import type { NewEvent } from '@/domain/events'
import type { EventPublisher } from '@/domain/ports'

export type AnsweringPorts = {
  publisher: EventPublisher
}

export async function generateAnswer(ports: AnsweringPorts, event: NewEvent): Promise<void> {
  // TODO: Load context and rules, generate an answer, and publish the resulting event.
  throw new Error('generateAnswer is not implemented')
}
