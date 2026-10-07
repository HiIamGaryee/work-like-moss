# work-like-moss

HR intelligence dashboard — React + TypeScript + Vite + Tailwind CSS + shadcn/ui.

```bash
npm install
npm run dev
npm run build
```

## Optional Gemini drafting

Copy `.env.example` to `.env`, then set `VITE_AI_ENABLED=true` and add the server-only
`GEMINI_API_KEY`. Run the frontend and the small secure draft boundary in separate terminals:

```bash
npm run ai-server
npm run dev
```

Never prefix `GEMINI_API_KEY` with `VITE_`. With the flag set to `false`, the missing key, or the
draft server unavailable, Issue Detail uses the existing deterministic explanation and
recommendation fallback.

## Structure

```
src/
├── components/ui/   shadcn/ui primitives
├── layouts/         app shell layouts
├── lib/             shared helpers (cn)
├── pages/           route pages
├── App.tsx          route definitions
├── main.tsx         entry
└── index.css        theme tokens + typography utilities
```

Path alias `@/*` resolves to `src/*`.
