import { NextResponse } from "next/server";
import { env } from "@/env";

// This endpoint forces a refresh of the data layer after DATA_DIR changes
export async function POST() {
  try {
    // Check if we're in Electron
    const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1';
    
    if (!isElectron) {
      return NextResponse.json({ ok: false, error: "Only available in Electron mode" }, { status: 400 });
    }

    // Check if DATA_DIR is now configured
    if (!process.env.DATA_DIR) {
      return NextResponse.json({ ok: false, error: "DATA_DIR not configured" }, { status: 400 });
    }

    // Clear any existing data layer cache to force re-initialization
    const globalAny = globalThis as any;
    if (globalAny.__dataLayerCache) {
      globalAny.__dataLayerCache = null;
    }

    // Force re-initialization by importing data layer module fresh
    delete require.cache[require.resolve("@/server/storage/data-layer")];
    const { dataLayer } = require("@/server/storage/data-layer");
    
    // Initialize the data layer with local user
    await dataLayer.ensureLocalUser();
    
    return NextResponse.json({ ok: true, message: "Data layer connection refreshed" });
  } catch (error: any) {
    console.error("Failed to refresh data layer connection:", error);
    return NextResponse.json({ 
      ok: false, 
      error: error?.message || "Failed to refresh data layer connection" 
    }, { status: 500 });
  }
}
