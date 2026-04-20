# App Icons

Generated in Phase 1A-2 once a source icon exists.

**To generate from a 1024×1024 PNG:**

```bash
pnpm tauri icon path/to/app-icon-1024.png
```

This produces all the sizes Tauri bundles (`32x32.png`, `128x128.png`,
`128x128@2x.png`, `icon.icns`, `icon.ico`) into this directory.

Until then, `pnpm tauri:dev` falls back to Tauri's default icon, which is
fine for local development and doesn't block any work.
