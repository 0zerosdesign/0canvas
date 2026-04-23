# 0research

Content discovery & learning platform.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript |
| Styling | Tailwind CSS v4 + CSS Variables |
| Build | Vite |
| CMS | Directus (Railway) |
| Auth | Appwrite (self-hosted) |
| Hosting | Railway |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Project Structure

```
src/
├── main.tsx                    # Entry point
├── styles/                     # Design system (13 CSS tokens)
└── app/
    ├── routes.ts               # URL routing
    ├── pages/                  # Page components
    ├── components/feed/        # Feed UI components
    ├── components/shared/      # Shared utilities
    ├── api/                    # Data fetching (Directus, Auth)
    ├── lib/                    # SDK clients
    ├── data/                   # Mock data
    └── types/                  # TypeScript interfaces

Dataaset training/
├── crawlers/                   # Auth crawl scripts + crawl diagnostics
└── ux-bites/                   # UX Bites scripts, docs, dataset, assets
```

## Environment Variables

```env
VITE_APPWRITE_ENDPOINT=https://appwrite.santhoshbalaji.cloud/v1
VITE_APPWRITE_PROJECT_ID=your-project-id
```

## Authenticated Firecrawl Crawl

Dataset and crawl artifacts live under [Dataaset training](/Users/arunrajkumar/Documents/0research/Dataaset%20training), not inside the application source tree.

Run an authenticated crawl by passing your Firecrawl API key and the target site's session cookie as environment variables:

```bash
FIRECRAWL_API_KEY=fc-... \
AUTH_COOKIE='session=...' \
TARGET_URL='https://builtformars.com/ux-bites' \
pnpm firecrawl:auth-crawl
```

Optional variables:

```bash
OUTPUT_DIR='Dataaset training/crawlers/output'
CRAWL_LIMIT=500
MAX_DISCOVERY_DEPTH=5
CRAWL_ENTIRE_DOMAIN=false
ALLOW_SUBDOMAINS=false
INCLUDE_PATHS='ux-bites/.*'
EXCLUDE_PATHS=''
FIRECRAWL_FORMATS='markdown,html'
ONLY_MAIN_CONTENT=true
AUTH_USER_AGENT='Mozilla/5.0 ...'
AUTH_REFERER='https://builtformars.com/'
```

## Deployment

Deployed on Railway via `railway.toml`. Push to `main` triggers auto-deploy.
