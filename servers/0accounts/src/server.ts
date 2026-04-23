// ============================================
// SERVER: 0accounts Backend
// PORT: 4456
// PURPOSE: Hono API server for Zero account management
// ============================================

import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { zerosCorsMw } from "./middleware/cors.js";
import { csp } from "./middleware/csp.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { profileRoutes } from "./routes/profile.js";
import { productRoutes } from "./routes/products.js";
import { adminRoutes } from "./routes/admin.js";
import { initializeTables } from "./db.js";

const app = new Hono();

// --- MIDDLEWARE ---
app.use("*", zerosCorsMw);
app.use("*", csp());

// --- ROUTES ---
app.route("/api/v1", healthRoutes);
app.route("/api/v1", authRoutes);
app.route("/api/v1", profileRoutes);
app.route("/api/v1", productRoutes);
app.route("/api/v1", adminRoutes);

// --- SERVER STARTUP ---
const port = parseInt(process.env.PORT || "4456", 10);

async function start() {
  // Initialize database tables on startup
  await initializeTables();

  serve({ fetch: app.fetch, port }, () => {
    console.log(`0accounts backend running on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
