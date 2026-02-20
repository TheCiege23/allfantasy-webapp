import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const READ_OPERATIONS = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow',
  'findMany', 'count', 'aggregate', 'groupBy',
])

function isConnectionError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientInitializationError) return true
  if (e instanceof Prisma.PrismaClientRustPanicError) return true

  const err = e as any
  const code = err?.code || ''
  if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(code)) return true

  const msg = String(err?.message || '')
  if (msg.includes('terminating connection due to administrator command')) return true
  if (msg.includes("Can't reach database server")) return true
  if (msg.includes('Connection timed out')) return true
  if (msg.includes('prepared statement') && msg.includes('does not exist')) return true

  return false
}

function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasourceUrl: process.env.DATABASE_URL,
  })

  return client.$extends({
    query: {
      async $allOperations({ operation, args, query }: { operation: string; args: unknown; query: (args: unknown) => Promise<unknown> }) {
        const isRead = READ_OPERATIONS.has(operation)
        const maxRetries = isRead ? 3 : 1

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            return await query(args)
          } catch (e: unknown) {
            if (!isConnectionError(e) || attempt === maxRetries) {
              throw e
            }

            const delay = 150 * Math.pow(2, attempt) + Math.random() * 50
            if (process.env.NODE_ENV !== 'production') {
              console.warn(`[Prisma] Retrying ${operation} (attempt ${attempt + 1}/${maxRetries}) after connection error`)
            }
            await new Promise(r => setTimeout(r, delay))
          }
        }
        throw new Error('Unexpected: exhausted retries')
      },
    },
  }) as unknown as PrismaClient
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
