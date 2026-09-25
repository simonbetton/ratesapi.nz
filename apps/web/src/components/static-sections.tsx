import { Terminal } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  apiLinks,
  collectionSteps,
  rateTrendBars,
  techBadges,
  terminalFlowSteps,
} from "./rates-api-content";
import { RateTableMock, SectionBadge } from "./rates-api-ui";

function AnimatedTerminalFlow() {
  return (
    <div
      className={cn(
        "rates-terminal-flow w-full overflow-hidden rounded-[10px] bg-[#0e1117] p-5 font-mono text-[13px] leading-6 shadow-[0_2px_4px_#12376914,0_1px_1px_#1237690a]"
      )}
    >
      <div className={cn("mb-4 flex items-center justify-between")}>
        <div className={cn("flex items-center gap-2")}>
          <span className={cn("size-2 rounded-full bg-[#ff5f57]")} />
          <span className={cn("size-2 rounded-full bg-[#ffbd2e]")} />
          <span className={cn("size-2 rounded-full bg-[#28c840]")} />
        </div>
        <span className={cn("text-[11px] text-[#8b949e]")}>
          local worker setup
        </span>
      </div>
      <div className={cn("min-h-[222px]")}>
        {terminalFlowSteps.map((step) => (
          <div
            className={cn(
              "flex gap-2",
              step.kind === "command" ? "text-[#d6e2f0]" : "text-[#7dd3fc]"
            )}
            key={`${step.kind}-${step.text}`}
          >
            <span className={cn("text-[#8b949e]")}>
              {step.kind === "command" ? "$" : ">"}
            </span>
            <span>{step.text}</span>
          </div>
        ))}
      </div>
      <div
        className={cn(
          "mt-4 flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-[12px]"
        )}
      >
        <span className={cn("text-[#8b949e]")}>next deploy target</span>
        <strong className={cn("font-medium text-[#fef3c7]")}>
          Cloudflare Workers
        </strong>
      </div>
    </div>
  );
}

