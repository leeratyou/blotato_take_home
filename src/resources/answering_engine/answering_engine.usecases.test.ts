import assert from 'node:assert/strict'
import test from 'node:test'
import type { BusEvent, CommentReceivedEvent } from '@/domain/events'
import { generateAnswer } from '@/resources/answering_engine/answering_engine.usecases'

const event: CommentReceivedEvent = {
  id: 'instagram:comment_received:c-1',
  type: 'comment_received',
  source: 'instagram',
  accountId: 'acct-1',
  participantId: 'user-1',
  externalId: 'c-1',
  conversationId: 'opaque-conversation',
  occurredAt: '2026-10-21T00:00:00.000Z',
  text: 'pricing',
}

for (const type of ['comment_received', 'dm_message'] as const) {
  test(`answering stub publishes a placeholder for ${type} in the same conversation`, async () => {
    const published: BusEvent[] = []
    const publisher = { send: async (answer: BusEvent) => { published.push(answer) } }

    await generateAnswer({ publisher }, { ...event, type })

    assert.deepEqual(published, [{
      id: `answer:${event.id}`,
      conversationId: event.conversationId,
      type: 'answer',
      source: 'instagram',
      accountId: 'acct-1',
      participantId: 'user-1',
      replyTo: { type, externalId: 'c-1' },
      payload: { text: 'Stub answer' },
    }])
  })
}
