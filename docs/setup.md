# Setup

## 📦 Install dependencies

```zsh
bun i
```

## 🏗️ Run locally

Run the development server locally. Then, access `http://localhost:8787` in your web browser.

```zsh
bun run dev
```

## 📊 Set up Cloudflare D1 Database

This application uses Cloudflare D1 for data storage. To set up the database:

1. Create a D1 database using the Cloudflare Dashboard or Wrangler CLI:

```zsh
npx wrangler d1 create ratesapi-data
```

2. Update your `wrangler.toml` with the database ID (replace the wrangler.toml file to suit):

```toml
[[d1_databases]]
binding = "RATESAPI_DB"
database_name = "ratesapi-data"
database_id = "your-database-id-here"
```

3. Create database tables using the schema:

```zsh
npx wrangler d1 execute ratesapi-data --file=schema.sql
```

For development environment:

```zsh
npx wrangler d1 execute ratesapi-data --file=schema.sql --env=development
```

## 🚀 Deploy to Cloudflare Workers

First, create your worker via the Cloudflare dashboard by following these steps:

- Log in to the Cloudflare dashboard and select your account.
- Select Workers & Pages > Create application.
- Select Create Worker > Deploy.

Then, deploy the worker using the following command:

```zsh
bun run deploy
```

## 🔩 Scrape data

Check out the available scripts within `./bin` to scrape and save data. The data is stored in the D1 database.

To run with D1 database support, provide the database ID:

```zsh
# Replace with your D1 database ID from wrangler.toml
D1_DATABASE_NAME="your-database-name" bun run bin/scrape-mortgage-rates.ts
```

When running without a D1 database ID, the scripts will not store data but will still show what would be scraped:

```zsh
bun run bin/scrape-mortgage-rates.ts
```