export function TeamStrategySection() {
  return (
    <section className={cn("section-space")}>
      <div className={cn("mx-auto w-full max-w-[1330px] px-5")}>
        <SectionBadge className="mb-5">Made for your next feature</SectionBadge>
        <h2>
          Less data wrangling.
          <br className={cn("max-[640px]:hidden")} />
          More time building.
        </h2>
        <p className="mt-3">
          Example views below use illustrative data, not current offers.
        </p>
        <div
          className={cn("mt-12 grid grid-cols-3 gap-5 max-[900px]:grid-cols-1")}
        >
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_#f0f0f5]"
            )}
          >
            <div
              className={cn(
                "relative aspect-[1.35] max-h-[320px] min-h-[300px] w-full shrink-0 overflow-hidden bg-[url(/images/hero.webp)] bg-cover bg-center p-8"
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center"
                )}
              >
                <RateTableMock />
              </div>
            </div>
            <div
              className={cn(
                "flex flex-1 flex-col p-6 [&_h3]:mb-2 [&_h3]:text-[17px] [&_h3]:leading-[1.35] [&_p]:mt-0 [&_p]:mb-4 [&_p]:flex-1 [&_p]:text-sm [&_p]:leading-[22px] [&_p]:text-[#717583]"
              )}
            >
              <h3>Grouped by institution</h3>
              <p>
                Lender and issuer IDs sit above the products, which keeps bank
                comparisons straightforward.
              </p>
              <a
                className={cn(
                  "text-sm font-medium text-[#1a2035] no-underline hover:underline"
                )}
                href={apiLinks.concepts}
                rel="noopener noreferrer"
                target="_blank"
              >
                View schema -&gt;
              </a>
            </div>
          </div>
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_#f0f0f5]"
            )}
          >
            <div
              className={cn(
                "relative aspect-[1.35] max-h-[320px] min-h-[300px] w-full shrink-0 overflow-hidden bg-[url(/images/hero.webp)] bg-cover bg-center p-8"
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center"
                )}
              >
                <div
                  className={cn(
                    "w-[280px] max-w-[90%] rounded-lg bg-white p-5 shadow-[0_2px_4px_#12376914,0_1px_1px_#1237690a,0_0_0_1px_#12376914]"
                  )}
                >
                  <div className={cn("mb-4 flex items-center justify-between")}>
                    <strong
                      className={cn("text-[13px] font-medium text-[#1a2035]")}
                    >
                      Rate trend
                    </strong>
                    <span
                      className={cn(
                        "rounded-[20px] bg-[#dcfce7] px-2 py-1 text-[11px] text-[#16a34a]"
                      )}
                    >
                      time series
                    </span>
                  </div>
                  <div className={cn("flex h-[140px] items-end gap-2")}>
                    {rateTrendBars.map((height) => (
                      <span
                        className={cn(
                          "block flex-1 rounded-t bg-[#00a0ff] opacity-80",
                          height
                        )}
                        key={height}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div
              className={cn(
                "flex flex-1 flex-col p-6 [&_h3]:mb-2 [&_h3]:text-[17px] [&_h3]:leading-[1.35] [&_p]:mt-0 [&_p]:mb-4 [&_p]:flex-1 [&_p]:text-sm [&_p]:leading-[22px] [&_p]:text-[#717583]"
              )}
            >
              <h3>Historical snapshots</h3>
              <p>
                History is stored as snapshots, so a chart or audit can ask what
                the API returned on a specific date.
              </p>
              <a
                className={cn(
                  "text-sm font-medium text-[#1a2035] no-underline hover:underline"
                )}
                href={apiLinks.mortgageTimeSeriesOpenApi}
                rel="noopener noreferrer"
                target="_blank"
              >
                View history docs -&gt;
              </a>
            </div>
          </div>
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_#f0f0f5]"
            )}
          >
            <div
              className={cn(
                "relative aspect-[1.35] max-h-[320px] min-h-[300px] w-full shrink-0 overflow-hidden bg-[url(/images/hero.webp)] bg-cover bg-center p-8"
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center"
                )}
              >
                <div
                  className={cn(
                    "w-[300px] max-w-[90%] rounded-lg bg-white p-5 font-mono text-[12px] leading-6 text-[#2c3145] shadow-[0_2px_4px_#12376914,0_1px_1px_#1237690a,0_0_0_1px_#12376914]"
                  )}
                >
                  <div className={cn("text-[#00a0ff]")}>
                    rate:anz:special:1-year
                  </div>
                  <div>institution:anz</div>
                  <div>product:anz:special</div>
                  <div>termInMonths: 12</div>
                  <div>rate: 4.69</div>
                </div>
              </div>
            </div>
            <div
              className={cn(
                "flex flex-1 flex-col p-6 [&_h3]:mb-2 [&_h3]:text-[17px] [&_h3]:leading-[1.35] [&_p]:mt-0 [&_p]:mb-4 [&_p]:flex-1 [&_p]:text-sm [&_p]:leading-[22px] [&_p]:text-[#717583]"
              )}
            >
              <h3>Follow a provider from list to detail</h3>
              <p>
                Use the IDs returned by the API to fetch one institution or
                filter its history. Product names and availability can change.
              </p>
              <a
                className={cn(
                  "text-sm font-medium text-[#1a2035] no-underline hover:underline"
                )}
                href={apiLinks.concepts}
                rel="noopener noreferrer"
                target="_blank"
              >
                View schema -&gt;
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AutomationsSection() {
  return (
    <section className={cn("section-space")}>
      <div className={cn("mx-auto w-full max-w-[1330px] px-5")}>
        <div
          className={cn("grid grid-cols-2 items-start max-[900px]:grid-cols-1")}
        >
          <div
            className={cn(
              "flex flex-col gap-7 px-14 first:border-r first:border-[#eaecf0] first:pl-0 last:pr-0 max-[900px]:border-b max-[900px]:border-[#eaecf0] max-[900px]:px-0 max-[900px]:pb-10 max-[900px]:first:border-r-0"
            )}
          >
            <div>
              <SectionBadge className="mb-5">Freshness</SectionBadge>
              <h2>Know how fresh your data is.</h2>
              <p className={cn("mb-4 text-base leading-[1.65] text-[#717583]")}>
                Collection from interest.co.nz is scheduled hourly. Check each
                dataset’s lastUpdated value before displaying rates; a healthy
                service does not guarantee fresh data.
              </p>
              <a
                className={cn(
                  "text-sm font-medium text-[#1a2035] no-underline hover:underline"
                )}
                href={apiLinks.health}
                rel="noopener noreferrer"
                target="_blank"
              >
                Check dataset freshness -&gt;
              </a>
            </div>
            <figure
              aria-label="Hourly data collection workflow"
              className={cn(
                "min-h-[390px] rounded-[14px] border border-[#f1f3f6] bg-white bg-[radial-gradient(#e1e3e9_1px,transparent_1px)] bg-size-[10px_10px] p-8"
              )}
            >
              <div aria-hidden="true">
                <strong
                  className={cn(
                    "mb-3 block text-[11px] tracking-[1px] text-[#656977] uppercase"
                  )}
                >
                  Hourly collection schedule
                </strong>
                {collectionSteps.map(([label, body], index) => (
                  <div
                    className={cn(
                      "relative mt-5 rounded-lg bg-white p-4 shadow-[0_1px_1px_#12376905,0_0_0_1px_#1237690f]"
                    )}
                    key={label}
                  >
                    <span
                      className={cn(
                        "absolute top-5 -left-3 flex size-6 items-center justify-center rounded-full bg-[#00a0ff] text-[11px] font-medium text-white"
                      )}
                    >
                      {index + 1}
                    </span>
                    <strong
                      className={cn(
                        "block text-[15px] font-normal text-[#1a2035]"
                      )}
                    >
                      {label}
                    </strong>
                    <span className={cn("text-sm text-[#717583]")}>{body}</span>
                  </div>
                ))}
              </div>
            </figure>
          </div>
          <div
            className={cn(
              "flex flex-col gap-7 px-14 first:border-r first:border-[#eaecf0] first:pl-0 last:pr-0 max-[900px]:border-b max-[900px]:border-[#eaecf0] max-[900px]:px-0 max-[900px]:pt-10 max-[900px]:pb-0 max-[900px]:first:border-r-0 max-[900px]:last:border-b-0"
            )}
          >
            <div>
              <SectionBadge className="mb-5">Open source</SectionBadge>
              <h2>Use the API. Or make it your own.</h2>
              <p className={cn("mb-4 text-base leading-[1.65] text-[#717583]")}>
                The project is MIT licensed and built with TypeScript, Bun,
                Elysia, Cloudflare Workers, and Cloudflare D1. Local setup,
                deployment, and monitoring notes live with the source.
              </p>
              <a
                className={cn(
                  "text-sm font-medium text-[#1a2035] no-underline hover:underline"
                )}
                href={apiLinks.source}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open GitHub repository -&gt;
              </a>
            </div>
            <figure
              aria-label="Example local development commands"
              className={cn(
                "flex min-h-[390px] items-center justify-center rounded-[14px] border-0 bg-[url(/images/hero.webp)] bg-cover bg-center px-5 py-8"
              )}
            >
              <div className={cn("w-full max-w-[520px]")}>
                <AnimatedTerminalFlow />
                <div className={cn("mt-4 flex flex-wrap gap-2")}>
                  {techBadges.map((label) => (
                    <span
                      className={cn(
                        "rounded-[20px] border border-[#e8e9f0] bg-white/90 px-2 py-1 text-[11px] text-[#4b5068] shadow-[0_1px_1px_#1237690a]"
                      )}
                      key={label}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FooterCtaSection() {
  return (
    <section
      className={cn(
        "block bg-white bg-[linear-gradient(180deg,#fff_0%,#fff_16%,rgba(255,255,255,0.92)_30%,rgba(255,255,255,0)_58%),url(/images/footer.webp)] [background-size:100%_100%,100%_auto] [background-position:top,bottom] bg-no-repeat px-6 pt-20 pb-[22%] max-[640px]:bg-[linear-gradient(180deg,#fff_0%,rgba(255,255,255,0.94)_10%,rgba(255,255,255,0.28)_50%,rgba(255,255,255,0)_78%),url(/images/footer-mobile.webp)] max-[640px]:[background-size:100%_80.125vw,100%_auto] max-[640px]:[background-position:bottom] max-[640px]:pb-[42%]"
      )}
    >
      <div className={cn("flex flex-col items-center p-0 text-center")}>
        <h2>
          <span className={cn("block")}>Start with a free request.</span>
          <span className={cn("text-[#636b7b]")}>Ship something useful.</span>
        </h2>
        <p
          className={cn(
            "inline-block max-w-[600px] text-base leading-[26px] text-[#717583]"
          )}
        >
          Your next comparison tool, calculator, or agent starts with a request.
          No account to create. No API key to manage.
        </p>
        <div
          className={cn(
            "mt-8 flex flex-wrap items-center justify-center gap-3"
          )}
        >
          <a
            className={cn(
              "inline-flex items-center rounded-lg bg-[#1a2035] px-5 py-[13px] text-[15px] font-medium text-white no-underline"
            )}
            href="#quickstart"
          >
            Try the API
          </a>
          <a
            className={cn(
              "inline-flex cursor-pointer flex-col items-start rounded-lg border-0 bg-white px-5 py-[13px] text-[15px] leading-[1.4] font-medium text-[#1a2035] no-underline shadow-[0_2px_4px_#12376914,0_1px_1px_#1237690a,0_0_0_1px_#12376914]"
            )}
            href={apiLinks.source}
          >
            View the source on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer
      className={cn(
        "border-t border-[#eaecf0] [&_h4]:mb-2 [&_h4]:text-[13px] [&_h4]:leading-5 [&_h4]:font-medium [&_h4]:text-[#1a2035] [&_li]:m-0 [&_ul]:m-0 [&_ul]:list-none [&_ul]:p-0 [&_ul_a]:block [&_ul_a]:py-1.5 [&_ul_a]:text-[14px] [&_ul_a]:leading-5 [&_ul_a]:no-underline [&_ul_a]:transition-colors [&_ul_a]:duration-150"
      )}
    >
      <div className={cn("mx-auto w-full max-w-[1330px] px-5")}>
        <div
          className={cn(
            "flex justify-between gap-12 pt-14 pb-12 max-[640px]:flex-col max-[640px]:gap-9 max-[640px]:pt-10 max-[640px]:pb-9"
          )}
        >
          <div className={cn("max-w-[300px]")}>
            <div className="site-logo">
              <Terminal aria-hidden="true" size={22} />
              <span>Rates API</span>
            </div>
            <p className={cn("mt-3")}>
              Free New Zealand lending rates as JSON, OpenAPI, and MCP. Updated
              every hour.
            </p>
          </div>
          <nav
            aria-label="Footer"
            className={cn("grid grid-cols-2 gap-x-16 max-[640px]:gap-x-6")}
          >
            <div>
              <h4>Product</h4>
              <ul>
                <li>
                  <a href={apiLinks.openapi}>OpenAPI</a>
                </li>
                <li>
                  <a href={apiLinks.openapiJson}>OpenAPI JSON</a>
                </li>
                <li>
                  <a href={apiLinks.mcpDocs}>MCP endpoint</a>
                </li>
                <li>
                  <a href={apiLinks.health}>Health check</a>
                </li>
              </ul>
            </div>
            <div>
              <h4>Open source</h4>
              <ul>
                <li>
                  <a href={apiLinks.source}>GitHub repository</a>
                </li>
                <li>
                  <a href={apiLinks.openSource}>Project architecture</a>
                </li>
                <li>
                  <a href={apiLinks.localDevelopment}>Local development</a>
                </li>
                <li>
                  <a href={apiLinks.deployment}>Deployment</a>
                </li>
              </ul>
            </div>
          </nav>
        </div>
        <div
          className={cn(
            "flex items-center justify-between gap-1.5 border-t border-[#eaecf0] py-6 text-[13px] text-[#596275] max-[640px]:flex-col max-[640px]:items-start"
          )}
        >
          <span>© 2026 Rates API</span>
          <a href={apiLinks.author} rel="noopener" target="_blank">
            Made by Simon Betton
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
