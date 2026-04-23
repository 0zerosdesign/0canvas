# 0ai — Internal UX Shots Content Engine

## What is this?

An internal AI chat tool that analyzes UI screenshots of AI applications and generates structured UX Shots content — consistent with the 0research platform's content format.

## How it works

1. **Chat interface** connects to OpenAI API via user's API key
2. Upload UI screenshots → AI analyzes and generates structured UX shot content
3. System prompt is pre-trained with UX analysis methodology (informed by ux-bites.jsonl structure)
4. All generated content follows a consistent format for direct use in the Shots module

## Architecture

```
src/app/0ai/
├── PLAN.md            # This file
├── AiToolPage.tsx     # Main page (state, streaming, orchestration)
├── ChatMessage.tsx    # Message bubble with markdown rendering
├── ChatInput.tsx      # Input area with image paste/drop/pick
├── Settings.tsx       # API key, model, system prompt, temperature
├── openai.ts          # OpenAI streaming API (fetch-based, no SDK)
├── types.ts           # TypeScript interfaces
└── 0ai.css            # Styles using zeros design tokens
```

**Route:** `/0ai`
**Tech:** React + TypeScript, OpenAI Chat Completions API (streaming), CSS variables from `variables.css`
**Dependencies:** None added — uses native fetch for API, custom markdown renderer

## AI Integration

- **Provider:** OpenAI API (user provides their own API key)
- **Models:** GPT-4o-mini (default, cheapest), GPT-4o, GPT-4.1, GPT-4.1-mini, GPT-4.1-nano
- **Vision:** Supports image uploads for UI screenshot analysis
- **Streaming:** Real-time token streaming for responsive UX
- **Cost:** ~$0.15/1M input tokens with gpt-4o-mini — well under $5/mo for typical usage

## V1 Features

- [x] Chat interface with streaming responses
- [x] Image upload (paste, drag-drop, file picker)
- [x] Markdown rendering (code blocks, lists, bold, headers)
- [x] Model selector
- [x] System prompt editor (pre-filled for UX analysis)
- [x] API key management (localStorage, show/hide)
- [x] Temperature control
- [x] New chat / clear conversation
- [x] Responsive design (desktop + mobile)
- [x] Zeros design system integration

## Future (V2+)

- Save/export generated shots to Directus CMS
- Conversation history persistence
- Batch analysis mode (multiple screenshots)
- Training refinement with ux-bites.jsonl examples
- Public launch inside 0research platform
- Compare mode (two UIs side by side)
- Template system for different shot types
