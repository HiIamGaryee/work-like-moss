# work-like-moss

HR intelligence dashboard — React + TypeScript + Vite + Tailwind CSS + shadcn/ui.

```bash
npm install
npm run dev
npm run build
```

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
