// ============================================
// ROUTES: All page routes for 0research app
// PURPOSE: Defines which component renders at which URL.
// AUTH:
//   /          — public homepage (no auth)
//   /internal  — RequireAuth (any signed-in user via
//                @0zerosdesign/auth-client → accounts.zeros.design)
// ============================================

import { createElement } from "react";
import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/layout/RootLayout";
import { HomePage } from "./pages/HomePage";
import { RequireAuth } from "./components/auth/RequireAuth";
import { AiToolPage } from "./internal/AiToolPage";

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
        element: createElement(RequireAuth, null, createElement(AiToolPage)),
      },
    ],
  },
]);
