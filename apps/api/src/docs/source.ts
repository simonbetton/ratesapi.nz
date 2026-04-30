import { llms, loader, source } from "fumadocs-core/source";

export type DocsPageData = {
  title: string;
  description?: string;
  markdown: string;
  endpoint?: {
    method: "GET";
    path: string;
    operationId: string;
    parameters?: string[];
    responses: string[];
  };
};

const introduction = {
  title: "Introduction",
  description:
    "Rates API is a comprehensive and up-to-date service for the latest lending rates from New Zealand's leading financial institutions.",
  markdown: `Rates API is a comprehensive and up-to-date service designed to provide you with the latest lending rates from New Zealand's leading financial institutions. This API is updated hourly, ensuring you have access to the most current information available to make informed decisions.

## Features

- Comprehensive Data: Access a wide range of data including mortgage rates, personal and car loan rates, and credit card rates from top New Zealand banks and financial institutions.
- Historical Time Series: Retrieve historical rate data with our time series endpoints to analyze trends and changes over time.
- Hourly Updates: Our data is updated hourly, offering you the latest rates to ensure your decisions are based on the most current information.
- Cloudflare D1 Database: Enhanced data storage using Cloudflare D1 for improved performance and better management of historical datasets.
- Easy Integration: Designed with simplicity in mind, our API provides a straightforward integration process, allowing you to start retrieving data with minimal setup.
- Free Access: Rates API is a free service, providing valuable financial information without any cost.
- OpenAPI Specification: Built on OpenAPI 3.1.0, ensuring well-documented and standardized interfaces for developers.

## Use Cases

- All-in-One Comparison Platforms: Build comprehensive financial product comparison tools that empower consumers to evaluate options across mortgages, personal loans, car loans, and credit cards all in one place with real-time rates.
- Personalized Financial Recommendation Engines: Create sophisticated algorithms that match users with financial products based on their specific needs, credit profile, and goals, using current market rates to provide accurate recommendations.
- Real Estate and Property Technology: Enhance property listings with integrated mortgage calculators and up-to-date lending rates, helping potential buyers understand true affordability and see financing options alongside properties.
- Intelligent Financial Planning Applications: Power next-generation budgeting and financial planning tools that incorporate real lending rates to provide more accurate debt reduction strategies, refinancing opportunities, and long-term planning scenarios.
- Market Intelligence Dashboards: Develop professional-grade analytics platforms that track lending rate trends across the New Zealand market, identifying patterns, predicting movements, and providing valuable insights for both consumers and financial professionals.
- Historical Analysis and Forecasting: Use time series data to analyze interest rate trends over time, identify patterns, and develop forecasting models for future rate movements.

## Getting Started

To begin using the Rates API, familiarize yourself with the endpoints and data structures. The API is built on the OpenAPI 3.1.0 specification, ensuring a standardized and well-documented interface for developers.

### Base URLs

- Production: \`https://ratesapi.nz\`
- Local Development: \`http://localhost:8787\`

### Available Endpoints

| Category | List Endpoint | Get By ID | Time Series |
| --- | --- | --- | --- |
| Mortgage Rates | \`GET /api/v1/mortgage-rates\` | \`GET /api/v1/mortgage-rates/{institutionId}\` | \`GET /api/v1/mortgage-rates/time-series\` |
| Personal Loan Rates | \`GET /api/v1/personal-loan-rates\` | \`GET /api/v1/personal-loan-rates/{institutionId}\` | \`GET /api/v1/personal-loan-rates/time-series\` |
| Car Loan Rates | \`GET /api/v1/car-loan-rates\` | \`GET /api/v1/car-loan-rates/{institutionId}\` | \`GET /api/v1/car-loan-rates/time-series\` |
| Credit Card Rates | \`GET /api/v1/credit-card-rates\` | \`GET /api/v1/credit-card-rates/{issuerId}\` | \`GET /api/v1/credit-card-rates/time-series\` |

Each endpoint provides detailed information about the rates offered by various institutions, including specific products and terms. All data is returned in JSON format.

#### Time Series Parameters

| Parameter | Description |
| --- | --- |
| \`date\` | Date in YYYY-MM-DD format for a single historical snapshot |
| \`startDate\` | Start date in YYYY-MM-DD format for a time series range |
| \`endDate\` | End date in YYYY-MM-DD format for a time series range |
| \`institutionId\` | Filter results by a specific institution ID |
| \`issuerId\` | Filter credit card results by a specific issuer ID |
| \`termInMonths\` | Filter mortgage results by term length |

### Authentication

Currently, the Rates API is a free service and does not require authentication. The API will ensure backward compatibility if authentication is introduced in the future.

## Support

If you encounter any issues or have feature requests, please [create a GitHub issue](https://github.com/simonbetton/ratesapi.nz/issues).

Thank you for choosing Rates API as your source for financial data. We look forward to supporting your applications and services.`,
} satisfies DocsPageData;

