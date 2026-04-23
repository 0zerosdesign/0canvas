// ============================================
// ROUTES: All page routes for 0research app
// PURPOSE: Defines which component renders at which URL
// AUTH: Handled by @0zerosdesign/auth-client via accounts.zeros.design
// ============================================

import { createElement } from "react";
import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/layout/RootLayout";
import { HomePage } from "./pages/HomePage";
import { RequireAdmin } from "./components/auth/RequireAdmin";
import { AiToolPage } from "./internal/AiToolPage";

// --- ROUTE DEFINITIONS ---
// path: "/"         → HomePage (Feed Experience — public)
// path: "/internal" → AiToolPage (Admin-only internal tool)

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        index: true,
        Component: HomePage,
      },
      {
        path: "internal",
        element: createElement(RequireAdmin, null, createElement(AiToolPage)),
      },
    ],
  },
]);
