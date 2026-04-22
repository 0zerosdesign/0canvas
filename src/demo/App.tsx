// ──────────────────────────────────────────────────────────
// Zeros — Dev / Documentation Site
// ──────────────────────────────────────────────────────────
//
// Single page:
//   /  → Documentation (how to install, API, features)
//
// The actual Zeros overlay is included via <Zeros />
// and toggled with Ctrl+Shift+D on any page.
// ──────────────────────────────────────────────────────────

import React from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Zeros } from "../zeros/engine/zeros-engine";

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Zeros devOnly={false} />
    </>
  );
}
