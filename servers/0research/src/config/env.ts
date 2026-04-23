// ============================================
// CONFIG: Environment Variables
// PURPOSE: Central place for all backend configuration
// ============================================

export const env = {
  port: parseInt(process.env.PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  // Directus CMS
  directusUrl: process.env.DIRECTUS_URL || "https://cms.0research.zeros.design",
  directusAdminToken: process.env.DIRECTUS_ADMIN_TOKEN || "",

  // Ollama embedding service (Phase 2)
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",

  // Database (Phase 2 — pgvector)
  databaseUrl: process.env.DATABASE_URL || "",

  // Frontend URL for CORS
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
} as const;
