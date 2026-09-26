import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChevronsUpDown,
  RotateCw,
  Search,
  TrendingDown,
} from "lucide-react";
import { Suspense, use, useDeferredValue, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { seriesColors } from "../lib/chart-palette";
import { useInViewOnce } from "../lib/dom-hooks";
import {
  categories,
  categoryInfo,
  forgetCategory,
  loadHistory,
  loadLatest,
  mortgageTerms,
} from "../lib/rates-data";
import type { Category, RateRow, RatesSnapshot } from "../lib/rates-data";
import {
  bigFiveBankNames,
  defaultFilters,
  filterRows,
  formatRate,
  hasValue,
  historySeries,
  lowestKeys,
  providerRanking,
  sortRows,
  summarize,
  termCurve,
} from "../lib/rates-stats";
import type { RateFilters, SortKey, SortState } from "../lib/rates-stats";
import { apiUrl } from "../lib/site-urls";
import { cn } from "../lib/utils";
import { LineChart, RankingChart } from "./rate-charts";

const updatedFormat = new Intl.DateTimeFormat("en-NZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Pacific/Auckland",
});
const dayFormat = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const monthFormat = new Intl.DateTimeFormat("en-NZ", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// Mortgage history needs one term to be meaningful; "All terms" charts this.
const fallbackHistoryTerm = "1 year";

export function RatesExplorer() {
  const [ref, inView] = useInViewOnce<HTMLElement>();
  return (
    <section
      aria-labelledby="explorer-title"
      className="page-container section-space"
      id="explorer"
      ref={ref}
    >
      <div className="section-intro">
        <p className="eyebrow">Try it with real data.</p>
        <h2 id="explorer-title">Explore today’s rates before you build.</h2>
        <p>
          Everything below is loaded from the API in your browser. Filter and
          sort the latest rows, spot the lowest rate in each set, and see how
          rates have moved over the past year.
        </p>
      </div>
      <div className="explorer">
        {inView ? <ExplorerApp /> : <ExplorerSkeleton withToolbar />}
      </div>
    </section>
  );
}

function ExplorerApp() {
  const [category, setCategory] = useState<Category>("mortgage");
  const [attempt, setAttempt] = useState(0);
  // The previous category stays on screen, dimmed, while the next one loads.
  const shownCategory = useDeferredValue(category);
  const stale = shownCategory !== category;

  function retry() {
    forgetCategory(shownCategory);
    setAttempt((current) => current + 1);
  }

  return (
    <>
      <div className="explorer-toolbar">
        <div
          aria-label="Rate category"
          className="explorer-tabs"
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a toggle-button group; <fieldset> adds UA min-inline-size and legend semantics we do not want
          role="group"
        >
          {categories.map((item) => (
            <button
              aria-pressed={category === item.id}
              key={item.id}
              onClick={() => setCategory(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <a
          className="explorer-endpoint"
          href={apiUrl(categoryInfo(category).path)}
          rel="noreferrer"
          target="_blank"
        >
          <code>GET {categoryInfo(category).path}</code>
          <ArrowUpRight aria-hidden="true" size={14} />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <Suspense fallback={<ExplorerSkeleton />}>
        <CategoryView
          category={shownCategory}
          key={`${shownCategory}:${attempt}`}
          onRetry={retry}
          stale={stale}
        />
      </Suspense>
    </>
  );
}

function CategoryView({
  category,
  onRetry,
  stale,
}: {
  category: Category;
  onRetry: () => void;
  stale: boolean;
}) {
  const result = use(loadLatest(category));
  if (result.status === "error") {
    return (
      <div className="explorer-message" role="alert">
        <strong>Rates unavailable</strong>
        <p>{result.message}</p>
        <button className="explorer-button" onClick={onRetry} type="button">
          <RotateCw aria-hidden="true" size={14} />
          Try again
        </button>
      </div>
    );
  }
  return (
    <CategoryData category={category} snapshot={result.value} stale={stale} />
  );
}

function distinctPlans(rows: readonly RateRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.plan) {
      counts.set(row.plan, (counts.get(row.plan) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .map(([plan]) => plan);
}

function CategoryData({
  category,
  snapshot,
  stale,
}: {
  category: Category;
  snapshot: RatesSnapshot;
  stale: boolean;
}) {
  const [filters, setFilters] = useState(() => defaultFilters(category));
  const [sort, setSort] = useState<SortState>({
    key: "rate",
    direction: "asc",
  });
  const filtered = useMemo(
    () => filterRows(snapshot.rows, filters),
    [snapshot.rows, filters]
  );
  const sorted = useMemo(() => sortRows(filtered, sort), [filtered, sort]);
  const plans = useMemo(() => distinctPlans(snapshot.rows), [snapshot.rows]);

  function resetFilters() {
    setFilters(defaultFilters(category));
  }

  return (
    <div aria-busy={stale} className={cn("explorer-body", stale && "is-stale")}>
      <ExplorerFilters
        category={category}
        filters={filters}
        onChange={(patch) =>
          setFilters((current) => ({ ...current, ...patch }))
        }
        onReset={resetFilters}
        plans={plans}
      />
      <ExplorerStats
        category={category}
        filters={filters}
        rows={filtered}
        total={snapshot.rows.length}
      />
      <div className="explorer-charts">
        {category === "mortgage" ? (
          <TermCurveCard filters={filters} rows={snapshot.rows} />
        ) : (
          <ProviderRankingCard rows={filtered} />
        )}
        <Suspense
          fallback={
            <ChartCard
              subtitle="Loading stored snapshots…"
              title="12-month history"
            >
              <div className="chart-loading" />
            </ChartCard>
          }
        >
          <HistoryCard
            category={category}
            filters={filters}
            latestDate={snapshot.lastUpdated.slice(0, 10)}
          />
        </Suspense>
      </div>
      <RatesTable
        category={category}
        filters={filters}
        onSort={setSort}
        rows={sorted}
        sort={sort}
        total={snapshot.rows.length}
      />
      {filtered.length === 0 && (
        <div className="explorer-message">
          <p>No rates match these filters.</p>
          <button
            className="explorer-button"
            onClick={resetFilters}
            type="button"
          >
            Reset filters
          </button>
        </div>
      )}
      <p className="explorer-footnote">
        Updated {updatedFormat.format(new Date(snapshot.lastUpdated))} (NZ time)
        from interest.co.nz.{" "}
        {category === "credit-card"
          ? "Debit, prepaid, and charge cards (0% purchase rate) are left out. "
          : "Rates listed as 0% are shown as missing. "}
        Rates are indicative; confirm with the provider.
      </p>
    </div>
  );
}

function ExplorerFilters({
  category,
  filters,
  onChange,
  onReset,
  plans,
}: {
  category: Category;
  filters: RateFilters;
  onChange: (patch: Partial<RateFilters>) => void;
  onReset: () => void;
  plans: readonly string[];
}) {
  const isDefault =
    JSON.stringify(filters) === JSON.stringify(defaultFilters(category));
  return (
    <div className="explorer-filters">
      <label className="explorer-search">
        <span className="sr-only">Search providers and products</span>
        <Search aria-hidden="true" size={15} />
        <input
          onChange={(event) => onChange({ query: event.target.value })}
          placeholder={
            category === "credit-card"
              ? "Search issuers or cards"
              : "Search providers or products"
          }
          type="search"
          value={filters.query}
        />
      </label>
      <label className="explorer-check" title={bigFiveBankNames}>
        <input
          checked={filters.bigFiveOnly}
          onChange={(event) => onChange({ bigFiveOnly: event.target.checked })}
          type="checkbox"
        />
        Big 5 banks
      </label>
      {category === "mortgage" && (
        <>
          <label className="explorer-select">
            Term
            <select
              onChange={(event) => onChange({ term: event.target.value })}
              value={filters.term}
            >
              <option value="">All terms</option>
              {mortgageTerms.map(({ term }) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </label>
          <label className="explorer-check">
            <input
              checked={filters.specialsOnly}
              onChange={(event) =>
                onChange({ specialsOnly: event.target.checked })
              }
              type="checkbox"
            />
            Specials only
          </label>
        </>
      )}
      {(category === "personal-loan" || category === "car-loan") && (
        <label className="explorer-select">
          Plan
          <select
            onChange={(event) => onChange({ plan: event.target.value })}
            value={filters.plan}
          >
            <option value="">All plans</option>
            {plans.map((plan) => (
              <option key={plan} value={plan}>
                {plan}
              </option>
            ))}
          </select>
        </label>
      )}
      {category === "credit-card" && (
        <label className="explorer-check">
          <input
            checked={filters.balanceTransferOnly}
            onChange={(event) =>
              onChange({ balanceTransferOnly: event.target.checked })
            }
            type="checkbox"
          />
          Balance transfer offers
        </label>
      )}
      {!isDefault && (
        <button className="explorer-reset" onClick={onReset} type="button">
          Reset filters
        </button>
      )}
    </div>
  );
}

function ExplorerStats({
  category,
  filters,
  rows,
  total,
}: {
  category: Category;
  filters: RateFilters;
  rows: readonly RateRow[];
  total: number;
}) {
  const { lowest, median, providers } = summarize(rows);
  const rateLabel = category === "credit-card" ? "purchase rate" : "rate";
  // The term is only worth naming when every term is on show.
  const lowestDetail = lowest
    ? [lowest.provider, lowest.product, filters.term ? null : lowest.term]
        .filter(Boolean)
        .join(" · ")
    : "No matching rates";
  return (
    <dl className="explorer-stats">
      <div>
        <dt>Lowest {rateLabel}</dt>
        <dd>{hasValue(lowest?.rate) ? formatRate(lowest.rate) : "—"}</dd>
        <dd className="explorer-stat-detail">{lowestDetail}</dd>
      </div>
      <div>
        <dt>Median {rateLabel}</dt>
        <dd>{hasValue(median) ? formatRate(median) : "—"}</dd>
        <dd className="explorer-stat-detail">
          Across {rows.length} of {total} rows
        </dd>
      </div>
      <div>
        <dt>Providers</dt>
        <dd>{providers}</dd>
        <dd className="explorer-stat-detail">Matching your filters</dd>
      </div>
    </dl>
  );
}

function ProviderRankingCard({ rows }: { rows: readonly RateRow[] }) {
  return (
    <ChartCard
      subtitle="Each provider’s lowest rate for your filters, cheapest first"
      title="Lowest rate by provider"
    >
      {rows.length === 0 ? (
        <p className="chart-empty">No rates match these filters.</p>
      ) : (
        <RankingChart
          items={providerRanking(rows, 8).map((row) => ({
            key: row.key,
            label: row.provider,
            detail: [row.product, row.plan].filter(Boolean).join(" · "),
            value: row.rate ?? 0,
          }))}
          title="Lowest rate by provider"
        />
      )}
    </ChartCard>
  );
}

function ChartCard({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="explorer-chart-card">
      <h3>{title}</h3>
      <p>{subtitle}</p>
      {children}
    </div>
  );
}

function TermCurveCard({
  filters,
  rows,
}: {
  filters: RateFilters;
  rows: readonly RateRow[];
}) {
  // The x-axis is the term, so every filter except the term applies.
  const curve = termCurve(filterRows(rows, { ...filters, term: "" }));
  return (
    <ChartCard
      subtitle="Lowest and median rate for each term, floating first"
      title="Rates across terms"
    >
      <LineChart
        highlight={curve.findIndex((point) => point.term === filters.term)}
        labels={curve.map((point) => point.term)}
        markers="all"
        minTickSpacing={26}
        series={[
          {
            name: "Lowest",
            color: seriesColors.lowest,
            values: curve.map((point) => point.lowest),
          },
          {
            name: "Median",
            color: seriesColors.median,
            values: curve.map((point) => point.median),
          },
        ]}
        ticks={curve.map((point) => point.short)}
        title="Lowest and median mortgage rate for each term"
      />
    </ChartCard>
  );
}

function HistoryCard({
  category,
  filters,
  latestDate,
}: {
  category: Category;
  filters: RateFilters;
  latestDate: string;
}) {
  const result = use(loadHistory(category, latestDate));
  const term =
    category === "mortgage" ? filters.term || fallbackHistoryTerm : "";
  const subtitle = term
    ? `Lowest and median ${term} rate, one stored snapshot a month`
    : "Lowest and median rate, one stored snapshot a month";

  if (result.status === "error") {
    return (
      <ChartCard subtitle={subtitle} title="12-month history">
        <p className="chart-empty">{result.message}</p>
      </ChartCard>
    );
  }

  const points = historySeries(result.value, { ...filters, term });
  if (points.length < 2) {
    return (
      <ChartCard subtitle={subtitle} title="12-month history">
        <p className="chart-empty">
          This dataset has{" "}
          {points.length === 1 ? "one snapshot" : "no snapshots"} so far.
          History appears once the API has stored more.
        </p>
      </ChartCard>
    );
  }

  const dates = points.map((point) => new Date(`${point.date}T00:00:00Z`));
  return (
    <ChartCard subtitle={subtitle} title="12-month history">
      <LineChart
        labels={dates.map((date) => dayFormat.format(date))}
        minTickSpacing={76}
        positions={dates.map((date) => date.getTime())}
        series={[
          {
            name: "Lowest",
            color: seriesColors.lowest,
            values: points.map((point) => point.lowest),
          },
          {
            name: "Median",
            color: seriesColors.median,
            values: points.map((point) => point.median),
          },
        ]}
        ticks={dates.map((date) => monthFormat.format(date))}
        title={subtitle}
      />
    </ChartCard>
  );
}

interface Column {
  key: SortKey;
  label: string;
  numeric?: boolean;
  render: (row: RateRow) => ReactNode;
  /** A muted second line under the value. */
  detail?: (row: RateRow) => string | null | undefined;
}

function rateCell(value: number | null | undefined) {
  if (!hasValue(value)) {
    return <span className="explorer-missing">—</span>;
  }
  return formatRate(value);
}

function columnsFor(category: Category): Column[] {
  const provider: Column = {
    key: "provider",
    label: category === "credit-card" ? "Issuer" : "Provider",
    render: (row) => row.provider,
  };
  if (category === "mortgage") {
    return [
      provider,
      { key: "product", label: "Product", render: (row) => row.product },
      { key: "term", label: "Term", render: (row) => row.term },
      {
        key: "rate",
        label: "Rate",
        numeric: true,
        render: (row) => rateCell(row.rate),
      },
    ];
  }
  if (category === "credit-card") {
    return [
      provider,
      { key: "product", label: "Card", render: (row) => row.product },
      {
        key: "rate",
        label: "Purchase",
        numeric: true,
        render: (row) => rateCell(row.rate),
      },
      {
        key: "cashAdvanceRate",
        label: "Cash advance",
        numeric: true,
        render: (row) => rateCell(row.cashAdvanceRate),
      },
      {
        key: "balanceTransferRate",
        label: "Balance transfer",
        numeric: true,
        render: (row) => rateCell(row.balanceTransferRate),
        detail: (row) =>
          hasValue(row.balanceTransferRate) ? row.balanceTransferPeriod : null,
      },
      {
        key: "interestFreeDays",
        label: "Interest-free",
        numeric: true,
        render: (row) =>
          hasValue(row.interestFreeDays) ? (
            `${row.interestFreeDays} days`
          ) : (
            <span className="explorer-missing">—</span>
          ),
      },
      {
        key: "fee",
        label: "Annual fee",
        numeric: true,
        render: (row) =>
          hasValue(row.fee) ? (
            `$${row.fee}`
          ) : (
            <span className="explorer-missing">—</span>
          ),
      },
    ];
  }
  return [
    provider,
    { key: "product", label: "Product", render: (row) => row.product },
    { key: "plan", label: "Plan", render: (row) => row.plan ?? "—" },
    {
      key: "condition",
      label: "Condition",
      render: (row) => row.condition ?? "—",
    },
    {
      key: "rate",
      label: "Rate",
      numeric: true,
      render: (row) => rateCell(row.rate),
    },
  ];
}

const badgeSet: Record<Category, string> = {
  mortgage: "term",
  "personal-loan": "plan",
  "car-loan": "plan",
  "credit-card": "column",
};

// Credit cards compete across the whole table, one column at a time.
const everyCard = () => "all";

// Which columns carry a "lowest" badge, and the set each row competes in.
function badgeKeys(category: Category, rows: readonly RateRow[]) {
  const badges = new Map<SortKey, Set<string>>();
  if (category === "credit-card") {
    badges.set(
      "rate",
      lowestKeys(rows, (row) => row.rate, everyCard)
    );
    badges.set(
      "cashAdvanceRate",
      lowestKeys(rows, (row) => row.cashAdvanceRate, everyCard)
    );
    badges.set(
      "balanceTransferRate",
      lowestKeys(rows, (row) => row.balanceTransferRate, everyCard)
    );
  } else {
    badges.set(
      "rate",
      lowestKeys(rows, (row) => row.rate)
    );
  }
  return badges;
}

// Completes "Lowest …" for the badge's tooltip and screen reader text.
function badgeScope(category: Category, row: RateRow) {
  if (category === "mortgage") {
    return ` ${row.term ?? ""} rate`;
  }
  if (category === "credit-card") {
    return " in this column";
  }
  return ` ${(row.plan ?? "").toLowerCase()} rate`;
}

function RatesTable({
  category,
  filters,
  onSort,
  rows,
  sort,
  total,
}: {
  category: Category;
  filters: RateFilters;
  onSort: (sort: SortState) => void;
  rows: readonly RateRow[];
  sort: SortState;
  total: number;
}) {
  // A filtered column holds one value on every row, so it is left out.
  const columns = columnsFor(category).filter(
    (column) =>
      !(column.key === "term" && filters.term) &&
      !(column.key === "plan" && filters.plan)
  );
  const badges = badgeKeys(category, rows);
  const sortedBy = columns.find((column) => column.key === sort.key);

  function toggleSort(key: SortKey) {
    onSort({
      key,
      direction: sort.key === key && sort.direction === "asc" ? "desc" : "asc",
    });
  }

  return (
    <div className="explorer-table-section">
      <p aria-live="polite" className="explorer-table-summary">
        Showing {rows.length} of {total} rows
        {sortedBy &&
          `, sorted by ${sortedBy.label.toLowerCase()} (${
            sort.direction === "asc" ? "low to high" : "high to low"
          })`}
        . <TrendingDown aria-hidden="true" size={13} /> marks the lowest rate in
        each {badgeSet[category]}.
      </p>
      <section
        aria-label="Rates table"
        className="explorer-table-wrap"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable table must be reachable by keyboard to scroll
        tabIndex={0}
      >
        <table className="explorer-table">
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort.key === column.key;
                let ariaSort: "ascending" | "descending" | undefined;
                if (active) {
                  ariaSort =
                    sort.direction === "asc" ? "ascending" : "descending";
                }
                let SortIcon = ChevronsUpDown;
                if (active) {
                  SortIcon = sort.direction === "asc" ? ArrowUp : ArrowDown;
                }
                return (
                  <th
                    aria-sort={ariaSort}
                    className={cn(column.numeric && "is-numeric")}
                    key={column.key}
                    scope="col"
                  >
                    <button
                      onClick={() => toggleSort(column.key)}
                      type="button"
                    >
                      {column.label}
                      <SortIcon aria-hidden="true" size={13} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                {columns.map((column) => (
                  <RateTableCell
                    badgeScope={
                      badges.get(column.key)?.has(row.key)
                        ? badgeScope(category, row)
                        : null
                    }
                    column={column}
                    key={column.key}
                    row={row}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function RateTableCell({
  badgeScope: scope,
  column,
  row,
}: {
  /** Set when this cell holds the lowest value in its set. */
  badgeScope: string | null;
  column: Column;
  row: RateRow;
}) {
  const content = column.render(row);
  const detail = column.detail?.(row);
  return (
    <td className={cn(column.numeric && "is-numeric")}>
      {scope === null ? (
        content
      ) : (
        // A flex row centres the pill on the value; baseline alignment
        // would sit it on the icon's bottom edge and ride high.
        <span className="explorer-cell-line">
          <span className="rate-badge" title={`Lowest${scope}`}>
            <TrendingDown aria-hidden="true" size={12} />
            <span className="rate-badge-text">Lowest</span>
            <span className="sr-only">{scope}:</span>
          </span>
          {content}
        </span>
      )}
      {detail && <span className="explorer-cell-detail">{detail}</span>}
    </td>
  );
}

function ExplorerSkeleton({ withToolbar = false }: { withToolbar?: boolean }) {
  return (
    <div aria-hidden="true" className="explorer-skeleton">
      {withToolbar && <span className="explorer-skeleton-bar" />}
      <div className="explorer-skeleton-stats">
        <span />
        <span />
        <span />
      </div>
      <div className="explorer-skeleton-charts">
        <span />
        <span />
      </div>
      <span className="explorer-skeleton-table" />
    </div>
  );
}
