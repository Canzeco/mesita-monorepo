# apps/web-admin — Mesita admin console

Super-admin console for Mesita — lives at
[admin.mesita.ai](https://admin.mesita.ai).

Next.js 16 app (Tailwind v4, light theme). Sign-in is Google OAuth
gated by the `public.super_admins` allow-list plus MFA. Every read and
write goes through an `admin-*` Edge Function in
[`mesita-supabase`](https://github.com/Canzeco/mesita-supabase) — the
client never touches the database directly.

## Develop

```bash
pnpm install
pnpm dev
```

Deployed automatically by Vercel on push to `main`.

## Sibling surfaces

- [business.mesita.ai](https://business.mesita.ai) — place console (`mesita-web-business`)
- [consumer.mesita.ai](https://consumer.mesita.ai) — diner app (`mesita-web-consumer`)
- [mesita.ai](https://mesita.ai) — marketing site (`mesita-web-landing`)
