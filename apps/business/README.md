# mesita-web-business

Business console for Mesita venue owners and team members — lives at
[business.mesita.ai](https://business.mesita.ai).

Next.js 16 app (Tailwind v4 + shadcn primitives, light theme). Every
read and write goes through a `business-*` Edge Function in
[`mesita-supabase`](https://github.com/Canzeco/mesita-supabase) — the
client never touches the database directly.

## Develop

```bash
pnpm install
pnpm dev
```

Deployed automatically by Vercel on push to `main`.

## Sibling surfaces

- [consumer.mesita.ai](https://consumer.mesita.ai) — diner app (`mesita-web-consumer`)
- [admin.mesita.ai](https://admin.mesita.ai) — super-admin console (`mesita-web-admin`)
- [mesita.ai](https://mesita.ai) — marketing site (`mesita-web-landing`)
