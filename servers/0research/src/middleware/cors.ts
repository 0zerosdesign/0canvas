// ============================================
// MIDDLEWARE: CORS Configuration
// PURPOSE: Allow frontend to call backend API
// ============================================

import cors from "cors";
import { env } from "../config/env.js";

export const corsMiddleware = cors({
  origin: env.nodeEnv === "production"
    ? [env.frontendUrl, "https://zeros.design"]
    : ["http://localhost:5173", "http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});
