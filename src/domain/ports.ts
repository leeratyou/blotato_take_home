import type { AnswerEvent, BusEvent } from '@/domain/events'

export interface EventPublisher {
  send(event: BusEvent): Promise<void>
}

export interface MessageSender {
  send(answer: AnswerEvent): Promise<void>
}

export interface IdempotencyStore {
  // Atomically records the key; false when it is already claimed.
  claim(key: string): Promise<boolean>
  release(key: string): Promise<void>
}
