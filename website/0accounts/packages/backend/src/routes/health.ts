// ============================================
// ROUTES: Health
// PURPOSE: Health check endpoint for Railway and monitoring
// ============================================

import { Hono } from "hono";

export const healthRoutes = new Hono();

// GET /api/v1/health
healthRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "0accounts",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});
