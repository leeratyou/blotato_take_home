import type { AnswerEvent } from '@/domain/events'
import type { MessageSender } from '@/domain/ports'

export class OuterSender implements MessageSender {
  async send(answer: AnswerEvent): Promise<void> {
    throw new Error('OuterSender.send is not implemented')
  }
}
