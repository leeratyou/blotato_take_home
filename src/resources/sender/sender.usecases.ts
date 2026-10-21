import type { AnswerEvent } from '@/domain/events'
import type { EventPublisher, MessageSender } from '@/domain/ports'

export type SenderPorts = {
  sender: MessageSender
  publisher: EventPublisher
}

export async function sendAnswer(ports: SenderPorts, event: AnswerEvent): Promise<void> {
  // TODO: Dispatch through the outer sender and publish the resulting Send event.
  throw new Error('sendAnswer is not implemented')
}
