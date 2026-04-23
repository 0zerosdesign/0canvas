/// <reference types="vite/client" />

// ============================================
// Vite Environment Variable Type Declarations
// PURPOSE: Provides TypeScript type safety for import.meta.env
// ============================================

interface ImportMetaEnv {
    /** Backend API base URL */
    readonly VITE_API_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
