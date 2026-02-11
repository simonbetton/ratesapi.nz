# API Endpoints

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

- **Aggregates**: `/api/v1/aggregates/{dataType}`
  - Get daily aggregate metrics by date
  - Get aggregate time series by date range

- **MCP (Model Context Protocol)**: `/api/v1/mcp`
  - JSON-RPC endpoint exposing MCP tools for the rates API
  - Methods: `initialize`, `tools/list`, `tools/call`, `ping`

Example MCP request (list tools):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

Example MCP request (call tool):

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "list_mortgage_rates",
    "arguments": {
      "termInMonths": "12"
    }
  }
}
```

All endpoints support CORS and return JSON responses.

## API Documentation

- OpenAPI documentation is available at: `/api/v1/doc`
- Swagger UI is available in development mode at the root URL
- Production redirects to: [https://docs.ratesapi.nz](https://docs.ratesapi.nz)
