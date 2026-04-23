// ============================================
// MIDDLEWARE: CORS
// PURPOSE: Configure CORS for *.zeros.design domains and localhost dev
// ============================================

import { cors } from "hono/cors";

// WORKFLOW: zerosCorsMw
// TRIGGERED BY: Every incoming request
// WHAT IT DOES:
// 1. Allows requests from any *.zeros.design subdomain
// 2. Allows localhost origins for local development
// 3. Permits auth-related headers (X-User-Token, X-Service-Key)
export const zerosCorsMw = cors({
  origin: (origin) => {
    // Server-to-server requests (no browser origin) — allow for health checks and service calls
    if (!origin) return "";

    // Allow all zeros.design subdomains
    if (origin.endsWith(".zeros.design") || origin === "https://zeros.design") {
      return origin;
    }

    // Allow localhost for development
    if (
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:")
    ) {
      return origin;
    }

    return "";
  },
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "X-User-Token",
    "X-Service-Key",
  ],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 86400,
  credentials: true,
});
