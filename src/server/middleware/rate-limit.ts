import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string; // Function to generate rate limit key
  skipSuccessfulRequests?: boolean; // Skip rate limiting for successful requests
  skipFailedRequests?: boolean; // Skip rate limiting for failed requests
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimitStore {
  private store = new Map<string, RateLimitEntry>();

  // Clean up expired entries periodically
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  get(key: string): RateLimitEntry | undefined {
    this.cleanup();
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry) {
    this.store.set(key, entry);
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const resetTime = now + windowMs;
    const existing = this.get(key);

    if (!existing || existing.resetTime < now) {
      // New window or expired entry
      const entry: RateLimitEntry = { count: 1, resetTime };
      this.set(key, entry);
      return { count: 1, resetTime };
    } else {
      // Increment existing count
      existing.count += 1;
      this.set(key, existing);
      return { count: existing.count, resetTime: existing.resetTime };
    }
  }

  // Get remaining requests and reset time
  getRemaining(key: string, maxRequests: number): { remaining: number; resetTime: number } {
    const entry = this.get(key);
    if (!entry || entry.resetTime < Date.now()) {
      return { remaining: maxRequests, resetTime: Date.now() + 60000 }; // Default 1 minute
    }

    return {
      remaining: Math.max(0, maxRequests - entry.count),
      resetTime: entry.resetTime
    };
  }
}

// Global rate limit store (in production, this should be Redis or similar)
const rateLimitStore = new RateLimitStore();

// Default key generator based on IP address
function defaultKeyGenerator(req: NextRequest): string {
  // Try to get real IP from various headers
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const clientIp = req.headers.get('x-client-ip');

  const ip = forwarded?.split(',')[0]?.trim() ||
             realIp ||
             clientIp ||
             'unknown';

  return `ip:${ip}`;
}

export function createRateLimitMiddleware(config: RateLimitConfig) {
  const keyGenerator = config.keyGenerator || defaultKeyGenerator;

  return function rateLimitMiddleware(
    req: NextRequest,
    handler: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    const key = keyGenerator(req);

    // Check current rate limit status
    const { count, resetTime } = rateLimitStore.increment(key, config.windowMs);

    // Set rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    headers.set('X-RateLimit-Remaining', Math.max(0, config.maxRequests - count).toString());
    headers.set('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());

    if (count > config.maxRequests) {
      // Rate limit exceeded
      const resetIn = Math.ceil((resetTime - Date.now()) / 1000);
      headers.set('Retry-After', resetIn.toString());

      return Promise.resolve(new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again in ${resetIn} seconds.`,
          retryAfter: resetIn
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(headers.entries())
          }
        }
      ));
    }

    // Within rate limit, proceed with request
    return handler().then(response => {
      // Add rate limit headers to successful response
      const newHeaders = new Headers(response.headers);
      headers.forEach((value, headerKey) => {
        newHeaders.set(headerKey, value);
      });

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    });
  };
}

// Pre-configured rate limiters for common use cases
export const strictRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
});

export const moderateRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests per minute
});

export const lenientRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
});

// Rate limiter for AI generation endpoints (more restrictive)
export const aiGenerationRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // 20 AI generations per minute
  keyGenerator: (req) => {
    // Use user session for AI endpoints if available
    const sessionId = req.headers.get('x-session-id') || req.headers.get('authorization');
    if (sessionId) {
      return `user:${sessionId.replace('Bearer ', '').substring(0, 16)}`;
    }
    return defaultKeyGenerator(req);
  }
});

// Rate limiter for search endpoints
export const searchRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50, // 50 searches per minute
});

// Helper function to wrap API handlers with rate limiting
export function withRateLimit<T extends any[]>(
  rateLimiter: ReturnType<typeof createRateLimitMiddleware>,
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    const req = args[0] as NextRequest;

    return rateLimiter(req, () => handler(...args));
  };
}
