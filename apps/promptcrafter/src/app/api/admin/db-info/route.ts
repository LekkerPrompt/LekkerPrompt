import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';

export async function GET() {
  const url = process.env.DATABASE_URL || '';
  let activeDbFile: string | null = null;
  if (url.startsWith('file:')) {
    const raw = url.slice('file:'.length);
    // If path is relative, resolve relative to process.cwd()
    activeDbFile = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  }
  let activeDbExists = false;
  let activeDbSizeBytes = 0;
  if (activeDbFile) {
    try {
      if (fs.existsSync(activeDbFile)) {
        activeDbExists = true;
        activeDbSizeBytes = fs.statSync(activeDbFile).size;
      }
    } catch { /* ignore */ }
  }
  return NextResponse.json({
    activeDatabaseUrl: url || null,
    activeDbFile,
    activeDbExists,
    activeDbSizeBytes,
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV || null
  });
}