import { apiUrl } from "./site-urls";

export const mortgageUrl = apiUrl("/api/v1/mortgage-rates");
export const languages = ["cURL", "JavaScript", "Python"] as const;
export type ExampleLanguage = (typeof languages)[number];

export function requestUrl(term: string) {
  return term
    ? `${mortgageUrl}?termInMonths=${encodeURIComponent(term)}`
    : mortgageUrl;
}

export function requestExample(language: ExampleLanguage, term: string) {
  const url = requestUrl(term);
  switch (language) {
    case "cURL": {
      return `curl --fail-with-body '${url}'`;
    }
    case "JavaScript": {
      return `const response = await fetch(\n  '${url}'\n);\n\nif (!response.ok) {\n  throw new Error(\`Rates API: \${response.status}\`);\n}\n\nconst { data, lastUpdated } = await response.json();\nconsole.log(data, lastUpdated);`;
    }
    case "Python": {
      // urllib's default User-Agent is blocked, so the example names its app.
      return `import json\nfrom urllib.request import Request, urlopen\n\nurl = '${url}'\nheaders = {'User-Agent': 'my-app/1.0 (+https://example.com)'}\nwith urlopen(Request(url, headers=headers), timeout=15) as response:\n    payload = json.load(response)\n\nprint(payload['data'])\nprint(payload['lastUpdated'])`;
    }
    default: {
      const unsupported: never = language;
      throw new Error(`Unsupported example language: ${unsupported}`);
    }
  }
}

// A small, illustrative response using the public API's schema, not live rates.
export const exampleResponse = {
  type: "MortgageRates",
  data: [
    {
      id: "institution:anz",
      name: "ANZ",
      products: [
        {
          id: "product:anz:special",
          name: "Special",
          rates: [
            {
              id: "rate:anz:special:1-year",
              rate: 4.99,
              term: "1 year",
              termInMonths: 12,
            },
          ],
        },
      ],
    },
  ],
  lastUpdated: "2026-09-24T04:19:31.911Z",
  termsOfUse:
    "Data is retrieved hourly from interest.co.nz. Please note that the information provided is not guaranteed to be accurate. For the most up-to-date and accurate rates, please check with the provider directly.",
  timestamp: "2026-09-24T05:41:12.125Z",
};

// A stateless MCP 2026-07-28 request: the version and client capabilities
// travel in `_meta`, mirrored by the MCP-Protocol-Version, Mcp-Method, and
// Mcp-Name headers.
export const mcpRequest = `curl --fail-with-body ${apiUrl("/api/v1/mcp")} \\
  -H 'Content-Type: application/json' \\
  -H 'MCP-Protocol-Version: 2026-07-28' \\
  -H 'Mcp-Method: tools/call' \\
  -H 'Mcp-Name: list_mortgage_rates' \\
  -d '{
    "jsonrpc": "2.0",
    "id": "rates-1",
    "method": "tools/call",
    "params": {
      "name": "list_mortgage_rates",
      "arguments": { "termInMonths": "12" },
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {}
      }
    }
  }'`;
