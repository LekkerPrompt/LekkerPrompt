import { env } from "@/env";

// Dev note: when running `next dev` prior to launching Electron, process.versions.electron is undefined.
// We also rely on ELECTRON env flag set by the launcher script.
const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1';
// Distinguish between runtime inside packaged/ dev Electron and the isolated Next.js build phase
const isElectronBuildPhase = process.env.BUILDING_ELECTRON === '1';

type PrismaClientType = any; // avoid direct import type dependency
let prismaInstance: PrismaClientType | null = null;
let initPromise: Promise<PrismaClientType> | null = null;

async function initElectronClientAsync(): Promise<PrismaClientType> {
	// Check if DATABASE_URL is set by the Electron main process
	if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
		// If no DATABASE_URL is set, it means the user hasn't chosen a database location yet
		// Return a proxy that will throw helpful errors
		return new Proxy({}, { 
			get() { 
				throw new Error('Database location not configured. Please select a database location first.'); 
			} 
		});
	}
	
	const globalAny = globalThis as any;
	async function loadClient(): Promise<PrismaClientType> {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { PrismaClient } = require('./generated/electron');
		if (globalAny.__electronPrisma) return globalAny.__electronPrisma;
		const client = new PrismaClient({ log: env.NODE_ENV === 'development' ? ['query','error','warn'] : ['error'] });
		if (env.NODE_ENV !== 'production') globalAny.__electronPrisma = client;
		// Skip schema + seed during the isolated Next.js build to avoid noisy Prisma errors
		if (!isElectronBuildPhase) {
			await ensureSqliteSchema(client);
			await seedInitialData(client);
		}
		return client;
	}
	return loadClient();
}

async function ensureSqliteSchema(client: any) {
	// Lightweight table creation (idempotent) for production packaged app without prisma CLI
	try {
		// PRAGMA journal_mode returns a row, so use queryRaw instead of executeRaw to avoid P2010
		try { await client.$queryRawUnsafe('PRAGMA journal_mode=WAL'); } catch { /* ignore pragma issues */ }
		const stmts = [
			`CREATE TABLE IF NOT EXISTS "User" ("id" TEXT PRIMARY KEY, "name" TEXT, "email" TEXT UNIQUE, "emailVerified" DATETIME, "image" TEXT);`,
			`CREATE TABLE IF NOT EXISTS "AppSetting" ("id" TEXT PRIMARY KEY, "key" TEXT UNIQUE, "value" TEXT, "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP);`,
			`CREATE TABLE IF NOT EXISTS "PromptPreset" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "mode" TEXT NOT NULL, "taskType" TEXT NOT NULL, "options" TEXT, "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP);`,
			`CREATE UNIQUE INDEX IF NOT EXISTS "PromptPreset_user_name_unique" ON "PromptPreset" ("userId", "name");`,
			`CREATE TABLE IF NOT EXISTS "Chat" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "title" TEXT, "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP);`,
			`CREATE INDEX IF NOT EXISTS "Chat_userId_updatedAt_idx" ON "Chat" ("userId", "updatedAt");`,
			`CREATE TABLE IF NOT EXISTS "ChatMessage" ("id" TEXT PRIMARY KEY, "chatId" TEXT NOT NULL, "role" TEXT NOT NULL, "content" TEXT NOT NULL, "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP);`,
			`CREATE INDEX IF NOT EXISTS "ChatMessage_chatId_createdAt_idx" ON "ChatMessage" ("chatId", "createdAt");`,
			`CREATE TABLE IF NOT EXISTS "Post" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL, "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "createdById" TEXT NOT NULL);`,
			`CREATE INDEX IF NOT EXISTS "Post_name_idx" ON "Post" ("name");`
		];
		for (const s of stmts) {
			await client.$executeRawUnsafe(s);
		}
	} catch (e) {
		console.error('[db] ensureSqliteSchema failed', e);
	}
}

async function seedInitialData(client: any) {
	try { await client.user.upsert({ where: { id: 'local-user' }, update: {}, create: { id: 'local-user', name: 'Local User', email: null } }); } catch {}
	try { const { ensureSystemPromptsSeeded } = require('./seed-system-prompts'); await ensureSystemPromptsSeeded(client); } catch {}
}

function initDefaultClient() {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { PrismaClient } = require('@prisma/client');
	const globalAny = globalThis as any;
	if (globalAny.__defaultPrisma) return globalAny.__defaultPrisma;
	const client = new PrismaClient({ log: env.NODE_ENV === 'development' ? ['query','error','warn'] : ['error'] });
	if (env.NODE_ENV !== 'production') globalAny.__defaultPrisma = client;
	return client;
}

export function getDb() {
	if (prismaInstance) return prismaInstance;
	if (isElectron) {
		// Check if DATABASE_URL is configured before attempting to initialize
		if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
			// Return proxy that throws helpful error message
			return new Proxy({}, { 
				get() { 
					throw new Error('Database location not configured. Please select a database location first.'); 
				} 
			});
		}
		
		if (!initPromise) initPromise = initElectronClientAsync().then(c => (prismaInstance = c));
		// Return proxy that throws if accessed before ready to surface ordering issues clearly.
		if (!prismaInstance) {
			return new Proxy({}, { get() { throw new Error('Prisma Electron client not ready yet. Await an API route or delay usage.'); } });
		}
		return prismaInstance;
	}
	prismaInstance = initDefaultClient();
	return prismaInstance;
}

export async function ensureDbReady(): Promise<PrismaClientType> {
	if (prismaInstance) return prismaInstance;
	if (isElectron) {
		// Check if DATABASE_URL is configured before attempting to initialize
		if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
			throw new Error('Database location not configured. Please select a database location first.');
		}
		
		if (!initPromise) initPromise = initElectronClientAsync().then(c => (prismaInstance = c));
		return initPromise;
	}
	prismaInstance = initDefaultClient();
	return prismaInstance;
}

// Backward compatibility named export
export const db = getDb();

