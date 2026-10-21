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
    source: event.source,
    accountId: event.accountId,
    participantId: event.participantId,
    replyTo: { type: event.type, externalId: event.externalId },
    payload: { text: 'Stub answer' },
  })
}
