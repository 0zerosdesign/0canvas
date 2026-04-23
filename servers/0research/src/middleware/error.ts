// ============================================
// MIDDLEWARE: Error Handler
// PURPOSE: Catches unhandled errors and returns clean JSON responses
// ============================================

import type { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("[ERROR]", err.message);

  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
}
