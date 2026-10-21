import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnswerEvent } from '@/domain/events'
import { sendOutbound, type OutboundTransport } from '@/resources/sender/adapters'

const answer: AnswerEvent = {
  id: 'answer:instagram:comment_received:c-1',
  type: 'answer',
  source: 'instagram',
  accountId: 'acct-1',
  participantId: 'user-1',
  conversationId: 'opaque-conversation-key',
  replyTo: { type: 'comment_received', externalId: 'c-1' },
  payload: { text: 'Here is the information.' },
}

for (const type of ['comment_received', 'dm_message'] as const) {
  test(`Instagram ${type} adapter addresses the correct target and normalizes its receipt`, async () => {
    const calls: Parameters<OutboundTransport>[] = []
    const receipt = await sendOutbound({ ...answer, replyTo: { ...answer.replyTo, type } }, async (...args) => {
      calls.push(args)
      return { recipient_id: 'user-1', message_id: 'mid-out-1' }
    })

    assert.deepEqual(calls, [['instagram', 'acct-1', {
      recipient: type === 'comment_received' ? { comment_id: 'c-1' } : { id: 'user-1' },
      message: { text: answer.payload.text },
    }]])
    assert.deepEqual(receipt, { externalId: 'mid-out-1' })
  })
}

test('unknown sources and invalid outbound fields fail before transport', async () => {
  const invalid: AnswerEvent[] = [
    { ...answer, source: 'unknown' },
    { ...answer, source: 'toString' },
    { ...answer, accountId: ' ' },
    { ...answer, payload: { text: '\t' } },
    { ...answer, replyTo: { type: 'comment_received', externalId: '' } },
    { ...answer, participantId: ' ', replyTo: { type: 'dm_message', externalId: 'mid-in-1' } },
  ]
  let calls = 0
  for (const event of invalid) {
    await assert.rejects(sendOutbound(event, async () => { calls++; return { message_id: 'mid-out-1' } }), TypeError)
  }
  assert.equal(calls, 0)
})

test('Instagram rejects malformed send receipts', async () => {
  for (const response of [undefined, null, [], 'mid-out-1', {}, { message_id: 1 }, { message_id: '' }, { message_id: ' ' }]) {
    await assert.rejects(sendOutbound(answer, async () => response), TypeError)
  }
})

test('transport failures propagate without a receipt', async () => {
  const failure = new Error('integration unavailable')
  await assert.rejects(sendOutbound(answer, async () => { throw failure }), err => err === failure)
})
