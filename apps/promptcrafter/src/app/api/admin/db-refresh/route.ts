import { NextResponse } from "next/server";
import { env } from "@/env";

// This endpoint forces a refresh of the database connection after DATABASE_URL changes
export async function POST() {
  try {
    // Check if we're in Electron
    const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1';
    
    if (!isElectron) {
      return NextResponse.json({ ok: false, error: "Only available in Electron mode" }, { status: 400 });
    }

    // Check if DATABASE_URL is now configured
    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
      return NextResponse.json({ ok: false, error: "DATABASE_URL not configured" }, { status: 400 });
    }

    // Clear any existing Prisma instance to force re-initialization
    const globalAny = globalThis as any;
    if (globalAny.__electronPrisma) {
      try {
        await globalAny.__electronPrisma.$disconnect();
      } catch (e) {
        console.warn('Error disconnecting previous Prisma instance:', e);
      }
      globalAny.__electronPrisma = null;
    }

    // Force re-initialization by importing db module fresh
    delete require.cache[require.resolve("@/server/db")];
    const { ensureDbReady } = require("@/server/db");
    
    // Initialize the new database connection
    await ensureDbReady();
    
    return NextResponse.json({ ok: true, message: "Database connection refreshed" });
  } catch (error: any) {
    console.error("Failed to refresh database connection:", error);
    return NextResponse.json({ 
      ok: false, 
      error: error?.message || "Failed to refresh database connection" 
    }, { status: 500 });
  }
}
