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
        "rates-terminal-flow w-full overflow-hidden rounded-[10px] bg-[#0e1117] p-5 font-mono text-[13px] leading-6 shadow-[0_2px_4px_#12376914,0_1px_1px_#1237690a]",
      )}
    >
      <div className={cn("mb-4 flex items-center justify-between")}>
        <div className={cn("flex items-center gap-2")}>
          <span className={cn("size-2 rounded-full bg-[#ff5f57]")} />
          <span className={cn("size-2 rounded-full bg-[#ffbd2e]")} />
          <span className={cn("size-2 rounded-full bg-[#28c840]")} />
        </div>
        <span className={cn("text-[#8b949e] text-[11px]")}>
          local worker setup
        </span>
      </div>
      <div className={cn("min-h-[222px]")}>
        {terminalFlowSteps.map((step) => (
          <div
            className={cn(
              "flex gap-2",
              step.kind === "command" ? "text-[#d6e2f0]" : "text-[#7dd3fc]",
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
          "mt-4 flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-[12px]",
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
              "flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_#f0f0f5]",
            )}
          >
            <div
              className={cn(
                "relative aspect-[1.35] w-full shrink-0 overflow-hidden bg-[url(/images/hero.webp)] bg-center bg-cover p-8",
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center",
                )}
              >
                <RateTableMock />
              </div>
            </div>
            <div
              className={cn(
                "flex flex-1 flex-col p-6 [&_h3]:mb-2 [&_h3]:text-[17px] [&_h3]:leading-[1.35] [&_p]:mt-0 [&_p]:mb-4 [&_p]:flex-1 [&_p]:text-[#717583] [&_p]:text-sm [&_p]:leading-[22px]",
              )}
            >
              <h3>Grouped by institution</h3>
              <p>
                Lender and issuer IDs sit above the products, which keeps bank
                comparisons straightforward.
              </p>
              <a
                className={cn(
                  "font-medium text-[#1a2035] text-sm no-underline hover:underline",
                )}
                href="https://ratesapi.nz/api-reference/concepts"
                rel="noopener noreferrer"
                target="_blank"
              >
                View schema -&gt;
              </a>
            </div>
          </div>
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_#f0f0f5]",
            )}
          >
            <div
              className={cn(
                "relative aspect-[1.35] w-full shrink-0 overflow-hidden bg-[url(/images/hero.webp)] bg-center bg-cover p-8",
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center",
                )}
              >
                <div
                  className={cn(
                    "w-[280px] max-w-[90%] rounded-lg bg-white p-5 shadow-[0_2px_4px_#12376914,0_1px_1px_#1237690a,0_0_0_1px_#12376914]",
                  )}
                >
                  <div className={cn("mb-4 flex items-center justify-between")}>
                    <strong
                      className={cn("font-medium text-[#1a2035] text-[13px]")}
                    >
                      Rate trend
                    </strong>
                    <span
                      className={cn(
                        "rounded-[20px] bg-[#dcfce7] px-2 py-1 text-[#16a34a] text-[11px]",
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
                          height,
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
                "flex flex-1 flex-col p-6 [&_h3]:mb-2 [&_h3]:text-[17px] [&_h3]:leading-[1.35] [&_p]:mt-0 [&_p]:mb-4 [&_p]:flex-1 [&_p]:text-[#717583] [&_p]:text-sm [&_p]:leading-[22px]",
              )}
            >
              <h3>Historical snapshots</h3>
              <p>
                History is stored as snapshots, so a chart or audit can ask what
                the API returned on a specific date.
              </p>
              <a
                className={cn(
                  "font-medium text-[#1a2035] text-sm no-underline hover:underline",
                )}
                href="https://ratesapi.nz/api-reference/endpoint/mortgage-rates/time-series"
                rel="noopener noreferrer"
                target="_blank"
              >
                View history docs -&gt;
              </a>
            </div>
          </div>
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_#f0f0f5]",
            )}
          >
            <div
              className={cn(
                "relative aspect-[1.35] w-full shrink-0 overflow-hidden bg-[url(/images/hero.webp)] bg-center bg-cover p-8",
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center",
                )}
              >
                <div
                  className={cn(
                    "w-[300px] max-w-[90%] rounded-lg bg-white p-5 font-mono text-[#2c3145] text-[12px] leading-6 shadow-[0_2px_4px_#12376914,0_1px_1px_#1237690a,0_0_0_1px_#12376914]",
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
                "flex flex-1 flex-col p-6 [&_h3]:mb-2 [&_h3]:text-[17px] [&_h3]:leading-[1.35] [&_p]:mt-0 [&_p]:mb-4 [&_p]:flex-1 [&_p]:text-[#717583] [&_p]:text-sm [&_p]:leading-[22px]",
              )}
            >
              <h3>Follow a provider from list to detail</h3>
              <p>
                Use the IDs returned by the API to fetch one institution or
                filter its history. Product names and availability can change.
              </p>
              <a
                className={cn(
                  "font-medium text-[#1a2035] text-sm no-underline hover:underline",
                )}
                href="https://ratesapi.nz/api-reference/concepts"
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
              "flex flex-col gap-7 px-14 first:border-[#eaecf0] first:border-r first:pl-0 last:pr-0 max-[900px]:border-[#eaecf0] max-[900px]:border-b max-[900px]:px-0 max-[900px]:pb-10 max-[900px]:first:border-r-0",
            )}
          >
            <div>
              <SectionBadge className="mb-5">Freshness</SectionBadge>
              <h2>Know how fresh your data is.</h2>
              <p className={cn("mb-4 text-[#717583] text-base leading-[1.65]")}>
                Collection from interest.co.nz is scheduled hourly. Check each
                dataset’s lastUpdated value before displaying rates; a healthy
                service does not guarantee fresh data.
              </p>
              <a
                className={cn(
                  "font-medium text-[#1a2035] text-sm no-underline hover:underline",
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
                "min-h-[390px] rounded-[14px] border border-[#f1f3f6] bg-[radial-gradient(#c8cad4_1px,transparent_1px)] bg-size-[10px_10px] bg-white p-8",
              )}
            >
              <div aria-hidden="true">
                <strong
                  className={cn(
                    "mb-3 block text-[#848894] text-[11px] uppercase tracking-[1px]",
                  )}
                >
                  Hourly collection schedule
                </strong>
                {collectionSteps.map(([label, body], index) => (
                  <div
                    className={cn(
                      "relative mt-5 rounded-lg bg-white p-4 shadow-[0_1px_1px_#12376905,0_0_0_1px_#1237690f]",
                    )}
                    key={label}
                  >
                    <span
                      className={cn(
                        "absolute top-5 -left-3 flex size-6 items-center justify-center rounded-full bg-[#00a0ff] font-medium text-[11px] text-white",
                      )}
                    >
                      {index + 1}
                    </span>
                    <strong
                      className={cn(
                        "block font-normal text-[#1a2035] text-[15px]",
                      )}
                    >
                      {label}
                    </strong>
                    <span className={cn("text-[#717583] text-sm")}>{body}</span>
                  </div>
                ))}
              </div>
            </figure>
          </div>
          <div
            className={cn(
              "flex flex-col gap-7 px-14 first:border-[#eaecf0] first:border-r first:pl-0 last:pr-0 max-[900px]:border-[#eaecf0] max-[900px]:border-b max-[900px]:px-0 max-[900px]:pt-10 max-[900px]:pb-0 max-[900px]:last:border-b-0 max-[900px]:first:border-r-0",
            )}
          >
            <div>
              <SectionBadge className="mb-5">Open source</SectionBadge>
              <h2>Use the API. Or make it your own.</h2>
              <p className={cn("mb-4 text-[#717583] text-base leading-[1.65]")}>
                The project is MIT licensed and built with TypeScript, Bun,
                Elysia, Cloudflare Workers, and Cloudflare D1. Local setup,
                deployment, and monitoring notes live with the source.
              </p>
              <a
                className={cn(
                  "font-medium text-[#1a2035] text-sm no-underline hover:underline",
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
                "flex min-h-[390px] items-center justify-center rounded-[14px] border-0 bg-[url(/images/hero.webp)] bg-center bg-cover px-5 py-8",
              )}
            >
              <div className={cn("w-full max-w-[520px]")}>
                <AnimatedTerminalFlow />
                <div className={cn("mt-4 flex flex-wrap gap-2")}>
                  {techBadges.map((label) => (
                    <span
                      className={cn(
                        "rounded-[20px] border border-[#e8e9f0] bg-white/90 px-2 py-1 text-[#4b5068] text-[11px] shadow-[0_1px_1px_#1237690a]",
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
        "block bg-[linear-gradient(180deg,#fff_0%,#fff_16%,rgba(255,255,255,0.92)_30%,rgba(255,255,255,0)_58%),url(/images/footer.webp)] bg-white bg-no-repeat px-6 pt-20 pb-[22%] [background-position:top,bottom] [background-size:100%_100%,100%_auto] max-[640px]:bg-[linear-gradient(180deg,#fff_0%,#fff_28%,rgba(255,255,255,0.94)_42%,rgba(255,255,255,0.28)_68%,rgba(255,255,255,0)_86%),url(/images/footer.webp)] max-[640px]:pb-[42%] max-[640px]:[background-size:100%_100%,auto_64%]",
      )}
    >
      <div className={cn("flex flex-col items-center p-0 text-center")}>
        <h2>
          <span className={cn("block")}>Start with a free request.</span>
          <span className={cn("text-[#636b7b]")}>Ship something useful.</span>
        </h2>
        <p
          className={cn(
            "inline-block max-w-[600px] text-[#717583] text-base leading-[26px]",
          )}
        >
          Your next comparison tool, calculator, or agent starts with a request.
          No account to create. No API key to manage.
        </p>
        <div
          className={cn(
            "mt-8 flex flex-wrap items-center justify-center gap-3",
          )}
        >
          <a
            className={cn(
              "inline-flex items-center rounded-lg bg-[#1a2035] px-5 py-[13px] font-medium text-[15px] text-white no-underline",
            )}
            href="#quickstart"
          >
            Try the API
          </a>
          <a
            className={cn(
              "inline-flex cursor-pointer flex-col items-start rounded-lg border-0 bg-white px-5 py-[13px] font-medium text-[#1a2035] text-[15px] leading-[1.4] no-underline shadow-[0_2px_4px_#12376914,0_1px_1px_#1237690a,0_0_0_1px_#12376914]",
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
        "[&_a:hover]:text-[#00a0ff] [&_a]:block [&_a]:py-[5px] [&_a]:font-normal [&_a]:text-[#636b7b] [&_a]:text-[15px] [&_a]:leading-[22px] [&_a]:no-underline [&_a]:transition-colors [&_a]:duration-150 [&_h4]:mb-3 [&_h4]:font-medium [&_h4]:text-[#1a2035] [&_h4]:text-[15px] [&_h4]:leading-[22px] [&_li]:m-0 [&_ul]:m-0 [&_ul]:list-none [&_ul]:p-0",
      )}
    >
      <div className={cn("mx-auto w-full max-w-[1330px] px-5")}>
        <div
          className={cn(
            "flex justify-between py-[60px] pb-[50px] transition-all duration-1500 ease-[cubic-bezier(.19,1,.22,1)] max-[640px]:flex-col max-[640px]:[&>div]:mb-6",
          )}
        >
          <div className={cn("flex")}>
            <div className={cn("mr-[60px]")}>
              <h4>Product</h4>
              <ul>
                <li>
                  <a href={apiLinks.sampleRequest}>Sample request</a>
                </li>
                <li>
                  <a href={apiLinks.openapi}>OpenAPI</a>
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
          </div>
          <div>
            <h4>Rates API</h4>
            <ul>
              <li>
                <a href={apiLinks.mcpDocs}>MCP endpoint</a>
              </li>
              <li>
                <a href={apiLinks.openapiJson}>OpenAPI JSON</a>
              </li>
              <li>
                <a
                  href="https://x.com/simonbetton"
                  rel="noreferrer"
                  target="_blank"
                >
                  Follow Simon on X
                </a>
              </li>
            </ul>
            <div
              className={cn("mt-3 text-[#636b7b] text-[15px]")}
              id="copyright"
            >
              © 2026 Rates API
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
