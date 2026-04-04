// ──────────────────────────────────────────────────────────
// ZeroCanvas — Dev / Documentation Site
// ──────────────────────────────────────────────────────────
//
// Single page:
//   /  → Documentation (how to install, API, features)
//
// The actual 0canvas overlay is included via <ZeroCanvas />
// and toggled with Ctrl+Shift+D on any page.
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
