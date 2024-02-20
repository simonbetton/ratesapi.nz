<br />
<h1 align="center">
  Rates API
</h1>
<p align="center">
  ✨ <a href="https://ratesapi.nz">https://ratesapi.nz</a> ✨
  <br />
  Rates API is a free service for current rates of financial products in New Zealand.
</p>
<br />

<p align="center">
  <a href="https://opensource.org/licenses/MIT" rel="nofollow"><img src="https://img.shields.io/github/license/decs/typeschema" alt="License"></a>
</p>
<p align="center">
  <a href="#setup">Setup</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="#api">API</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/simonbetton/ratesapi.nz">GitHub</a>
</p>
<br />

This project uses [Bun](https://bun.sh/), [Hono](https://hono.dev/) and [Cloudlfare Workers](https://workers.cloudflare.com/).

Cloudflare Workers is a JavaScript edge runtime on Cloudflare CDN.

You can develop the application locally and publish it with a few commands using [Wrangler](https://developers.cloudflare.com/workers/wrangler/).
Wrangler includes trans compiler, so we can write the code with TypeScript.

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

```zsh
bun run deploy
```

<a id="api"></a>

## API

### GET `/api/mortgage-rates`

Get the current (updated hourly) mortgage rates of institutions in New Zealand.

#### Response

```json
[
  {
    "name": "ANZ",
    "products": [
      {
        "name": "Standard",
        "rates": [
          {
            "term": "Variable floating",
            "rate": 8.64
          },
          {
            "term": "6 months",
            "rate": 7.95
          },
          {
            "term": "1 year",
            "rate": 7.99
          },
          {
            "term": "2 years",
            "rate": 7.49
          },
          ...
        ]
      },
      ...
    }
  ...
]
```

### GET `/api/mortgage-rates/:institution`

Get the current (updated hourly) mortgage rates of a specific institution in New Zealand.

#### Response

```json
{
  "name": "Kiwibank",
  "products": [
    {
      "name": "Standard",
      "rates": [
        {
          "term": "Variable floating",
          "rate": 8.64
        },
        {
          "term": "6 months",
          "rate": 7.95
        },
        {
          "term": "1 year",
          "rate": 7.99
        },
        {
          "term": "2 years",
          "rate": 7.49
        },
        ...
      ]
    },
    ...
  }
}
```
