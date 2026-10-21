import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnswerEvent } from '@/domain/events'
import { SourceMessageSender } from '@/services/message_sender'

const answer: AnswerEvent = {
  id: 'answer:instagram:dm_message:mid-in-1',
  type: 'answer',
  source: 'instagram',
  accountId: 'acct-1',
  participantId: 'user-1',
  conversationId: 'opaque-conversation-key',
  replyTo: { type: 'dm_message', externalId: 'mid-in-1' },
  payload: { text: 'Reply' },
}

test('source message sender delegates through the existing integration boundary', async () => {
  const calls: unknown[][] = []
  const outerSender = {
    async send(...args: unknown[]) {
      calls.push(args)
      return { message_id: 'mid-out-1' }
    },
  }
  const receipt = await new SourceMessageSender({ outerSender }).send(answer)

  assert.deepEqual(receipt, { externalId: 'mid-out-1' })
  assert.deepEqual(calls, [['instagram', 'acct-1', { recipient: { id: 'user-1' }, message: { text: 'Reply' } }]])
})

