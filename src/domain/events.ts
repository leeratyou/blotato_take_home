export type IncomingEvent = {
  id: string
  payload: unknown
}

export type NewEvent = IncomingEvent & { type: 'new' }
export type AnswerEvent = IncomingEvent & { type: 'answer' }
export type SendEvent = IncomingEvent & { type: 'send' }

export type BusEvent = NewEvent | AnswerEvent | SendEvent