const endpointPages: DocsPageData[] = [
  {
    title: "List Car Loan Rates",
    markdown: `This endpoint returns a comprehensive list of car loan rates from most financial institutions in New Zealand. The data includes interest rates, loan terms, and any special conditions or features offered with each car loan product.

## Response Data

- Institution name and standardised ID
- Interest rates (advertised and comparison rates)
- Loan terms
- Special features and conditions
- Secured and unsecured loan options

## Use Cases

- Car Buying Applications: Help users compare financing options directly within car shopping apps
- Rate Comparison Tools: Create tools that help consumers find the lowest interest rates for their vehicle purchases
- Financial Planning: Integrate real-time car loan data into budgeting and financial planning applications
- Auto Dealer Websites: Display current financing options from multiple lenders on dealer websites`,
    endpoint: {
      method: "GET",
      operationId: "listCarLoanRates",
      path: "/api/v1/car-loan-rates",
      responses: ["200: Retrieve all car loan rates", "500: Server error"],
    },
  },
  {
    title: "Get Car Loan Rates By Institution ID",
    markdown:
      "Retrieve car loan rates for a specific New Zealand financial institution.",
    endpoint: {
      method: "GET",
      operationId: "getCarLoanRatesByInstitution",
      parameters: [
        "institutionId: institution identifier, e.g. institution:asb",
      ],
      path: "/api/v1/car-loan-rates/{institutionId}",
      responses: [
        "200: Retrieve car loan rates for the institution",
        "404: Institution not found",
        "500: Server error",
      ],
    },
  },
  {
    title: "Car Loan Rates Time Series",
    description:
      "Retrieve historical time series data for car loan rates from New Zealand financial institutions.",
    markdown: `This endpoint provides historical time series data for car loan rates, allowing you to analyze trends and changes over time. The data is stored in Cloudflare D1 database, enabling efficient querying of historical datasets.

## Response Data

- Timestamp for each data point
- Institution name and ID
- Interest rates for new and used vehicles
- Fixed and variable rate options
- Special rates for specific vehicle types, such as electric vehicles
- Minimum and maximum loan amounts
- Available loan terms
- Any promotional offers or special conditions

## Use Cases

- Auto Finance Trend Analysis: Track how car loan rates change over time and across institutions
- Vehicle Purchase Planning: Help buyers understand the best time to finance vehicle purchases
- Dealer Financing Comparison: Compare dealership financing offers with historical bank rates
- EV Incentive Tracking: Monitor special financing rates for electric vehicles
- Market Seasonality Studies: Identify patterns in seasonal financing offers and promotions

## Notes on Data Storage

The time series data is stored in Cloudflare D1, a serverless SQL database built on SQLite. This allows for efficient querying, fast retrieval, reliable persistence, and scalable performance for growing historical datasets.`,
    endpoint: {
      method: "GET",
      operationId: "getCarLoanRatesTimeSeries",
      parameters: [
        "date: optional single date in YYYY-MM-DD format",
        "startDate: optional range start date in YYYY-MM-DD format",
        "endDate: optional range end date in YYYY-MM-DD format",
        "institutionId: optional institution ID filter",
      ],
      path: "/api/v1/car-loan-rates/time-series",
      responses: [
        "200: Retrieve car loan rates time series data",
        "400: Invalid date parameters",
        "404: No data found",
        "500: Server error",
      ],
    },
  },
  {
    title: "List Credit Card Rates",
    markdown: `This endpoint returns a comprehensive list of credit card rates and offers from most financial institutions and issuers in New Zealand. The data includes interest rates, reward programs, fees, and special promotional offers for various credit card products.

## Response Data

- Institution/issuer name and ID
- Purchase interest rates
- Cash advance rates
- Balance transfer rates and promotional offers
- Reward program details
- Interest-free days

## Use Cases

- Credit Card Comparison Tools: Help users find the best credit card rates and rewards based on their spending habits
- Financial Advice Applications: Integrate credit card data into holistic financial planning tools
- Rewards Optimization: Build applications that help users maximize credit card rewards
- Balance Transfer Calculators: Create tools to help users find the best balance transfer offers
- Spending Analysis: Integrate credit card features with spending tracking applications`,
    endpoint: {
      method: "GET",
      operationId: "listCreditCardRates",
      path: "/api/v1/credit-card-rates",
      responses: ["200: Retrieve all credit card rates", "500: Server error"],
    },
  },
  {
    title: "Get Credit Card Rates by Issuer",
    markdown: "Retrieve credit card rates for a specific issuer.",
    endpoint: {
      method: "GET",
      operationId: "getCreditCardRatesIssuer",
      parameters: ["issuerId: issuer identifier, e.g. issuer:amex"],
      path: "/api/v1/credit-card-rates/{issuerId}",
      responses: [
        "200: Retrieve credit card rates for the issuer",
        "404: Issuer not found",
        "500: Server error",
      ],
    },
  },
  {
    title: "Credit Card Rates Time Series",
    description:
      "Retrieve historical time series data for credit card rates from New Zealand financial institutions.",
    markdown: `This endpoint provides historical time series data for credit card rates, allowing you to analyze trends and changes over time. The data is stored in Cloudflare D1 database, enabling efficient querying of historical datasets.

## Response Data

- Timestamp for each data point
- Institution name and ID
- Purchase interest rates
- Cash advance rates
- Balance transfer rates and promotional periods
- Annual fees
- Reward program details
- Minimum credit limits
- Special features and benefits

## Use Cases

- Credit Card Rate Tracking: Monitor how credit card interest rates change over time
- Promotional Offer Analysis: Track balance transfer and introductory rate offers across institutions
- Fee Structure Comparison: Analyze changes in annual fees and fee structures over time
- Market Competition Studies: Identify competitive trends and market responses in the credit card space
- Consumer Education Tools: Provide historical context for current credit card offerings

## Notes on Data Storage

The time series data is stored in Cloudflare D1, a serverless SQL database built on SQLite. This allows for efficient querying, fast retrieval, reliable persistence, and scalable performance for growing historical datasets.`,
    endpoint: {
      method: "GET",
      operationId: "getCreditCardRatesTimeSeries",
      parameters: [
        "date: optional single date in YYYY-MM-DD format",
        "startDate: optional range start date in YYYY-MM-DD format",
        "endDate: optional range end date in YYYY-MM-DD format",
        "issuerId: optional issuer ID filter",
      ],
      path: "/api/v1/credit-card-rates/time-series",
      responses: [
        "200: Retrieve credit card rates time series data",
        "400: Invalid date parameters",
        "404: No data found",
        "500: Server error",
      ],
    },
  },
  {
    title: "List Mortgage Rates",
    markdown: `This endpoint returns a comprehensive list of mortgage rates from most financial institutions in New Zealand. The data includes interest rates, loan terms, and special conditions for various mortgage products including fixed and floating rate options.

## Response Data

- Institution name and ID
- Interest rates for different term periods (6 months, 1 year, 2 years, etc.)
- Floating/variable rates
- Special rates and promotional offers
- Loan-to-value ratio requirements

## Use Cases

- Mortgage Comparison Sites: Build tools to help home buyers find the best mortgage rates across all NZ lenders
- Real Estate Applications: Integrate current mortgage rates into property listing platforms
- Financial Calculators: Power mortgage calculators with real-time interest rate data
- Market Analysis: Track and analyze mortgage rate trends across the New Zealand market`,
    endpoint: {
      method: "GET",
      operationId: "listMortgageRates",
      parameters: ["termInMonths: optional mortgage term filter"],
      path: "/api/v1/mortgage-rates",
      responses: ["200: Retrieve all mortgage rates", "500: Server error"],
    },
  },
  {
    title: "Get Mortgage Rates by Institution ID",
    markdown: "Retrieve mortgage rates for a specific institution.",
    endpoint: {
      method: "GET",
      operationId: "getMortgageRatesByInstitution",
      parameters: [
        "institutionId: institution identifier, e.g. institution:anz",
        "termInMonths: optional mortgage term filter",
      ],
      path: "/api/v1/mortgage-rates/{institutionId}",
      responses: [
        "200: Retrieve mortgage rates for the institution",
        "404: Institution not found",
        "500: Server error",
      ],
    },
  },
  {
    title: "Mortgage Rates Time Series",
    description:
      "Retrieve historical time series data for mortgage rates from New Zealand financial institutions.",
    markdown: `This endpoint provides historical time series data for mortgage rates, allowing you to analyze trends and changes over time. The data is stored in Cloudflare D1 database, enabling efficient querying of historical datasets.

## Response Data

- Timestamp for each data point
- Institution name and ID
- Interest rates for different term periods (6 months, 1 year, 2 years, etc.)
- Floating/variable rates
- Special rates and promotional offers
- Loan-to-value ratio requirements

## Use Cases

- Historical Analysis: Track how mortgage rates have changed over time to identify trends and patterns
- Comparative Studies: Compare rate changes across different institutions to identify competitive offerings
- Economic Research: Correlate interest rate changes with wider economic indicators
- Predictive Modeling: Develop forecasting models based on historical rate movements
- Visualization Tools: Create interactive charts and graphs showing rate trends over time

## Notes on Data Storage

The time series data is stored in Cloudflare D1, a serverless SQL database built on SQLite. This allows for efficient querying, fast retrieval, reliable persistence, and scalable performance for growing historical datasets.`,
    endpoint: {
      method: "GET",
      operationId: "getMortgageRatesTimeSeries",
      parameters: [
        "date: optional single date in YYYY-MM-DD format",
        "startDate: optional range start date in YYYY-MM-DD format",
        "endDate: optional range end date in YYYY-MM-DD format",
        "institutionId: optional institution ID filter",
        "termInMonths: optional mortgage term filter",
      ],
      path: "/api/v1/mortgage-rates/time-series",
      responses: [
        "200: Retrieve mortgage rates time series data",
        "500: Server error",
      ],
    },
  },
  {
    title: "Get Personal Loan Rates",
    markdown: `This endpoint returns a comprehensive list of personal loan rates from most financial institutions in New Zealand. The data includes interest rates, loan terms, and special conditions for various personal loan products including secured and unsecured options.

## Response Data

- Institution name and ID
- Interest rates (advertised and comparison rates)
- Loan terms (minimum and maximum duration)
- Secured and unsecured loan options
- Fees and charges
- Special features and eligibility criteria

## Use Cases

- Loan Comparison Platforms: Create tools that help consumers find the most competitive personal loan rates
- Budgeting Applications: Integrate real-time loan data into financial planning and budgeting tools
- Debt Consolidation Tools: Help users find the best rates for consolidating existing debts
- FinTech Solutions: Power lending marketplaces with current personal loan options`,
    endpoint: {
      method: "GET",
      operationId: "listPersonalLoanRates",
      path: "/api/v1/personal-loan-rates",
      responses: ["200: Retrieve all personal loan rates", "500: Server error"],
    },
  },
  {
    title: "Get Personal Loan Rates by Institution ID",
    markdown: "Retrieve personal loan rates for a specific institution.",
    endpoint: {
      method: "GET",
      operationId: "getPersonalLoanRatesByInstitution",
      parameters: [
        "institutionId: institution identifier, e.g. institution:anz",
      ],
      path: "/api/v1/personal-loan-rates/{institutionId}",
      responses: [
        "200: Retrieve personal loan rates for the institution",
        "404: Institution not found",
        "500: Server error",
      ],
    },
  },
  {
    title: "Personal Loan Rates Time Series",
    description:
      "Retrieve historical time series data for personal loan rates from New Zealand financial institutions.",
    markdown: `This endpoint provides historical time series data for personal loan rates, allowing you to analyze trends and changes over time. The data is stored in Cloudflare D1 database, enabling efficient querying of historical datasets.

## Response Data

- Timestamp for each data point
- Institution name and ID
- Interest rates for secured and unsecured personal loans
- Fixed and variable rate options
- Minimum and maximum loan amounts
- Available loan terms
- Any special conditions or promotions

## Use Cases

- Rate Trend Analysis: Monitor how personal loan rates fluctuate over time
- Competitive Intelligence: Compare rate changes across different lenders
- Consumer Education: Provide historical context for current personal loan offerings
- Financial Planning Tools: Incorporate historical rate data into loan calculators and planning applications
- Research and Reporting: Support academic or market research with reliable historical data

## Notes on Data Storage

The time series data is stored in Cloudflare D1, a serverless SQL database built on SQLite. This allows for efficient querying, fast retrieval, reliable persistence, and scalable performance for growing historical datasets.`,
    endpoint: {
      method: "GET",
      operationId: "getPersonalLoanRatesTimeSeries",
      parameters: [
        "date: optional single date in YYYY-MM-DD format",
        "startDate: optional range start date in YYYY-MM-DD format",
        "endDate: optional range end date in YYYY-MM-DD format",
        "institutionId: optional institution ID filter",
      ],
      path: "/api/v1/personal-loan-rates/time-series",
      responses: [
        "200: Retrieve personal loan rates time series data",
        "400: Invalid date parameters",
        "404: No data found",
        "500: Server error",
      ],
    },
  },
];

