// ============================================
// SCRIPT: Migrate Users
// PURPOSE: Pull existing users from Supabase auth into Railway PG zeros_profiles
// RUN: pnpm migrate:users
// NOTE: Requires DATABASE_URL (Railway public URL) and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
// ============================================

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const { Pool } = pg;

// --- VALIDATE ENV VARS ---
const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin email — this user gets is_admin = true in all products
const ADMIN_EMAIL = "arunrajkumar@withso.com";

if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required env vars: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const pool = new Pool({ connectionString: DATABASE_URL });

async function migrate() {
  console.log("=== Step 1: Fetch users from Supabase auth ===");

  // List all users from Supabase auth
  const { data: { users }, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error("Failed to list Supabase users:", error.message);
    process.exit(1);
  }

  console.log(`Found ${users.length} users in Supabase auth:\n`);

  for (const user of users) {
    const email = user.email || "";
    const name = user.user_metadata?.name || email.split("@")[0];
    const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    console.log(`  ${isAdmin ? "[ADMIN]" : "[USER] "} ${email} (${user.id})`);

    // Upsert into zeros_profiles
    await pool.query(
      `INSERT INTO zeros_profiles (id, email, name, role, is_admin)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         is_admin = EXCLUDED.is_admin,
         updated_at = NOW()`,
      [user.id, email, name, isAdmin ? "admin" : "user", isAdmin],
    );
  }

  console.log(`\nMigrated ${users.length} users to zeros_profiles.`);

  // --- Step 2: Seed products ---
  console.log("\n=== Step 2: Seed zeros_products ===");

  const products = [
    { id: "0colors", name: "0colors", display_name: "0colors", description: "Design token color system for creating beautiful palettes", url: "https://0colors.zeros.design", color: "#ffffff", status: "active", sort_order: 1 },
    { id: "0research", name: "0research", display_name: "0research", description: "Content discovery and UX research platform", url: "https://0research.zeros.design", color: "#ffffff", status: "active", sort_order: 2 },
    { id: "0canvas", name: "0canvas", display_name: "0canvas", description: "Design canvas tool for visual creation", url: "https://0canvas.zeros.design", color: "#ffffff", status: "active", sort_order: 3 },
    { id: "0docs", name: "0docs", display_name: "0docs", description: "Design documentation platform", url: "https://0docs.zeros.design", color: "#ffffff", status: "coming_soon", sort_order: 4 },
    { id: "0kit", name: "0kit", display_name: "0kit", description: "UI component kit for designers and developers", url: "https://0kit.zeros.design", color: "#ffffff", status: "active", sort_order: 5 },
  ];

  for (const p of products) {
    await pool.query(
      `INSERT INTO zeros_products (id, name, display_name, description, url, color, status, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         description = EXCLUDED.description,
         url = EXCLUDED.url,
         status = EXCLUDED.status,
         sort_order = EXCLUDED.sort_order,
         updated_at = NOW()`,
      [p.id, p.name, p.display_name, p.description, p.url, p.color, p.status, p.sort_order],
    );
    console.log(`  + ${p.display_name} (${p.id})`);
  }

  // --- Step 3: Register product access for existing 0colors users ---
  console.log("\n=== Step 3: Register product access for 0colors ===");

  for (const user of users) {
    await pool.query(
      `INSERT INTO zeros_product_access (user_id, product_id, status, first_accessed_at, last_accessed_at)
       VALUES ($1, '0colors', 'active', NOW(), NOW())
       ON CONFLICT (user_id, product_id) DO NOTHING`,
      [user.id],
    );
    console.log(`  + ${user.email} → 0colors`);
  }

  // --- Done ---
  console.log("\n=== Migration complete ===");
  console.log(`  - ${users.length} users migrated to zeros_profiles`);
  console.log(`  - ${products.length} products seeded`);
  console.log(`  - ${users.length} zeros_product_access records for 0colors`);
  console.log(`  - Admin: ${ADMIN_EMAIL}`);

  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
