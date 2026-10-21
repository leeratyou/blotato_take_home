import type { AnswerEvent } from '@/domain/events'
import type { EventPublisher, MessageSender } from '@/domain/ports'

export async function sendAnswer(
  sender: MessageSender,
  publisher: EventPublisher,
  event: AnswerEvent,
): Promise<void> {
  // TODO: Dispatch through the outer sender and publish the resulting Send event.
  throw new Error('sendAnswer is not implemented')
}