const openSourcePages = {
  index: {
    title: "Open Source",
    description:
      "Rates API is proudly open source, hosted on GitHub and built with modern web technologies.",
    markdown: `Rates API is an open source project that provides up-to-date lending rates from New Zealand financial institutions. The entire codebase is available on GitHub at [github.com/simonbetton/ratesapi.nz](https://github.com/simonbetton/ratesapi.nz), allowing anyone to contribute, customize, or deploy their own instance.

## Why Open Source?

We believe in the power of open source to:

- Promote Transparency: Open code means anyone can see how the data is collected and processed
- Encourage Collaboration: Developers can contribute improvements and new features
- Ensure Longevity: The project is not dependent on a single maintainer
- Enable Customization: Fork the project to create specialized versions for specific needs
- Support Education: Serve as a learning resource for developers interested in financial data or Cloudflare Workers

## Technology Stack

Rates API is built with modern web technologies:

- Bun: A fast JavaScript runtime and package manager
- Elysia: A lightweight, fast web framework
- Cloudflare Workers: Serverless JavaScript runtime on Cloudflare CDN
- Cloudflare D1: Serverless SQL database for data storage
- TypeScript: For type-safe development
- TypeBox: Runtime schema definitions and validation
- OpenAPI: API documentation generation
- Cheerio: HTML parsing for web scraping
- GitHub Actions: For monitoring and automation

This stack ensures high performance, global distribution, and excellent developer experience with reliable data persistence.

## Repository Structure

- \`apps/api/src/\`: API Worker application code
- \`apps/api/src/index.ts\`: Worker entry point
- \`apps/api/src/models/\`: Schema definitions for API data types
- \`apps/api/src/routes/\`: API endpoint implementations
- \`apps/api/src/lib/\`: Utility functions and helpers
- \`apps/api/bin/\`: Scraper scripts to collect rates data
- \`docs/\`: Project documentation

## Getting Started

1. Visit the [GitHub repository](https://github.com/simonbetton/ratesapi.nz)
2. Follow the setup instructions in the [Local Development](/open-source/local-development) guide
3. Check out the [Deployment](/open-source/deployment) guide to deploy your own instance`,
  },
  "local-development": {
    title: "Local Development",
    description:
      "Set up a local development environment for Rates API and start contributing to the project.",
    markdown: `This guide will help you set up a local development environment for Rates API, allowing you to make changes, test new features, and contribute to the project.

## Prerequisites

- [Bun](https://bun.sh/): The JavaScript runtime and package manager used by the project
- Git: For version control
- A text editor or IDE such as VS Code or WebStorm

## Getting Started

### 1. Clone the Repository

\`\`\`bash
git clone https://github.com/simonbetton/ratesapi.nz.git
cd ratesapi.nz
\`\`\`

### 2. Install Dependencies

\`\`\`bash
bun i
\`\`\`

### 3. Run the Development Server

\`\`\`bash
bun run dev
\`\`\`

This starts the server at \`http://localhost:8787\`.

## Scraping Data

The project includes scripts to scrape rate data from financial institution websites. These scripts are located in the \`apps/api/bin/\` directory.

\`\`\`bash
bun run apps/api/bin/scrape-mortgage-rates.ts
\`\`\`

Available scraper scripts:

- \`scrape-mortgage-rates.ts\`: Fetches current mortgage rates
- \`scrape-personal-loan-rates.ts\`: Fetches personal loan rates
- \`scrape-car-loan-rates.ts\`: Fetches car loan rates
- \`scrape-credit-card-rates.ts\`: Fetches credit card rates

## Cloudflare D1 Database

The project uses Cloudflare D1, a serverless SQL database built on SQLite, for current and historical rate data.

### Local Development with D1

\`\`\`bash
# Install Wrangler CLI if not already installed
npm install -g wrangler

# Create a local D1 database
wrangler d1 create ratesapi-data-local
\`\`\`

## Development Tips

- Add a new endpoint: Create a new route handler in \`apps/api/src/routes/\`
- Update data models: Modify schemas in \`apps/api/src/models/\`
- Enhance scrapers: Modify the scraper scripts in \`apps/api/bin/\`
- Before submitting changes, test affected endpoints locally and ensure the project builds without errors`,
  },
  deployment: {
    title: "Deployment",
    description:
      "Learn how to deploy Rates API to Cloudflare Workers for production use.",
    markdown: `Rates API is designed to be deployed to Cloudflare Workers, a serverless platform that offers global distribution, high performance, and excellent scalability. The API also uses Cloudflare D1 for data storage.

## Prerequisites

1. A [Cloudflare account](https://dash.cloudflare.com/sign-up)
2. The project set up for local development
3. [Bun](https://bun.sh/) installed
4. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) for Cloudflare Workers and D1 management

## Deployment Steps

### 1. Create a Cloudflare Worker

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/)
2. Select your account
3. Go to Workers & Pages > Create application
4. Select Create Worker > Deploy

### 2. Set Up Cloudflare D1 Database

1. In the Cloudflare dashboard, go to Workers & Pages > D1
2. Click Create database
3. Give your database a name such as \`ratesapi-data\`
4. Select a location close to your target audience

\`\`\`bash
wrangler login
wrangler d1 execute ratesapi-data --file=./apps/api/schema.sql
\`\`\`

### 3. Configure Wrangler

The \`apps/api/wrangler.toml\` file controls API Worker deployment and D1 bindings.

\`\`\`toml
name = "rates-api"
main = "src/index.ts" # relative to apps/api/wrangler.toml
compatibility_date = "2025-06-01"

[[d1_databases]]
binding = "RATESAPI_DB"
database_name = "ratesapi-data"
database_id = "your-database-id-from-cloudflare"
\`\`\`

### 4. Deploy the Worker

\`\`\`bash
bun run deploy
\`\`\`

## Post-Deployment Setup

### Data Updates

The API requires regular updates to financial rate data. Options include manual scraper runs, scheduled workflows, or Cloudflare Cron Triggers.

### Monitoring

The repository includes a monitoring system that uses GitHub Actions to check endpoint health and create issues when endpoints are down.

### Custom Domain

In the Cloudflare dashboard, go to Workers & Pages, select your worker, then use Triggers > Custom Domains to add your domain.

## Production Considerations

- Caching: Adjust cache times based on freshness and performance needs.
- Rate Limiting: Consider rate limiting if traffic is high or abuse prevention is needed.
- Documentation: Keep the docs app aligned with API changes.`,
  },
  monitoring: {
    title: "Monitoring",
    description:
      "Learn how the Rates API monitoring system works to ensure reliability and uptime.",
    markdown: `Rates API includes a robust monitoring system that continuously checks the health of all endpoints. This system uses GitHub Actions to run automated checks every 15 minutes and alert developers when issues are detected.

## How Monitoring Works

1. Runs every 15 minutes via GitHub Actions
2. Checks the health of all API endpoints
3. Creates a GitHub Issue when problems are detected
4. Notifies the repository owner through GitHub's notification system

## Monitored Endpoints

- API Root: The main API endpoint
- Mortgage Rates: Both list and by-institution endpoints
- Personal Loan Rates: Both list and by-institution endpoints
- Car Loan Rates: Both list and by-institution endpoints
- Credit Card Rates: Both list and by-issuer endpoints
- Time Series Endpoints: Historical data for all rate types
- API Documentation: The OpenAPI documentation endpoint

## Alert System

When an endpoint fails, the monitoring system creates a GitHub Issue, labels it as \`incident\` and \`high-priority\`, mentions the repository owner, and provides details about which endpoints failed and why.

## Required Permissions

\`\`\`yaml
permissions:
  issues: write
  contents: read
\`\`\`

If using an organization with restricted permissions, ensure repository settings allow GitHub Actions to create issues and create the required \`incident\` and \`high-priority\` labels.

## Extending the Monitoring System

- Add new endpoints to the monitoring workflow
- Implement more detailed health checks
- Set up additional notification channels, such as Slack, Discord, or email
- Configure custom alerting thresholds or criteria`,
  },
} satisfies Record<
  "deployment" | "index" | "local-development" | "monitoring",
  DocsPageData
