// ============================================
// ROUTE: Health Check
// PURPOSE: Railway health check + uptime monitoring
// ============================================

import { Router, type Router as RouterType } from "express";

const router: RouterType = Router();

// GET /health
router.get("/", (_req, res) => {
  res.json({ status: "ok", service: "0research-backend", timestamp: new Date().toISOString() });
});

export default router;
