import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { resolveDataDir } from '@/server/storage/data-path';

export async function GET() {
  const dataDir = resolveDataDir();
  let sizeBytes = 0;
  try {
    for (const f of fs.readdirSync(dataDir)) {
      if (f.endsWith('.json')) {
        try { const st = fs.statSync(path.join(dataDir, f)); if (st.isFile()) sizeBytes += st.size; } catch {}
      }
    }
  } catch {}
  return NextResponse.json({ dataDir, jsonApproxSizeBytes: sizeBytes });
}
