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
  <a href="#api">API</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/simonbetton/ratesapi.nz">GitHub</a>
</p>
<br />

This project uses [Bun](https://bun.sh/), [Hono](https://hono.dev/) and [Cloudlfare Workers](https://workers.cloudflare.com/).

Cloudflare Workers is a JavaScript edge runtime on Cloudflare CDN.

You can develop the application locally and publish it with a few commands using [Wrangler](https://developers.cloudflare.com/workers/wrangler/).
Wrangler includes trans compiler, so we can write the code with TypeScript.

### Live URL examples

🔗 [https://ratesapi.nz/api/v1/doc](https://ratesapi.nz/api/v1/doc) - OpenAPI specification

🔗 [https://ratesapi.nz/api/v1/mortgage-rates](https://ratesapi.nz/api/v1/mortgage-rates) - List of all mortgage rates by institution

🔗 [https://ratesapi.nz/api/v1/mortgage-rates/anz](https://ratesapi.nz/api/v1/mortgage-rates/anz) - Specific institution mortgage rates

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

### GET `/api/v1/doc`

Get the OpenAPI documentation of the API.

### GET `/api/v1/mortgage-rates`

Get the current (updated hourly) mortgage rates of institutions in New Zealand.

#### Response

```json
{
  "type": "MortgageRates",
  "data": [
    {
      "id": "institution:anz",
      "name": "ANZ",
      "products": [
        {
          "id": "product:anz:standard",
          "name": "Standard",
          "rates": [
            {
              "id": "rate:anz:standard:variable-floating",
              "term": "Variable floating",
              "termInMonths": null,
              "rate": 8.64
            },
            {
              "id": "rate:anz:standard:6-months",
              "term": "6 months",
              "termInMonths": 6,
              "rate": 7.95
            }
            //...
          ]
        }
        //...
      ]
    },
    {
      "id": "institution:asb",
      "name": "ASB",
      "products": [
        {
          "id": "product:asb:standard",
          "name": "Standard",
          "rates": [
            {
              "id": "rate:asb:standard:variable-floating",
              "term": "Variable floating",
              "termInMonths": null,
              "rate": 8.64
            },
            {
              "id": "rate:asb:standard:6-months",
              "term": "6 months",
              "termInMonths": 6,
              "rate": 7.39
            }
            //...
          ]
        }
        //...
      ]
    }
    //...
  ]
}
```

### GET `/api/v1/mortgage-rates/:institution`

Get the current (updated hourly) mortgage rates of a specific institution in New Zealand.

#### Response

```json
{
  "type": "MortgageRates",
  "data": [
    {
      "id": "institution:kiwibank",
      "name": "Kiwibank",
      "products": [
        {
          "id": "product:kiwibank:standard",
          "name": "Standard",
          "rates": [
            {
              "id": "rate:kiwibank:standard:variable-floating",
              "term": "Variable floating",
              "termInMonths": null,
              "rate": 8.5
            },
            {
              "id": "rate:kiwibank:standard:6-months",
              "term": "6 months",
              "termInMonths": 6,
              "rate": 8.39
            },
            {
              "id": "rate:kiwibank:standard:1-year",
              "term": "1 year",
              "termInMonths": 12,
              "rate": 8.35
            }
            //...
          ]
        }
        //...
      ]
    }
    //...
  ]
}
```
