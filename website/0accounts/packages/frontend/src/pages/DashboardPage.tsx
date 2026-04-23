// ============================================
// PAGE: DashboardPage
// ROUTE: / (index)
// PURPOSE: Main dashboard showing user greeting and product access grid
// ============================================

import { useEffect } from "react";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import ProductGrid from "../components/products/ProductGrid";
import { useProfile } from "../hooks/useProfile";
import { useAppStore } from "../store";
import "./DashboardPage.css";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  // --- VARIABLES ---

  const { profile, fetchProfile } = useProfile();
  const authSession = useAppStore((s) => s.authSession);

  // User's display name for the greeting
  const displayName = profile?.display_name || profile?.name || authSession?.name || "there";

  // Number of products the user has accessed
  const accessedCount = profile?.products?.filter((p) => p.accessed).length || 0;

  // Total number of products
  const totalProducts = profile?.products?.length || 0;

  // --- WORKFLOWS ---

  // WORKFLOW: loadProfile
  // TRIGGERED BY: Page mount
  // WHAT IT DOES: Fetches the user's full profile with product access data
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // --- RENDER ---

  return (
    <div className="dashboard-page">
      <section className="dashboard-header">
        <h1 className="dashboard-greeting">
          Hello, {displayName}
        </h1>
        <p className="dashboard-subtitle">
          You've accessed {accessedCount} of {totalProducts} Zero products
        </p>
      </section>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Your Products</h2>
        <ProductGrid products={profile?.products || []} />
      </section>
    </div>
  );
}
