// ============================================
// SCRIPT: Seed Products
// PURPOSE: Seed the zeros_products table with all Zero products
// RUN: pnpm seed:products
// NOTE: Requires DATABASE_URL env var pointing to Railway PostgreSQL
// ============================================

import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL in .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// All Zero products
const products = [
  {
    id: "0colors",
    name: "0colors",
    display_name: "0colors",
    description: "Design token color system for creating beautiful palettes",
    url: "https://0colors.zeros.design",
    color: "#ffffff",
    status: "active",
    sort_order: 1,
  },
  {
    id: "0research",
    name: "0research",
    display_name: "0research",
    description: "Content discovery and UX research platform",
    url: "https://0research.zeros.design",
    color: "#ffffff",
    status: "active",
    sort_order: 2,
  },
  {
    id: "0canvas",
    name: "0canvas",
    display_name: "0canvas",
    description: "Design canvas tool for visual creation",
    url: "https://0canvas.zeros.design",
    color: "#ffffff",
    status: "active",
    sort_order: 3,
  },
  {
    id: "0docs",
    name: "0docs",
    display_name: "0docs",
    description: "Design documentation platform",
    url: "https://0docs.zeros.design",
    color: "#ffffff",
    status: "coming_soon",
    sort_order: 4,
  },
  {
    id: "0kit",
    name: "0kit",
    display_name: "0kit",
    description: "UI component kit for designers and developers",
    url: "https://0kit.zeros.design",
    color: "#ffffff",
    status: "active",
    sort_order: 5,
  },
];

async function seed() {
  console.log("Seeding zeros_products table...");

  for (const product of products) {
    try {
      await pool.query(
        `INSERT INTO zeros_products (id, name, display_name, description, url, color, status, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           display_name = EXCLUDED.display_name,
           description = EXCLUDED.description,
           url = EXCLUDED.url,
           color = EXCLUDED.color,
           status = EXCLUDED.status,
           sort_order = EXCLUDED.sort_order,
           updated_at = NOW()`,
        [
          product.id,
          product.name,
          product.display_name,
          product.description,
          product.url,
          product.color,
          product.status,
          product.sort_order,
        ],
      );
      console.log(`  + ${product.display_name} (${product.id})`);
    } catch (err) {
      console.error(`Failed to seed ${product.id}:`, err);
    }
  }

  await pool.end();
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
