import assert from 'node:assert/strict'
import test from 'node:test'
import { parseInbound } from '@/resources/receiver/adapters'

test('instagram adapter splits a webhook batch into comments, DMs, and send confirmations', () => {
  const { events, errors } = parseInbound('instagram', {
    object: 'instagram',
    entry: [
      {
        id: 'acct-1',
        time: 1_700_000_000,
        changes: [
          { field: 'comments', value: { id: 'c-1', text: 'pricing', from: { id: 'user-1' } } },
          { field: 'comments', value: { id: 'c-2', text: 'Sent you a DM!', from: { id: 'acct-1' } } },
          { field: 'mentions', value: { media_id: 'm-1' } },
        ],
        messaging: [
          { sender: { id: 'user-1' }, timestamp: 1_700_000_005_000, message: { mid: 'mid-1', text: 'a@b.co' } },
          { sender: { id: 'acct-1' }, recipient: { id: 'user-1' }, timestamp: 1_700_000_006_000, message: { mid: 'mid-2', text: 'Link', is_echo: true } },
          { sender: { id: 'user-1' }, timestamp: 1_700_000_007_000, message: { mid: 'mid-3', attachments: [] } },
          { sender: { id: 'user-1' }, timestamp: 1_700_000_008_000, read: { mid: 'mid-2' } },
        ],
      },
    ],
  })

  assert.deepEqual(errors, [])
  assert.deepEqual(events, [
    {
      id: 'instagram:comment_received:c-1',
      source: 'instagram',
      accountId: 'acct-1',
      participantId: 'user-1',
      kind: 'comment_received',
      externalId: 'c-1',
      conversationId: 'instagram:acct-1:user-1',
      occurredAt: '2023-11-14T22:13:20.000Z',
      text: 'pricing',
    },
    {
      id: 'instagram:dm_message:mid-1',
      source: 'instagram',
      accountId: 'acct-1',
      participantId: 'user-1',
      kind: 'dm_message',
      externalId: 'mid-1',
      conversationId: 'instagram:acct-1:user-1',
      occurredAt: '2023-11-14T22:13:25.000Z',
      text: 'a@b.co',
    },
    {
      id: 'instagram:sending_confirm:mid-2',
      source: 'instagram',
      accountId: 'acct-1',
      participantId: 'user-1',
      kind: 'sending_confirm',
      externalId: 'mid-2',
      conversationId: 'instagram:acct-1:user-1',
      occurredAt: '2023-11-14T22:13:26.000Z',
      text: 'Link',
    },
    {
      id: 'instagram:dm_message:mid-3',
      source: 'instagram',
      accountId: 'acct-1',
      participantId: 'user-1',
      kind: 'dm_message',
      externalId: 'mid-3',
      conversationId: 'instagram:acct-1:user-1',
      occurredAt: '2023-11-14T22:13:27.000Z',
      text: '',
    },
  ])
})

test('adapters throw on unknown sources and unusable webhook bodies', () => {
  assert.throws(() => parseInbound('toString', {}), { message: 'Unknown event source: toString' })

  const unusable = [undefined, null, [], 'event', {}, { object: 'page', entry: [] }, { object: 'instagram', entry: {} }]
  for (const raw of unusable) assert.throws(() => parseInbound('instagram', raw), TypeError)
})

test('instagram adapter keeps valid items and reports malformed siblings', () => {
  const { events, errors } = parseInbound('instagram', {
    object: 'instagram',
    entry: [
      { time: 1 },
      {
        id: 'acct-1',
        time: 1_700_000_000,
        changes: [
          { field: 'comments', value: { from: { id: 'user-1' } } },
          { field: 'comments', value: { id: 'c-1', text: 'pricing', from: { id: 'user-1' } } },
        ],
        messaging: [
          { sender: { id: 'user-1' }, timestamp: 1, message: { text: 'hi' } },
          { sender: { id: 'acct-1' }, timestamp: 1, message: { mid: 'm', is_echo: true } },
        ],
      },
    ],
  })

  assert.deepEqual(events.map(e => e.id), ['instagram:comment_received:c-1'])
  assert.deepEqual(
    errors.map(e => (e as Error).message),
    [
      'Expected entry[0].id to be a non-empty string',
      'Expected entry[1].changes[0].value.id to be a non-empty string',
      'Expected entry[1].messaging[0].message.mid to be a non-empty string',
      'Expected entry[1].messaging[1].recipient to be an object',
    ],
  )
})
