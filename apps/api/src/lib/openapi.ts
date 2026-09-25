import { type toOpenAPISchema } from "@elysia/openapi";

// Text in this file and in route `detail` blocks follows ASD-STE100
// Simplified Technical English: approved words, active voice, short sentences.

type OpenApiPaths = ReturnType<typeof toOpenAPISchema>["paths"];
type OpenApiOperation = NonNullable<NonNullable<OpenApiPaths[string]>["get"]>;
type OpenApiParameter = NonNullable<OpenApiOperation["parameters"]>[number];

export type OpenApiServer = {
  url: string;
  description: string;
};

export const openApiExclude = {
  paths: ["/api/v1/mcp", "/api/v1/mcp/"],
};

export const openApiDocumentation = {
  info: {
    version: "1.0.0",
    title: "Rates API",
    description: [
      "Rates API gives the interest rates of New Zealand financial institutions for mortgages, personal loans, car loans, and credit cards.",
      "",
      "- The API collects data from [interest.co.nz](https://www.interest.co.nz) each hour.",
      "- The API keeps one snapshot of each dataset for each day on which the data changes. Use the time-series endpoints to get these snapshots.",
      "- You do not need an API key.",
      "- All responses are JSON.",
      "",
      "The data can be incorrect. For correct rates, refer to the financial institution.",
    ].join("\n"),
    contact: {
      name: "Rates API on GitHub",
      url: "https://github.com/simonbetton/ratesapi.nz/issues",
    },
  },
  externalDocs: {
    description: "Guides, concepts, and AI integration",
    url: "https://ratesapi.nz/api-reference",
  },
  tags: [
    {
      name: "Mortgage Rates",
      description:
        "Interest rates for mortgages (home loans). Each rate has a fixed term from 6 months to 5 years, or it is a variable floating rate.",
    },
    {
      name: "Personal Loan Rates",
      description:
        "Interest rates for personal loans. A rate can have a plan, for example, `Secured`, and a condition, for example, a loan amount.",
    },
    {
      name: "Car Loan Rates",
      description:
        "Interest rates for car loans. A rate can have a plan, for example, `Secured`, and a condition, for example, a loan amount.",
    },
    {
      name: "Credit Card Rates",
      description:
        "Credit card issuers and their plans, with interest rates and card fees.",
    },
    {
      name: "Health",
      description:
        "The status of the API and the time of the last change to each dataset.",
    },
  ],
  // The API has no authentication.
  security: [],
};

export function timeSeriesDescription(options: {
  rates: string;
  filters: string[];
}): string {
  return [
    `This endpoint gets historical snapshots of ${options.rates}. The API keeps one snapshot for each day (UTC) on which the data changed. Some dates do not have a snapshot.`,
    "",
    "Use one of these options:",
    "",
    "- To get one snapshot, send `date`.",
    "- To get all snapshots in a range, send `startDate` and `endDate`. The range contains the two dates.",
    "- To get the list of dates that have a snapshot, send no dates. The `availableDates` field contains the list.",
    "",
    "Do not send `date` together with `startDate` or `endDate`.",
    "",
    ...options.filters,
  ].join("\n");
}

export function toOpenApiDocument(
  generated: ReturnType<typeof toOpenAPISchema>,
  servers: OpenApiServer[],
) {
  return {
    openapi: "3.1.0",
    ...openApiDocumentation,
    servers,
    paths: withParameterDescriptions(generated.paths),
    components: generated.components,
  };
}

// The generator puts each parameter description in the parameter schema.
// Most OpenAPI tools only show the description of the parameter object.
function withParameterDescriptions(paths: OpenApiPaths): OpenApiPaths {
  return Object.fromEntries(
    Object.entries(paths).map(([path, pathItem]) => [
      path,
      pathItem?.get
        ? {
            ...pathItem,
            get: {
              ...pathItem.get,
              parameters: pathItem.get.parameters?.map(
                withParameterDescription,
              ),
            },
          }
        : pathItem,
    ]),
  );
}

function withParameterDescription(
  parameter: OpenApiParameter,
): OpenApiParameter {
  if ("$ref" in parameter || !parameter.schema || "$ref" in parameter.schema) {
    return parameter;
  }

  const { description, ...schema } = parameter.schema;

  return {
    ...parameter,
    description: parameter.description ?? description,
    schema,
  };
}
