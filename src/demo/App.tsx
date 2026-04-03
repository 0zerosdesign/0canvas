// ──────────────────────────────────────────────────────────
// ZeroCanvas — Dev / Documentation Site
// ──────────────────────────────────────────────────────────
//
// Two pages:
//   /           → Documentation (how to install, API, features)
//   /workspace  → Live workspace for testing UI & functionality
//
// This is the development preview. The actual npm package
// exports <ZeroCanvas /> from 0canvas-engine.tsx.
// ──────────────────────────────────────────────────────────

import React from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ZeroCanvas } from "../0canvas/engine/0canvas-engine";

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <ZeroCanvas devOnly={false} />
    </>
  );
}
