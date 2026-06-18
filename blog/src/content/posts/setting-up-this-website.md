---
title: "Setting Up This Website"
description: "How I migrated raharoho.me from InfinityFree to Cloudflare Pages, scaffolded this blog with Astro, and set up CI/CD with GitHub Actions."
date: 2026-06-18
category: engineering-web-apps
draft: false
---

For a while, my personal site at raharoho.me has been sitting on InfinityFree — a free hosting provider that, while generous, comes with a few annoyances. The biggest one: SSL certificates need manual renewal every three months. Miss the reminder and your site goes down with a certificate error. The other irritation is a JavaScript-based cookie challenge injected on every request, which means web crawlers, link previewers, and automated tools often just see a blank page.

Both of those got old quickly. So this week I finally migrated. Here's what the setup looks like now.

## The monorepo

The site is a single public GitHub repo with two [Astro](https://astro.build) projects:

```
/
├── landing/   → raharoho.me
└── blog/      → blog.raharoho.me (you are here)
```

**Landing page** — a simple personal card. Profile photo, name, title, links. The build output is one `index.html`. Nothing clever, which is the point.

**Blog** — what you're reading now. Astro with [Content Collections](https://docs.astro.build/en/guides/content-collections/) for Markdown posts. Posts live as `.md` files in `src/content/posts/`, and the frontmatter schema is validated by Zod at build time. No more silently broken dates.

Both are deployed to **Cloudflare Pages** on the free tier: global CDN, unlimited bandwidth, 500 builds per month.

## CI/CD

Every pull request gets a preview deployment. The `cloudflare/pages-action` action posts the URL as a comment on the PR automatically — no extra scripting needed. On merge to `main`, both sites go to production.

```yaml
- uses: cloudflare/pages-action@v1
  with:
    projectName: raharoho-blog
    directory: blog/dist
    gitHubToken: ${{ secrets.GITHUB_TOKEN }}  # posts preview URL on the PR
```

The preview workflow only triggers when files under `landing/` or `blog/` actually change, so PRs touching only workflows or docs don't burn build minutes.

## DNS and Terraform

My DNS has been managed via Terraform in a private repo for a while. The migration involved swapping the old InfinityFree A records for CNAME records pointing at Cloudflare Pages' default domains, and adding a redirect rule for `razondz.pp.ua` → `raharoho.me`. Cloudflare's CNAME flattening handles the root domain correctly so no special tricks were needed there.

One thing I ran into: creating a Cloudflare Redirect Rule via Terraform requires the **Zone > Transform Rules > Edit** permission on the API token. The error message just says "request is not authorized", which is not immediately obvious.

## Why Astro

I wanted something that produces plain static HTML, handles Markdown well, and doesn't require me to maintain a runtime. Astro fits. Content Collections in particular are nice — you get a typed schema for frontmatter, and build errors on violations instead of silent runtime surprises.

## What this blog is for

I set up four categories to give myself some structure:

- **Engineering: Web Apps** — web development, systems, things I'm building
- **Engineering: Networking** — infrastructure, the lower layers
- **Traveling** — I'm working through Indonesia
- **Automotive** — I ride a Vespa and I've been eyeing ADV bikes

Not everything here will be technical. That felt important to decide up front.
