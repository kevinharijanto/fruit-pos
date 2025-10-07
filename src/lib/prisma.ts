// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })

declare global { var __prisma__: PrismaClient | undefined }

export const prisma = global.__prisma__ ?? new PrismaClient({ adapter })
if (process.env.NODE_ENV !== 'production') global.__prisma__ = prisma
