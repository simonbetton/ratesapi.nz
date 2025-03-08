# Automated Data Collection

Data is collected hourly via GitHub Actions and stored in the Cloudflare D1 database for API access.

## How Data Collection Works

The automated workflow:
1. Scrapes data from the source websites
2. Validates the data against the schema
3. Detects if the data has changed
4. If changes are detected:
   - Stores the data in the D1 database
   - Commits the workflow changes to the repository

## Required GitHub Secrets

For the automated data collection and database updates to work, you'll need to add the following secrets to your GitHub repository:

1. `CLOUDFLARE_API_TOKEN`: A Cloudflare API token with D1 write permissions
2. `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

To add these secrets:
1. Go to your repository's Settings > Secrets and variables > Actions
2. Click "New repository secret" 
3. Add each secret with its corresponding value

## Data Flow

1. **Scraper Scripts**: Each rate type has a dedicated scraper script that:
   - Loads current data from the D1 database
   - Scrapes new data from source websites
   - Compares the data to detect changes
   - Saves data to the D1 database when changes are detected
   
2. **API Routes**: The API routes:
   - Load data from the D1 database
   - Apply filters as needed (by institution, term, etc.)
   - Return formatted JSON responses

## Manual Database Update

You can manually update the D1 database in two ways:

1. **Using GitHub Actions**: The easiest approach is to push your changes to GitHub and let the workflow update the database automatically.

2. **Using Wrangler directly**: For manual updates, use the wrangler CLI directly:

```bash
# Replace DATABASE_NAME with your database name from wrangler.toml (e.g. "ratesapi-data")
npx wrangler d1 execute DATABASE_NAME --file=./schema.sql

# Then run the scraper scripts with D1_DATABASE_NAME set
D1_DATABASE_name="your-database-name" bun run bin/scrape-mortgage-rates.ts
```

This is useful for initial seeding of a new database or manual updates when needed.

## Local Development vs. GitHub Actions

- **Local Development**: 
  - Scripts display scraped data but don't store it without D1_DATABASE_NAME
  - D1 operations are skipped to avoid connection errors when no database name is provided

- **GitHub Actions (CI Environment)**:
  - D1 database is used as the exclusive data source 
  - Updates are made directly to the D1 database
  - All data storage operations are performed on D1