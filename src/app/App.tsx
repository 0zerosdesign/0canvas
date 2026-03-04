// ──────────────────────────────────────────────────────────
// DesignDead — Dev / Documentation Site
// ──────────────────────────────────────────────────────────
//
// Two pages:
//   /           → Documentation (how to install, API, features)
//   /workspace  → Live workspace for testing UI & functionality
//
// This is the development preview. The actual npm package
// exports <DesignDead /> from designdead-engine.tsx.
// ──────────────────────────────────────────────────────────

import React from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";

export default function App() {
  return <RouterProvider router={router} />;
}
