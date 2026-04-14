// ──────────────────────────────────────────────────────────
// Design Tokens — CSS custom properties scoped to [data-0canvas-root]
// ──────────────────────────────────────────────────────────

export const tokensCSS = (S: string) => `
/* ── Design Tokens (from variables.css) ── */
${S} {
  /* Grey */
  --grey-50: #FAFAFA; --grey-100: #F5F5F5; --grey-200: #E5E5E5;
  --grey-300: #D4D4D4; --grey-400: #A3A3A3; --grey-500: #737373;
  --grey-600: #525252; --grey-700: #404040; --grey-800: #262626;
  --grey-900: #171717; --grey-950: #0a0a0a;
  /* Blue (primary) */
  --blue-50: #EFF6FF; --blue-100: #DBEAFE; --blue-200: #BFDBFE;
  --blue-300: #93C5FD; --blue-400: #60A5FA; --blue-500: #3B82F6;
  --blue-600: #2563EB; --blue-700: #1D4ED8; --blue-800: #1E40AF;
  --blue-900: #1E3A8A;
  /* Red (error) */
  --red-50: #FEF2F2; --red-100: #FEE2E2; --red-200: #FECACA;
  --red-300: #FCA5A5; --red-400: #F87171; --red-500: #EF4444;
  --red-600: #DC2626; --red-700: #B91C1C; --red-800: #991B1B;
  --red-900: #7F1D1D;
  /* Green (success) */
  --green-50: #ECFDF5; --green-100: #D1FAE5; --green-200: #A7F3D0;
  --green-300: #6EE7B7; --green-400: #34D399; --green-500: #10B981;
  --green-600: #059669; --green-700: #047857; --green-800: #065F46;
  --green-900: #064E3B;
  /* Yellow (warning) */
  --yellow-50: #FFFBEB; --yellow-100: #FEF3C7; --yellow-200: #FDE68A;
  --yellow-300: #FCD34D; --yellow-400: #FBBF24; --yellow-500: #F59E0B;
  --yellow-600: #D97706; --yellow-700: #B45309; --yellow-800: #92400E;
  --yellow-900: #78350F;
  /* Orange */
  --orange-400: #FB923C; --orange-500: #F97316;
  /* Purple */
  --purple-400: #A78BFA; --purple-500: #8B5CF6;
  /* Pink */
  --pink-400: #F472B6; --pink-500: #EC4899;
  /* Teal */
  --teal-400: #2DD4BF; --teal-500: #14B8A6;
  /* Cyan */
  --cyan-400: #22D3EE;
  /* Indigo */
  --indigo-200: #C7D2FE; --indigo-300: #A5B4FC; --indigo-400: #818CF8;
  /* Defaults */
  --default-text-color: #FAFAFA;
  --default-bg-color: #171717;
  /* Semantic: Surface */
  --color--surface--floor: var(--grey-950);
  --color--surface--0: var(--grey-900);
  --color--surface--1: var(--grey-800);
  --color--surface--2: var(--grey-700);
  --color--surface--absolute: black;
  --color--surface--inverted: var(--grey-200);
  /* Semantic: Text */
  --color--text--on-surface: var(--grey-200);
  --color--text--on-surface-variant: var(--grey-400);
  --color--text--muted: var(--grey-500);
  --color--text--disabled: var(--grey-600);
  --color--text--hint: var(--grey-700);
  --color--text--on-primary: var(--grey-50);
  --color--text--primary: var(--blue-600);
  --color--text--primary-light: var(--blue-400);
  --color--text--link: var(--blue-600);
  --color--text--info: var(--blue-500);
  --color--text--success: var(--green-500);
  --color--text--warning: var(--yellow-500);
  --color--text--critical: var(--red-500);
  --color--text--critical-light: var(--red-400);
  /* Semantic: Border */
  --color--border--on-surface-0: var(--grey-800);
  --color--border--on-surface-1: var(--grey-700);
  --color--border--on-surface-2: var(--grey-600);
  /* Semantic: Base / Primary */
  --color--base--primary: var(--blue-600);
  --color--base--primary-hover: var(--blue-700);
  --color--base--primary-light: var(--blue-500);
  /* Semantic: Status */
  --color--status--info: var(--blue-500);
  --color--status--success: var(--green-500);
  --color--status--warning: var(--yellow-500);
  --color--status--critical: var(--red-500);
  --color--status--connecting: var(--orange-500);
  /* Semantic: Outline */
  --color--outline--focus: var(--blue-500);
  --color--outline--on-background: var(--blue-600);
  /* Semantic: Shadow */
  --color--shadow--surface: rgba(0,0,0,0.25);
  --color--shadow--overlay: rgba(0,0,0,0.6);
  /* Semantic: Syntax */
  --color--syntax--comment: var(--grey-400);
  --color--syntax--selector: var(--green-500);
  --color--syntax--property: var(--blue-300);
  --color--syntax--value: var(--orange-400);
  /* Fonts */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'Fira Code', 'JetBrains Mono', 'Geist Mono', monospace;
  /* Font sizes */
  --font-size-xxs: 0.625rem; --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem; --font-size-base: 1rem;
  --font-size-lg: 1.125rem; --font-size-xl: 1.25rem;
  /* Font weights */
  --font-weight-light: 300; --font-weight-regular: 400;
  --font-weight-normal: 500; --font-weight-semi-bold: 600;
  --font-weight-bold: 700;
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.25);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.25), 0 2px 4px -1px rgba(0,0,0,0.25);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.25), 0 4px 6px -2px rgba(0,0,0,0.25);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.25), 0 10px 10px -5px rgba(0,0,0,0.25);
}

/* ── Targeted reset: override inherited consumer styles ── */
${S} {
  font-family: var(--font-sans) !important;
  font-size: var(--font-size-sm) !important;
  line-height: 1.5 !important;
  color: var(--color--text--on-surface) !important;
  letter-spacing: normal !important;
  font-weight: 400 !important;
  text-transform: none !important;
  font-style: normal !important;
  text-decoration: none !important;
  word-spacing: normal !important;
  white-space: normal !important;
  direction: ltr !important;
  text-align: left !important;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

${S} *, ${S} *::before, ${S} *::after {
  box-sizing: border-box !important;
  margin: 0;
  padding: 0;
  border: 0 solid var(--color--border--on-surface-0);
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
  color: inherit;
  letter-spacing: inherit !important;
  font-weight: inherit !important;
  text-transform: inherit !important;
  text-decoration: inherit !important;
  -webkit-font-smoothing: inherit;
}

${S} button {
  background: transparent;
  border: none;
  cursor: pointer;
  font: inherit;
  color: inherit;
  padding: 0;
  margin: 0;
  text-align: inherit;
  appearance: none;
  -webkit-appearance: none;
}
${S} input, ${S} textarea {
  font: inherit;
  color: inherit;
  background: transparent;
  appearance: none;
  -webkit-appearance: none;
}
${S} svg { display: inline-block; vertical-align: middle; }
${S} img { display: block; max-width: 100%; }
${S} a { color: inherit; text-decoration: none; }
${S} ul, ${S} ol { list-style: none; }
${S} *:focus-visible { outline: 2px solid var(--color--outline--focus); outline-offset: 2px; }

/* ── Scrollbar ── */
${S} ::-webkit-scrollbar { width: 6px; height: 6px; }
${S} ::-webkit-scrollbar-track { background: transparent; }
${S} ::-webkit-scrollbar-thumb { background: var(--color--surface--2); border-radius: 3px; }
${S} ::-webkit-scrollbar-thumb:hover { background: var(--color--border--on-surface-2); }
`;
