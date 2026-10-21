import type { AnswerEvent, BusEvent } from '@/domain/events'

export interface EventPublisher {
  send(event: BusEvent): Promise<void>
}

export interface MessageSender {
  send(answer: AnswerEvent): Promise<void>
}
