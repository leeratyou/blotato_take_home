import type { SendReceipt } from '@/domain/deliveries'
import type { AnswerEvent } from '@/domain/events'
import type { MessageSender } from '@/domain/ports'
import { sendOutbound } from '@/resources/sender/adapters'
import type { OuterSender } from '@/services/outer_sender'

export class SourceMessageSender implements MessageSender {
  private readonly outerSender: OuterSender

  constructor({ outerSender }: { outerSender: OuterSender }) {
    this.outerSender = outerSender
  }

  async send(answer: AnswerEvent): Promise<SendReceipt> {
    return sendOutbound(answer, (source, accountId, payload) => this.outerSender.send(source, accountId, payload))
  }
}
