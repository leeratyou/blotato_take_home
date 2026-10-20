import { asValue, createContainer, InjectionMode } from 'awilix'
import type { Cradle } from '@fastify/awilix'
import type { FastifyBaseLogger } from 'fastify'

// App-wide dependencies. Add each new registration here and in buildContainer.
declare module '@fastify/awilix' {
  interface Cradle {
    logger: FastifyBaseLogger
  }

  // Per-request dependencies, resolved from request.diScope.
  interface RequestCradle {}
}

export function buildContainer(logger: FastifyBaseLogger) {
  const container = createContainer<Cradle>({ injectionMode: InjectionMode.PROXY, strict: true })

  container.register({
    logger: asValue(logger),
  })

  return container
}
