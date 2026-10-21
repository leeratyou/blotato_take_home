import { fastifyAwilixPlugin } from '@fastify/awilix'
import Fastify from 'fastify'
import { buildContainer } from '@/services/di_container'
import resources from '@/resources'
import routes from '@/routes'

const app = Fastify({ logger: true })

let shutdownPromise: Promise<void> | undefined

function shutdown() {
  return shutdownPromise ??= app.close().catch(err => {
    app.log.error(err)
    process.exitCode = 1
  })
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

try {
  await app.register(fastifyAwilixPlugin, { container: buildContainer(app.log) })
  await app.register(resources)
  await app.register(routes)
  await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exitCode = 1
  await shutdown()
}
