// ============================================
// SERVER: 0research Backend API
// PURPOSE: Express server for AI search + user data
//          (Content fetching is handled by Directus CMS directly)
// HOSTING: Railway
// ============================================

import express from "express";
import { env } from "./config/env.js";
import { corsMiddleware } from "./middleware/cors.js";
import { cspMiddleware } from "./middleware/csp.js";
import { errorHandler } from "./middleware/error.js";
import healthRouter from "./routes/health.js";
import searchRouter from "./routes/search.js";

const app = express();

// --- MIDDLEWARE ---
app.use(corsMiddleware);
app.use(cspMiddleware);
app.use(express.json());

// --- ROUTES ---
app.use("/health", healthRouter);
app.use("/api/search", searchRouter);
// Future: app.use("/api/user", userRouter);

// --- ERROR HANDLER ---
app.use(errorHandler);

// --- START SERVER ---
app.listen(env.port, () => {
  console.log(`[0research-backend] Running on port ${env.port}`);
  console.log(`[0research-backend] Environment: ${env.nodeEnv}`);
});
