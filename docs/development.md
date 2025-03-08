# Development

## Technologies Used

- [Bun](https://bun.sh/): A fast JavaScript runtime and package manager
- [Hono](https://hono.dev/): A lightweight, fast web framework
- [Cloudflare Workers](https://workers.cloudflare.com/): Serverless JavaScript runtime
- [Cloudflare D1](https://developers.cloudflare.com/d1/): Serverless SQL database
- [Zod](https://zod.dev/): TypeScript-first schema validation
- [OpenAPI/Swagger](https://swagger.io/): API documentation generation
- [Cheerio](https://cheerio.js.org/): HTML parsing for web scraping

## Code Structure

- `src/`: Main application code
  - `index.ts`: Entry point with Hono application setup
  - `models/`: Schema definitions for API data types
  - `routes/`: API endpoint implementations
  - `lib/`: Utility functions and helpers
    - `data-loader.ts`: Functions for D1 database interactions

- `bin/`: Scraper scripts to collect rates data
  - Separate scripts for mortgage, personal loan, car loan, and credit card rates

- `schema.sql`: D1 database schema definition for storing all rate information

## Development Environment

- TypeScript for type safety
- ESLint and Prettier for code quality
- Husky for Git hooks
- Wrangler for local development and deployment to Cloudflare
- D1 database for persistent data storage

## Database Structure

The application uses Cloudflare D1 with the following tables:

1. `historical_data`: Stores snapshots of rates data by date
   - `id`: Auto-incrementing primary key
   - `data_type`: Type of data (mortgage-rates, car-loan-rates, etc.)
   - `date`: ISO format date (YYYY-MM-DD)
   - `data`: JSON string containing the full data snapshot
   - `created_at`: Timestamp when the record was created

2. `latest_data`: Stores the most recent version of each data type
   - `data_type`: Primary key, type of data
   - `data`: JSON string containing the full data
   - `last_updated`: Timestamp of last update

Indexes are created on `data_type` and `date` fields for query performance optimization.