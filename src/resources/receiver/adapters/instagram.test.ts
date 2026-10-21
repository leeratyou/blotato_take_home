import assert from 'node:assert/strict'
import test from 'node:test'
import { parseInbound } from '@/resources/receiver/adapters'

test('instagram adapter splits a webhook batch into inbound comments and messages', () => {
  const events = parseInbound('instagram', {
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
          { sender: { id: 'acct-1' }, timestamp: 1_700_000_006_000, message: { mid: 'mid-2', is_echo: true } },
          { sender: { id: 'user-1' }, timestamp: 1_700_000_007_000, message: { mid: 'mid-3', attachments: [] } },
          { sender: { id: 'user-1' }, timestamp: 1_700_000_008_000, read: { mid: 'mid-2' } },
        ],
      },
    ],
  })

  assert.deepEqual(events, [
    {
      id: 'instagram:comment:c-1',
      source: 'instagram',
      kind: 'comment',
      externalId: 'c-1',
      conversationId: 'instagram:acct-1:user-1',
      occurredAt: '2023-11-14T22:13:20.000Z',
      text: 'pricing',
    },
    {
      id: 'instagram:message:mid-1',
      source: 'instagram',
      kind: 'message',
      externalId: 'mid-1',
      conversationId: 'instagram:acct-1:user-1',
      occurredAt: '2023-11-14T22:13:25.000Z',
      text: 'a@b.co',
    },
    {
      id: 'instagram:message:mid-3',
      source: 'instagram',
      kind: 'message',
      externalId: 'mid-3',
      conversationId: 'instagram:acct-1:user-1',
      occurredAt: '2023-11-14T22:13:27.000Z',
      text: '',
    },
  ])
})

test('adapters reject unknown sources and malformed instagram payloads', () => {
  assert.throws(() => parseInbound('toString', {}), { message: 'Unknown event source: toString' })

  const malformed = [
    { object: 'page', entry: [] },
    { object: 'instagram', entry: {} },
    { object: 'instagram', entry: [{ time: 1 }] },
    { object: 'instagram', entry: [{ id: 'acct-1', changes: [{ field: 'comments', value: { id: 'c-1', from: { id: 'u' } } }] }] },
    { object: 'instagram', entry: [{ id: 'acct-1', messaging: [{ sender: { id: 'u' }, timestamp: 1, message: { text: 'hi' } }] }] },
  ]
  for (const raw of malformed) assert.throws(() => parseInbound('instagram', raw), TypeError)
})
