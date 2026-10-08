# work-like-moss

HR intelligence dashboard — React + TypeScript + Vite + Tailwind CSS + shadcn/ui.

```bash
npm install
npm run dev
npm run build
```

## Optional Gemini drafting

The project works after cloning without any AI environment variables. It uses the existing
evidence-based draft fallback by default.

For local live Gemini drafting, copy `.env.example` to `.env`, then set:

```env
VITE_AI_ENABLED=true
GEMINI_API_KEY=your_gemini_key
```

`GEMINI_API_KEY` is read only by `server/hr-draft-server.mjs`. Keep the local server
configuration from `.env.example` when running the clone locally.
Run the frontend and the secure draft boundary in separate terminals:

```bash
npm run ai-server
npm run dev
```

Never prefix `GEMINI_API_KEY` with `VITE_`. With the flag set to `false`, the missing key, or the
draft server unavailable, Issue Detail uses the existing deterministic explanation and
recommendation fallback.

Netlify deploys the static frontend only. Keep `VITE_AI_ENABLED=false` there unless the secure
draft server is deployed separately and the `/api/hr-draft` endpoint is configured to reach it.
Never add `GEMINI_API_KEY` to a Vite environment variable or frontend build output.

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
