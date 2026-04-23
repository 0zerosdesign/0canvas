// ============================================
// MIDDLEWARE: Content Security Policy (Express)
//
// Adds a `Content-Security-Policy` or `Content-Security-Policy-Report-Only`
// header to every response. Defaults to report-only so the rollout can be
// observed in browser consoles before flipping to enforcement.
//
// Flip to enforcement by setting CSP_ENFORCE=1 in the environment.
// ============================================

import type { RequestHandler } from "express";

const directives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts-api.zeros.design https://accounts.zeros.design https://*.directus.app",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const cspMiddleware: RequestHandler = (_req, res, next) => {
  const enforce = process.env.CSP_ENFORCE === "1";
  const headerName = enforce
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";

  res.setHeader(headerName, directives);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  next();
};
