// src/lib/prisma.ts
import Prisma from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
const { PrismaClient } = Prisma as any

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!
})

declare global { var __prisma__: any | undefined }

export const prisma = global.__prisma__ ?? new PrismaClient({
  adapter,
  // Reduce console noise: disable Prisma query logs; keep errors and warnings
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // Configure connection limits for better performance
  __internal: {
    engine: {
      // Configure connection pool limits
      connectionLimit: 10,
    }
  }
})

if (process.env.NODE_ENV !== 'production') global.__prisma__ = prisma
