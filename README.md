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
  <a href="#api-endpoints">API Endpoints</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="#monitoring">Monitoring</a>
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

#### 📊 Set up Cloudflare D1 Database

This application uses Cloudflare D1 for data storage. To set up the database:

1. Create a D1 database using the Cloudflare Dashboard or Wrangler CLI:

```zsh
npx wrangler d1 create ratesapi-data
```

2. Update your `wrangler.toml` with the database ID (replace the example.toml file if needed):

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

Check out the available scripts within `./bin` to scrape and save data. The data will be stored both locally and in the D1 database.

To run with D1 database support, provide the database ID:

```zsh
# Replace with your D1 database ID from wrangler.toml
D1_DATABASE_ID="your-database-id" bun run bin/scrape-mortgage-rates.ts
```

Or simply run without D1 database support (files only):

```zsh
bun run bin/scrape-mortgage-rates.ts
```

<a id="api-endpoints"></a>

## API Endpoints

The API exposes the following endpoint categories:

- **Mortgage Rates**: `/api/v1/mortgage-rates`
  - List all mortgage rates
  - Get rates by institution
  - Get historical rates time series

- **Personal Loan Rates**: `/api/v1/personal-loan-rates`
  - List all personal loan rates
  - Get rates by institution
  - Get historical rates time series

- **Car Loan Rates**: `/api/v1/car-loan-rates`
  - List all car loan rates
  - Get rates by institution
  - Get historical rates time series

- **Credit Card Rates**: `/api/v1/credit-card-rates`
  - List all credit card rates
  - Get rates by issuer
  - Get historical rates time series

All endpoints support CORS and return JSON responses with a 5-second cache control.

### API Documentation

- OpenAPI documentation is available at: `/api/v1/doc`
- Swagger UI is available in development mode at the root URL
- Production redirects to: [https://docs.ratesapi.nz](https://docs.ratesapi.nz)

<a id="monitoring"></a>

## Automated Data Collection

Data is collected hourly via GitHub Actions and stored in both:
1. Local JSON files in the repository
2. Cloudflare D1 database for API access

### How Data Collection Works

The automated workflow:
1. Scrapes data from the source websites
2. Validates the data against the schema
3. Stores the data in JSON files in the repository
4. Detects if the data has changed
5. If changes are detected:
   - Uploads the data to the D1 database
   - Commits the changes to the repository

### Required GitHub Secrets

For the automated data collection and database updates to work, you'll need to add the following secrets to your GitHub repository:

1. `D1_DATABASE_ID`: Your Cloudflare D1 database ID (found in wrangler.toml)
2. `CLOUDFLARE_API_TOKEN`: A Cloudflare API token with D1 write permissions
3. `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

To add these secrets:
1. Go to your repository's Settings > Secrets and variables > Actions
2. Click "New repository secret" 
3. Add each secret with its corresponding value

### Data Flow

1. **Scraper Scripts**: Each rate type has a dedicated scraper script that:
   - Loads current data (from D1 in CI environments, from local files in development)
   - Scrapes new data from source websites
   - Compares the data to detect changes
   - Saves data to both the D1 database (in CI environments) and local JSON files
   
2. **API Routes**: The API routes:
   - Load data from the D1 database
   - Apply filters as needed (by institution, term, etc.)
   - Return formatted JSON responses

### Manual Database Update

You can manually update the D1 database from local JSON files in two ways:

1. **Using GitHub Actions**: The easiest approach is to push your changes to GitHub and let the workflow update the database automatically.

2. **Using Wrangler directly**: For manual updates, use the wrangler CLI directly:

```bash
# Replace DATABASE_NAME with your database name from wrangler.toml (e.g. "ratesapi-data")
npx wrangler d1 execute DATABASE_NAME --file=./schema.sql

# Then import data from local JSON files (for each data type)
npx wrangler d1 execute DATABASE_NAME --command="INSERT OR REPLACE INTO latest_data (data_type, data, last_updated) VALUES ('mortgage-rates', '$(cat data/mortgage-rates.json | sed 's/\"/\\"/g')', CURRENT_TIMESTAMP)"
```

This is useful for initial seeding of a new database or manual updates when needed.

### Local Development vs. GitHub Actions

- **Local Development**: 
  - Scripts use local JSON files as the primary data source
  - D1 operations are skipped to avoid connection errors
  - JSON files serve as fallback when database is unavailable

- **GitHub Actions (CI Environment)**:
  - D1 database is used as the primary data source 
  - Updates are made directly to the D1 database
  - JSON files are still maintained for compatibility

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

## Development

### Technologies Used

- [Bun](https://bun.sh/): A fast JavaScript runtime and package manager
- [Hono](https://hono.dev/): A lightweight, fast web framework
- [Cloudflare Workers](https://workers.cloudflare.com/): Serverless JavaScript runtime
- [Cloudflare D1](https://developers.cloudflare.com/d1/): Serverless SQL database
- [Zod](https://zod.dev/): TypeScript-first schema validation
- [OpenAPI/Swagger](https://swagger.io/): API documentation generation
- [Cheerio](https://cheerio.js.org/): HTML parsing for web scraping

### Code Structure

- `src/`: Main application code
  - `index.ts`: Entry point with Hono application setup
  - `models/`: Schema definitions for API data types
  - `routes/`: API endpoint implementations
  - `lib/`: Utility functions and helpers
    - `data-loader.ts`: Functions for D1 database interactions

- `bin/`: Scraper scripts to collect rates data
  - Separate scripts for mortgage, personal loan, car loan, and credit card rates

- `data/`: JSON files containing scraped rate information (also stored in D1)
  - `history/`: Historical snapshots by date

- `schema.sql`: D1 database schema definition

### Development Environment

- TypeScript for type safety
- ESLint and Prettier for code quality
- Husky for Git hooks
- Wrangler for local development and deployment to Cloudflare
- D1 database for persistent data storage

### Database Structure

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
