// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { Pool } from "@neondatabase/serverless";
import { neonConfig } from "@neondatabase/serverless";
import { NeonHttpAdapter } from "@prisma/adapter-neon";

// keep fetch-based connections cached across invocations
neonConfig.fetchConnectionCache = true;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    const adapter = new NeonHttpAdapter({ pool });
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
    });
  })();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
