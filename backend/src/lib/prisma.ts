/**
 * Prisma Client Singleton
 *
 * This module creates a single PrismaClient instance that is reused across
 * the application. In development, it prevents connection issues from
 * hot module reloading creating multiple instances.
 *
 * Prisma 7 with prisma dev requires @prisma/adapter-pg for direct TCP connection.
 */

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Ensure env vars are loaded (needed when this module is imported first)
dotenv.config();

// Declare global type for prisma instance in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Extract direct PostgreSQL URL from prisma+postgres:// URL
 * The api_key in the URL is base64 encoded and contains the direct connection string
 */
function getDirectPostgresUrl(prismaUrl: string): string {
  try {
    const url = new URL(prismaUrl);
    const apiKey = url.searchParams.get('api_key');
    if (apiKey) {
      // Decode base64 api_key to get direct connection string
      const decoded = Buffer.from(apiKey, 'base64').toString('utf-8');
      // The decoded string contains the direct postgres:// URL
      const match = decoded.match(/postgres:\/\/[^\s"]+/);
      if (match) {
        return match[0];
      }
    }
  } catch (e) {
    console.error('Failed to parse prisma URL:', e);
  }
  // Fallback to standard localhost
  return 'postgres://postgres:postgres@localhost:5432/postgres';
}

// Create Prisma client with pg adapter for direct TCP connection
const prismaClientSingleton = () => {
  const databaseUrl = process.env.DATABASE_URL || '';

  // For Prisma 7 with prisma+postgres:// protocol, use pg adapter
  let connectionString = databaseUrl;
  if (databaseUrl.startsWith('prisma+postgres://')) {
    connectionString = getDirectPostgresUrl(databaseUrl);
  }

  // Create pg Pool for direct connection
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });
};

// Use existing global instance or create new one
// This prevents multiple instances during hot reload in development
export const prisma = globalThis.prisma ?? prismaClientSingleton();

// Store instance globally in development to prevent multiple connections
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

/**
 * Check database connection health
 * @returns Promise<boolean> - true if connected, false otherwise
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}

/**
 * Gracefully disconnect from database
 * Should be called on application shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export default prisma;
