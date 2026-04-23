// ============================================
// ROUTE: Semantic Search API
// PURPOSE: AI-powered semantic search over shots (Phase 2)
//
// Endpoints:
//   POST /api/search  → Semantic search using pgvector
//
// STATUS: Placeholder — will be implemented in Phase 2
//         when FastEmbed + pgvector are set up
// ============================================

import { Router, type Router as RouterType } from "express";

const router: RouterType = Router();

// --- POST /api/search ---
// Semantic search: query → FastEmbed → pgvector similarity → ranked shots
router.post("/", async (req, res) => {
  const { query, limit = 20 } = req.body;

  if (!query || typeof query !== "string") {
    res.status(400).json({ error: "Query string is required" });
    return;
  }

  // Phase 2: Will implement:
  // 1. Call FastEmbed service to get query embedding
  // 2. Query pgvector for cosine similarity
  // 3. Fetch matched shot metadata from Directus
  // 4. Return ranked results

  res.json({
    query,
    shots: [],
    total: 0,
    message: "Semantic search not yet implemented — coming in Phase 2",
  });
});

export default router;