>;

const endpointSlugs = [
  "car-loan-rates/list",
  "car-loan-rates/get",
  "car-loan-rates/time-series",
  "credit-card-rates/list",
  "credit-card-rates/get",
  "credit-card-rates/time-series",
  "mortgage-rates/list",
  "mortgage-rates/get",
  "mortgage-rates/time-series",
  "personal-loan-rates/list",
  "personal-loan-rates/get",
  "personal-loan-rates/time-series",
] as const;

const endpointEntries = endpointSlugs.map((slug, index) => ({
  slug,
  data: getEndpointPage(index),
}));

const endpointGroups = [
  ["mortgage-rates", "Mortgage Rates"],
  ["personal-loan-rates", "Personal Loan Rates"],
  ["car-loan-rates", "Car Loan Rates"],
  ["credit-card-rates", "Credit Card Rates"],
] as const;

export const docsRoutes = [
  "/",
  "/api-reference",
  "/api-reference/introduction",
  ...endpointEntries.map(({ slug }) => `/api-reference/endpoint/${slug}`),
  "/open-source",
  "/open-source/local-development",
  "/open-source/deployment",
  "/open-source/monitoring",
];

const docsStaticSource = source<
  DocsPageData,
  { title: string; pages: string[] }
>({
  pages: [
    {
      type: "page",
      path: "index.mdx",
      slugs: [],
      data: introduction,
    },
    {
      type: "page",
      path: "api-reference/index.mdx",
      slugs: ["api-reference"],
      data: introduction,
    },
    {
      type: "page",
      path: "api-reference/introduction.mdx",
      slugs: ["api-reference", "introduction"],
      data: introduction,
    },
    ...endpointEntries.map(({ data, slug }) => ({
      type: "page" as const,
      path: `api-reference/endpoint/${slug}.mdx`,
      slugs: ["api-reference", "endpoint", ...slug.split("/")],
      data,
    })),
    {
      type: "page",
      path: "open-source/index.mdx",
      slugs: ["open-source"],
      data: getOpenSourcePage("index"),
    },
    {
      type: "page",
      path: "open-source/local-development.mdx",
      slugs: ["open-source", "local-development"],
      data: getOpenSourcePage("local-development"),
    },
    {
      type: "page",
      path: "open-source/deployment.mdx",
      slugs: ["open-source", "deployment"],
      data: getOpenSourcePage("deployment"),
    },
    {
      type: "page",
      path: "open-source/monitoring.mdx",
      slugs: ["open-source", "monitoring"],
      data: getOpenSourcePage("monitoring"),
    },
  ],
  metas: [
    {
      type: "meta",
      path: "meta.json",
      data: {
        title: "Rates API",
        pages: ["index", "api-reference", "open-source"],
      },
    },
    {
      type: "meta",
      path: "api-reference/meta.json",
      data: {
        title: "API Reference",
        pages: ["index", "introduction", "endpoint"],
      },
    },
    {
      type: "meta",
      path: "api-reference/endpoint/meta.json",
      data: {
        title: "Endpoints",
        pages: [
          "mortgage-rates",
          "personal-loan-rates",
          "car-loan-rates",
          "credit-card-rates",
        ],
      },
    },
    ...endpointGroups.map(([slug, title]) => ({
      type: "meta" as const,
      path: `api-reference/endpoint/${slug}/meta.json`,
      data: {
        title,
        pages: ["list", "get", "time-series"],
      },
    })),
    {
      type: "meta",
      path: "open-source/meta.json",
      data: {
        title: "Open Source",
        pages: ["index", "local-development", "deployment", "monitoring"],
      },
    },
  ],
});

export const docsSource = loader(docsStaticSource, {
  baseUrl: "/",
});

function getEndpointPage(index: number): DocsPageData {
  const page = endpointPages[index];
  if (!page) {
    throw new Error(`Missing endpoint page at index ${index}`);
  }

  return page;
}

function getOpenSourcePage(slug: keyof typeof openSourcePages): DocsPageData {
  return openSourcePages[slug];
}

export const docsLlms = llms(docsSource);
