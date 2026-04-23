# SKILLS.md - 0research Project Development Guide

## Project: 0research - Content Discovery & Learning Platform

## Architecture Overview

This project follows a **Visual Development Mirror** pattern.
Every file and folder is organized exactly like components, pages, and workflows
appear in visual tools like Nordcraft, Webflow, or Retool.

---

## Folder Structure (Mirrors Visual Dev Tools)

```
/src/app/
│
├── App.tsx                         # Entry point (Router Provider)
├── routes.ts                       # All page routes (like Pages panel)
│
├── api/                            # API Layer (like API panel in Xano/Nordcraft)
│   ├── feeds.ts                    # Feed APIs: metadata + media
│   ├── auth.ts                     # Auth APIs: OTP send + verify
│   └── config.ts                   # API base URLs and configuration
│
├── types/                          # Data Types (like Variable Types)
│   └── index.ts                    # All TypeScript interfaces
│
├── data/                           # Mock/Seed Data (like Test Data)
│   └── mock-feeds.ts               # Mock feed items for development
│
├── pages/                          # Pages (like Pages panel)
│   ├── HomePage.tsx                # Route: / (Feed Experience)
│   ├── LoginPage.tsx               # Route: /login (Authentication)
│   └── OAuthCallback.tsx           # Route: /oauth/google (Callback)
│
├── components/                     # Components (like Components panel)
│   ├── buttons/
│   │   ├── PrimaryButton.tsx       # Navigation button (dark bg)
│   │   └── SecondaryButton.tsx     # Action button (accent bg)
│   ├── feed/
│   │   ├── FeedExperience.tsx      # Main 3-column feed layout
│   │   ├── MainFeedItem.tsx        # Individual feed content card
│   │   ├── SideFeedItem.tsx        # Right sidebar active item
│   │   └── ListFeedItem.tsx        # Left sidebar list item
│   └── layout/
│       └── RootLayout.tsx          # Root layout wrapper
│
└── styles/                         # Styles
    ├── 0research.css               # 0research theme variables + custom styles
    ├── fonts.css                   # Font imports
    └── theme.css                   # Base theme tokens
```

---

## How to Read Each File

### Pages (like Nordcraft Pages)
Each page file contains:
1. **VARIABLES** - State variables at the top (like Variables panel)
2. **WORKFLOWS** - Functions that handle logic (like Workflows panel)
3. **EVENT HANDLERS** - User interaction handlers (like Event panel)
4. **RENDER** - The HTML/JSX structure (like the Canvas)

### Components (like Nordcraft Components)
Each component file contains:
1. **ATTRIBUTES** - Props/inputs the component accepts (like Attributes panel)
2. **VARIABLES** - Internal state (like Variables panel)
3. **FORMULAS** - Computed/derived values (like Formulas)
4. **WORKFLOWS** - Component logic
5. **RENDER** - The visual output

### API Files (like Nordcraft API panel)
Each API file contains:
1. **Endpoint URL**
2. **Method** (GET/POST)
3. **Parameters**
4. **Response Type**
5. **Error handling**

---

## Variable Naming Convention

| Visual Tool Term | Code Equivalent |
|-----------------|-----------------|
| Variable        | `useState()`    |
| Formula         | `useMemo()` or computed const |
| Workflow        | Regular function |
| Event Handler   | `onClick`, `onSubmit`, etc. |
| Attribute       | Component `props` |
| Auto-fetch      | `useEffect()` on mount |

---

## Technology Stack

| Layer      | Technology           |
|-----------|----------------------|
| Frontend  | React + TypeScript   |
| Styling   | Tailwind CSS v4 + CSS Variables |
| Routing   | React Router (Data mode) |
| Icons     | Lucide React         |
| Toasts    | Sonner               |
| Animation | Motion (Framer Motion) |
| Backend   | Appwrite (auth only, self-hosted) |
| CMS       | Directus (self-hosted on Railway) |
| Hosting   | Railway (frontend + CMS)  |

---

## Design Tokens (Dark Mode Only)

All colors come from exactly 13 tokens in `/src/styles/0research.css`.
No other colors are allowed anywhere in the codebase.

### Backgrounds (dark → light)
| Token        | Value   | Usage                    |
|-------------|---------|--------------------------|
| `--zeros-bg1` | #0d0d0d | Main app background     |
| `--zeros-bg2` | #1A1A1A | Cards, sections         |
| `--zeros-bg3` | #212121 | Inputs, elevated surface |
| `--zeros-bg4` | #292929 | Hover states            |
| `--zeros-bg5` | #333333 | Active/pressed states   |
| `--zeros-bg6` | #656567 | Muted foreground        |

### Border
| Token             | Value   | Usage                    |
|------------------|---------|--------------------------|
| `--zeros-border` | #3E3D3D | All borders & dividers   |

### Buttons
| Token              | Value   | Usage                    |
|-------------------|---------|--------------------------|
| `--zeros-button`  | #ffffff | Button background (white) |
| `--zeros-button2` | #0D0D0D | Button text (dark)       |

### Text (bright → dim)
| Token          | Value   | Usage                    |
|---------------|---------|--------------------------|
| `--zeros-text1` | #FFFFFF | Headings, primary text   |
| `--zeros-text2` | #AAAAAA | Descriptions, labels     |
| `--zeros-text3` | #888888 | Metadata, captions       |
| `--zeros-text4` | #5C5C5C | Placeholders, hints      |

---

## API Integration Notes

- All API calls are in `/src/app/api/` folder
- Each API function is clearly named and documented
- Mock data is provided in `/src/app/data/` for development
- When connecting to real backend, update URLs in `/src/app/api/config.ts`
- Frontend SDK calls (Directus) replace mock data
- Appwrite SDK is used for authentication only (Phase 3)