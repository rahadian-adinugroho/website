# website

Personal website monorepo — [raharoho.me](https://raharoho.me) and [blog.raharoho.me](https://blog.raharoho.me).

## Structure

```
/
├── landing/   → raharoho.me
└── blog/      → blog.raharoho.me
```

Both are static [Astro](https://astro.build) sites with Tailwind CSS, built and deployed to [Cloudflare Pages](https://pages.cloudflare.com) via GitHub Actions.

## Local development

Requires [Bun](https://bun.sh).

```bash
# Landing
cd landing && bun install && bun run dev

# Blog
cd blog && bun install && bun run dev
```

## Deployment

| Event | Workflow | Result |
|---|---|---|
| Pull request | `preview.yml` | Preview deployment per site + PR comment with URL |
| Push to `main` | `deploy.yml` | Production deployment to Cloudflare Pages |

### Required secrets

Add these to the repository's GitHub Secrets:

| Secret | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | API token with **Cloudflare Pages: Edit** permission |
| `CLOUDFLARE_ACCOUNT_ID` | Found in the Cloudflare dashboard sidebar |
