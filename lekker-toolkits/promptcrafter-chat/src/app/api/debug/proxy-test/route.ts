import { NextResponse } from "next/server";
import { env } from "@/env";

export async function GET() {
  try {
    // Test environment variable loading
    const token = env.GOOGLE_PROXY_AUTH_TOKEN;
    console.log('Debug: GOOGLE_PROXY_AUTH_TOKEN exists:', !!token);
    
    // Test proxy server accessibility
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    try {
      const response = await fetch('https://promptcrafter.sammyhamwi.ai/healthz', {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      
      console.log('Debug: Proxy health check status:', response.status);
      const result = await response.json();
      console.log('Debug: Proxy health check result:', result);
      
      return NextResponse.json({
        envTokenExists: !!token,
        proxyAccessible: response.ok,
        proxyStatus: response.status,
        proxyResponse: result,
      });
    } catch (fetchError: any) {
      clearTimeout(timeout);
      console.log('Debug: Proxy fetch error:', fetchError.message);
      return NextResponse.json({
        envTokenExists: !!token,
        proxyAccessible: false,
        error: fetchError.message,
      });
    }
  } catch (err: any) {
    console.error('Debug endpoint error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
