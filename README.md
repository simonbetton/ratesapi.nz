<br />
<h1 align="center">
  Rates API
</h1>
<p align="center">
  ✨ <a href="https://ratesapi.nz">https://ratesapi.nz</a> ✨
  <br />
  Rates API is a free OpenAPI service to retrieve the latest lending rates offered by New Zealand financial institutions – updated hourly.
</p>
<br />

<p align="center">
  <a href="https://opensource.org/licenses/MIT" rel="nofollow"><img src="https://img.shields.io/github/license/decs/typeschema" alt="License"></a>
</p>
<p align="center">
  <a href="#setup">Setup</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="#monitoring">Monitoring</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/simonbetton/ratesapi.nz">GitHub</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://docs.ratesapi.nz">Documentation</a>
</p>
<br />

This project uses [Bun](https://bun.sh/), [Hono](https://hono.dev/) and [Cloudlfare Workers](https://workers.cloudflare.com/).

Cloudflare Workers is a JavaScript edge runtime on Cloudflare CDN.

You can develop the application locally and publish it with a few commands using [Wrangler](https://developers.cloudflare.com/workers/wrangler/).
Wrangler includes a transcompiler, so we can write directly in TypeScript.

<a id="setup"></a>

## Setup

#### 📦 Install dependencies

```zsh
bun i
```

#### 🏗️ Run locally

Run the development server locally. Then, access `http://localhost:8787` in your web browser.

```zsh
bun run dev
```

#### 🚀 Deploy to Cloudflare Workers

First, create your worker via the Cloudflare dashboard by following these steps:

- Log in to the Cloudflare dashboard and select your account.
- Select Workers & Pages > Create application.
- Select Create Worker > Deploy.

Then, deploy the worker using the following command:

```zsh
bun run deploy
```

#### 🔩 Scrape data

Check out the available scripts within `./bin` to scrape and save data.

e.g.

```zsh
bun run bin/scrape-mortgage-rates.ts
```

<a id="monitoring"></a>

## Monitoring

API uptime is monitored every 15 minutes via GitHub Actions. The workflow checks the health of all endpoints and alerts through GitHub Issues:

1. Creates a new issue when endpoints are down
2. Mentions repository owner to trigger a notification
3. Labels issues as "incident" and "high-priority"
4. Includes detailed information about failed endpoints

The following endpoints are monitored:
- API Root
- Mortgage rates (list and by institution)
- Personal loan rates (list and by institution)
- Car loan rates (list and by institution)
- Credit card rates (list and by issuer)
- API documentation

### GitHub Notifications
The notification system uses GitHub's built-in @mentions to alert team members. Users will receive notifications according to their GitHub notification preferences (email, web, mobile).

To ensure you receive timely alerts:
1. Check your GitHub notification settings at https://github.com/settings/notifications
2. Enable notifications for "Issues" activity
3. Configure your preferred notification method (web, email, mobile)

### Required Permissions
The GitHub Action requires specific permissions to create issues and add labels. These permissions are already configured in the workflow file:

```yaml
# Required permissions for creating issues and using labels
permissions:
  issues: write
  contents: read
```

If you're using an organization with restricted permissions, ensure that:

1. The repository settings allow GitHub Actions to create issues
   - Go to repository Settings > Actions > General
   - Under "Workflow permissions", select "Read and write permissions"
   - Check "Allow GitHub Actions to create and approve pull requests"
   - Click "Save"

2. Create the required labels in your repository:
   - Go to repository Issues > Labels
   - Create "incident" and "high-priority" labels if they don't exist
