# website

Personal website monorepo — [raharoho.me](https://raharoho.me), [blog.raharoho.me](https://blog.raharoho.me), and [islam.raharoho.me](https://islam.raharoho.me).

## Structure

```
/
├── landing/   → raharoho.me         (Astro static site)
├── blog/      → blog.raharoho.me    (Astro + content collections)
└── islam/     → islam.raharoho.me   (Astro PWA: prayer times + Qibla compass)
```

All three are static [Astro](https://astro.build) sites with Tailwind CSS, built and deployed to [Cloudflare Pages](https://pages.cloudflare.com) via GitHub Actions. Each has its own `package.json`.

## Local development

Requires [Bun](https://bun.sh). `cd` into the project first.

```bash
cd landing && bun install && bun run dev
cd blog    && bun install && bun run dev
cd islam   && bun install && bun run dev
```

## Deployment

| Event | Workflow | Result |
|---|---|---|
| Pull request | `preview.yml` | Preview deployment per site + PR comment with URL |
| Push to `main` | `deploy.yml` | Production deployment to Cloudflare Pages |

### Required secrets

| Secret | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | API token with **Cloudflare Pages: Edit** permission |
| `CLOUDFLARE_ACCOUNT_ID` | Found in the Cloudflare dashboard sidebar |

## Writing a blog post

Create a `.md` file in `blog/src/content/posts/`. The filename becomes the URL slug.

```markdown
---
title: "Your Post Title"
description: "A one-sentence summary shown on the index page."
date: 2026-06-23
category: engineering-web-apps
draft: false
---

Post content here. Standard Markdown applies.
```

Set `draft: true` to write without publishing.

### Categories

| Slug | Display label |
|---|---|
| `engineering-web-apps` | Engineering: Web Apps |
| `engineering-networking` | Engineering: Networking |
| `traveling` | Traveling |
| `automotive` | Automotive |

Posts are grouped by category on the index page. To add a new category, extend the enum in `blog/src/content/config.ts` and add the display label to `CATEGORY_LABELS` in the three `blog/src/pages/` files.

## Related repos

- **[islam-push-worker](https://github.com/rahadian-adinugroho/islam-push-worker)** — Cloudflare Worker for the islam PWA's push notifications. Cron every minute.

## AI agent context

See [AGENTS.md](./AGENTS.md) for repo conventions, common tasks, and gotchas — read this first if you're an AI agent.
