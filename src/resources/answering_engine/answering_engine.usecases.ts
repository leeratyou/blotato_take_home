import type { CommentReceivedEvent, DmMessageEvent } from '@/domain/events'
import type { EventPublisher } from '@/domain/ports'

export type AnsweringPorts = {
  publisher: EventPublisher
}

export async function generateAnswer(ports: AnsweringPorts, event: CommentReceivedEvent | DmMessageEvent): Promise<void> {
  await ports.publisher.send({
    id: `answer:${event.id}`,
    conversationId: event.conversationId,
    type: 'answer',
    payload: { text: 'Stub answer' },
  })
}
