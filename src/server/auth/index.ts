import type { NextAuthOptions } from "next-auth";
import type { DefaultSession } from "next-auth";
import { dataLayer } from "@/server/storage/data-layer";
import crypto from "crypto";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string | null;
      role?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: string;
  }
}

// Local user configuration for Electron mode
const LOCAL_USER = {
  id: "local-user",
  name: "Local User",
  email: "local@promptcrafter.app",
  role: "user"
};

// Check if running in Electron mode
const isElectron = () => {
  return !!(process as any)?.versions?.electron ||
         process.env.ELECTRON === '1' ||
         process.env.NEXT_PUBLIC_ELECTRON === '1';
};

// Generate a secure session token for Electron mode
const generateSessionToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Validate session token for Electron mode
const validateSessionToken = (token: string): boolean => {
  // In a real implementation, you'd validate against a secure store
  // For now, we'll use a simple validation
  return token.length === 64 && /^[a-f0-9]+$/.test(token);
};

// Local session store (in-memory for Electron mode)
const localSessions = new Map<string, { user: typeof LOCAL_USER; expires: number }>();

export const authOptions: NextAuthOptions = {
  providers: [
    // Add providers as needed for web mode
    // For Electron mode, we handle authentication differently
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.id = user.id;
        token.role = "user";
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || "development-secret-key-change-in-production",
};

// Authentication function that works for both Electron and web modes
export const auth = async (req?: Request): Promise<{ user: typeof LOCAL_USER } | null> => {
  if (isElectron()) {
    // Electron mode: use local authentication
    const authHeader = req?.headers?.get("authorization") || req?.headers?.get("x-session-token");

    if (!authHeader) {
      return { user: LOCAL_USER }; // Allow anonymous access in Electron for now
    }

    const token = authHeader.replace("Bearer ", "").replace("Token ", "");

    if (validateSessionToken(token)) {
      const session = localSessions.get(token);
      if (session && session.expires > Date.now()) {
        return { user: session.user };
      }
    }

    return { user: LOCAL_USER }; // Fallback to local user
  }

  // Web mode: would use NextAuth.js
  // This would require proper NextAuth setup for web deployment
  return null;
};

// Create a new session for Electron mode
export const createLocalSession = (): string => {
  const token = generateSessionToken();
  const expires = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days

  localSessions.set(token, {
    user: LOCAL_USER,
    expires
  });

  return token;
};

// Validate and refresh session
export const validateLocalSession = (token: string): boolean => {
  const session = localSessions.get(token);
  if (!session) return false;

  if (session.expires < Date.now()) {
    localSessions.delete(token);
    return false;
  }

  return true;
};

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of localSessions.entries()) {
    if (session.expires < now) {
      localSessions.delete(token);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour





