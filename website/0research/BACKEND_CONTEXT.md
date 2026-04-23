# BACKEND_CONTEXT.md — Bridge Between Antigravity IDE & Figma Make

## How This File Works

This file is the **communication channel** between your two development environments.

- **In Antigravity IDE**: Update this file whenever you add a new API function,
  Appwrite collection, Directus schema, or backend feature.
- **In Figma Make**: Read this file to understand what backend functions are available
  so you can wire them into the UI correctly.

This prevents merge conflicts because each tool only edits its own files.

---

## File Ownership Map (WHO EDITS WHAT)

```
FIGMA MAKE owns (UI):                ANTIGRAVITY IDE owns (Backend):
─────────────────────                ─────────────────────────────────
/src/app/pages/*                     /src/app/lib/appwrite.ts
/src/app/components/*                /src/app/lib/directus.ts
/src/styles/*                        /src/app/api/config.ts
/src/app/data/*                      /src/app/api/feeds.ts (implementation)
                                     /src/app/api/auth.ts (implementation)

SHARED (both read, coordinate changes):
────────────────────────────────────────
/src/app/types/index.ts              ← The contract between frontend & backend
/BACKEND_CONTEXT.md                  ← This file (IDE writes, Figma Make reads)
/RULES.md                            ← Development rules (both follow)
/SKILLS.md                           ← Architecture reference (both follow)
```

### Why This Prevents Conflicts

- Figma Make edits pages & components → calls functions like `getMetadata()`
- IDE edits api/ files → changes what's INSIDE `getMetadata()` (Appwrite SDK calls)
- The function SIGNATURES never change → pages don't break
- Types file is the contract → both agree on data shapes

---

## Current API Functions (The Contract)

These are the functions that pages/components can call.
The function names and return types are FIXED — only the implementation changes.

### Feed APIs (`/src/app/api/feeds.ts`)

```typescript
// Fetches paginated feed metadata
getMetadata(offset: number, limit: number): Promise<MetadataResponse>
// Returns: { items: MetadataItem[], total: number }

// Fetches media content for specific items
getMedia(ids: string[]): Promise<MediaItem[]>
// Returns: Array of MediaItem objects with content_items
```

### Auth APIs (`/src/app/api/auth.ts`)

```typescript
// Sends OTP to user's email
sendOTP(email: string): Promise<OTPResponse>
// Returns: { success: boolean, message: string }

// Verifies OTP and returns auth token
verifyOTP(email: string, otp: string): Promise<VerifyResponse>
// Returns: { success: boolean, token: string, user: UserData }

// Builds Google OAuth URL for redirect
buildGoogleOAuthUrl(): string
// Returns: Complete Google OAuth URL
```

---

## Backend Status

### Frontend Hosting (Railway)
- **Status**: ✅ Deployed
- **Domain**: `zeros.design` (pending DNS verification)
- **Config**: `railway.toml` in project root
- **Build**: `pnpm build` → serves `dist/` with SPA fallback

### Appwrite (Auth Only)
- **Status**: ⏳ SDK initialized, auth not yet wired (Phase 3)
- **Setup file**: `/src/app/lib/appwrite.ts`
- **Endpoint**: `https://appwrite.santhoshbalaji.cloud/v1`
- **Project ID**: `69a072a8003b57248b1c`
- **Note**: Used ONLY for authentication (OTP, OAuth). NOT used for data or hosting.

### Directus (CMS)
- **Status**: ✅ Connected — feeds and media collections live
- **Setup file**: `/src/app/lib/directus.ts`
- **Endpoint**: `https://cms.0research.zeros.design`
- **Collections**: `feeds`, `media`

---

## Appwrite Collections

(Update this section in your IDE when you create collections)

### Collection: `feeds`
| Field           | Type     | Notes                        |
|----------------|----------|------------------------------|
| id             | string   | Auto-generated               |
| title          | string   | Feed item title              |
| module         | string   | case_studies/lessons/ux_bites/directory/glossary |
| category       | string   | Primary category             |
| description    | string   | Short description            |
| subcategory    | string   | Sub-category for filtering   |
| thumbnail_url  | string   | Thumbnail image URL          |
| item_type      | string   | feed/directory/section        |
| created_at     | number   | Timestamp                    |

### Collection: `users`
| Field    | Type     | Notes                |
|---------|----------|----------------------|
| id      | string   | Auto-generated       |
| email   | string   | User email           |
| name    | string   | Display name         |

### Collection: `media`
| Field          | Type     | Notes                     |
|---------------|----------|---------------------------|
| id            | string   | Matches feed item ID      |
| content_items | JSON     | Array of ContentItem      |

---

## Directus Collections

(Update this section in your IDE when you create Directus schemas)

### Collection: `lessons`
| Field       | Type     | Notes                       |
|------------|----------|-----------------------------|
| (define when created in Directus)                  |

### Collection: `case_studies`
| Field       | Type     | Notes                       |
|------------|----------|-----------------------------|
| (define when created in Directus)                  |

---

## How to Add a New API Function

1. **In IDE**: Add the function to the correct api/ file
2. **In IDE**: Add the return type to `/src/app/types/index.ts`
3. **In IDE**: Update this BACKEND_CONTEXT.md with the new function signature
4. **In Figma Make**: Read this file, then call the new function from a page/component

Example — adding a "like" feature:

```
IDE adds to /src/app/api/feeds.ts:
  likeItem(itemId: string, userId: string): Promise<{ success: boolean }>

IDE adds to /src/app/types/index.ts:
  export interface LikeResponse { success: boolean; }

IDE updates BACKEND_CONTEXT.md:
  likeItem(itemId, userId) → { success: boolean }

Figma Make reads this file, then in a component:
  import { likeItem } from '../api/feeds';
  const result = await likeItem(item.id, user.id);
```

---

## Git Workflow

1. **IDE branch**: `backend/feature-name` → edits api/, lib/, types
2. **Figma Make**: pushes to `main` or `ui/feature-name` → edits pages/, components/, styles/
3. **Merge**: Since files don't overlap, merges are clean
4. **If types change**: Coordinate — IDE updates types first, pushes, then Figma Make pulls

### Conflict Prevention Checklist
- [ ] Did I only edit files in my tool's ownership zone?
- [ ] Did I update BACKEND_CONTEXT.md with any new API functions?
- [ ] Did I coordinate type changes before both tools edit types/index.ts?
- [ ] Am I using the exact function signatures from the contract?
