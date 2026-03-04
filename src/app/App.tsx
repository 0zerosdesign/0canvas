// ──────────────────────────────────────────────────────────
// DesignDead — Development Preview
// ──────────────────────────────────────────────────────────
//
// This file is the Figma Make / dev server entry point.
// It dogfoods the <DesignDead /> component exactly as a
// consumer would use it — proving the npm package works.
//
// In production (npm), consumers do:
//   import { DesignDead } from "designdead";
//   <DesignDead />
//
// Here we render it with defaultOpen={true} for development.
// ──────────────────────────────────────────────────────────

import React from "react";
import { DesignDead } from "./components/designdead-engine";

export default function App() {
  return (
    <DesignDead
      defaultOpen={true}
      devOnly={false}
      shortcut="d"
      theme="dark"
      position="bottom-right"
    />
  );
}
