import * as aggregatesModule from "./aggregates";
import * as carLoanRatesModule from "./car-loan-rates";
import * as creditCardRatesModule from "./credit-card-rates";
import * as mcpModule from "./mcp";
import * as mortgageRatesModule from "./mortgage-rates";
import * as personalLoanRatesModule from "./personal-loan-rates";

export const aggregatesRoutes = aggregatesModule.routes;
export const carLoanRatesRoutes = carLoanRatesModule.routes;
export const creditCardRatesRoutes = creditCardRatesModule.routes;
export const mcpRoutes = mcpModule.routes;
export const mortgageRatesRoutes = mortgageRatesModule.routes;
export const personalLoanRatesRoutes = personalLoanRatesModule.routes;
