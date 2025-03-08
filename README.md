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
  <a href="docs/setup.md">Setup</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="docs/api-endpoints.md">API Endpoints</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="docs/monitoring.md">Monitoring</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/simonbetton/ratesapi.nz">GitHub</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://docs.ratesapi.nz">Documentation</a>
</p>
<br />

This project uses [Bun](https://bun.sh/), [Hono](https://hono.dev/), [Cloudlfare Workers](https://workers.cloudflare.com/), and [Cloudflare D1](https://developers.cloudflare.com/d1/).

Cloudflare Workers is a JavaScript edge runtime on Cloudflare CDN, while D1 is Cloudflare's serverless SQL database that integrates seamlessly with Workers.

You can develop the application locally and publish it with a few commands using [Wrangler](https://developers.cloudflare.com/workers/wrangler/).
Wrangler includes a transcompiler, so we can write directly in TypeScript.

## Documentation

- [Setup and Installation](docs/setup.md)
- [API Endpoints](docs/api-endpoints.md)
- [Automated Data Collection](docs/data-collection.md)
- [Monitoring](docs/monitoring.md)
- [Development](docs/development.md)

## Quick Start

```zsh
# Install dependencies
bun i

# Run locally
bun run dev

# Deploy to Cloudflare Workers
bun run deploy
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.