import { useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import { useElementWidth } from "../lib/dom-hooks";
import { formatRate, hasValue } from "../lib/rates-stats";

const chartHeight = 216;
const margin = { top: 14, right: 52, bottom: 28, left: 44 };
const niceSteps = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];

/** A rounded y-domain with about four gridlines. */
function niceDomain(values: readonly number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step =
    niceSteps.find((candidate) => (max - min) / candidate <= 4) ?? 10;
  let lo = Math.floor(min / step) * step;
  let hi = Math.ceil(max / step) * step;
  if (hi - lo < step) {
    lo -= step;
    hi += step;
  }
  const ticks: number[] = [];
  for (let tick = lo; tick <= hi + step / 2; tick += step) {
    ticks.push(Number(tick.toFixed(4)));
  }
  return { lo, hi, ticks };
}

interface LineSeries {
  name: string;
  color: string;
  values: readonly (number | null)[];
}

interface LineChartProps {
  /** Accessible name; the table view carries every value. */
  title: string;
  /** Full label per point, shown in the tooltip. */
  labels: readonly string[];
  /** Short axis label per point. */
  ticks: readonly string[];
  /** Numeric x per point (timestamps); defaults to evenly spaced. */
  positions?: readonly number[];
  series: readonly LineSeries[];
  /** Point to band-highlight, e.g. the selected term. */
  highlight?: number;
  markers?: "all" | "end";
  minTickSpacing?: number;
}

function linePath(points: readonly (readonly [number, number] | null)[]) {
  let path = "";
  let penDown = false;
  for (const point of points) {
    if (point) {
      path += `${penDown ? "L" : "M"}${point[0].toFixed(1)} ${point[1].toFixed(1)}`;
    }
    penDown = point !== null;
  }
  return path;
}

export function LineChart({
  title,
  labels,
  ticks,
  positions,
  series,
  highlight,
  markers = "end",
  minTickSpacing = 36,
}: LineChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const count = labels.length;
  const values = series.flatMap((item) =>
    item.values.filter((value) => value !== null)
  );

  if (count === 0 || values.length === 0) {
    return (
      <div className="chart-frame" ref={ref}>
        <p className="chart-empty">No rates match these filters.</p>
      </div>
    );
  }

  const xs = positions ?? labels.map((_, index) => index);
  const xMin = Math.min(...xs);
  const xSpan = Math.max(...xs) - xMin || 1;
  const inset = 10;
  const plotLeft = margin.left + inset;
  const plotRight = Math.max(plotLeft + 1, width - margin.right - inset);
  const plotBottom = chartHeight - margin.bottom;
  const x = (index: number) =>
    plotLeft + (((xs[index] ?? 0) - xMin) / xSpan) * (plotRight - plotLeft);
  const { lo, hi, ticks: yTicks } = niceDomain(values);
  const y = (value: number) =>
    plotBottom - ((value - lo) / (hi - lo)) * (plotBottom - margin.top);
  const tickEvery = Math.max(
    1,
    Math.ceil(count / Math.max(1, (plotRight - plotLeft) / minTickSpacing))
  );
  const bandWidth = count > 1 ? (plotRight - plotLeft) / (count - 1) : 40;

  // Edge ticks anchor inward so their labels never clip.
  function tickPlacement(index: number) {
    if (index === 0) {
      return { anchor: "start", x: x(index) - inset } as const;
    }
    if (index === count - 1) {
      return { anchor: "end", x: x(index) + inset } as const;
    }
    return { anchor: "middle", x: x(index) } as const;
  }

  const ends = series.map((item) => {
    let last = -1;
    for (const [index, value] of item.values.entries()) {
      if (value !== null) {
        last = index;
      }
    }
    return last;
  });
  // Direct end labels only when they cannot collide; the legend and tooltip
  // carry identity and values otherwise.
  const endYs = series.map((item, index) => {
    const value = item.values[ends[index] ?? -1];
    return hasValue(value) ? y(value) : null;
  });
  const endLabelsFit = endYs.every((endY, index) =>
    endYs.every(
      (other, otherIndex) =>
        index === otherIndex ||
        endY === null ||
        other === null ||
        Math.abs(endY - other) >= 14
    )
  );

  function nearestIndex(clientX: number, rect: DOMRect) {
    const pointerX = clientX - rect.left;
    let best = 0;
    for (let index = 1; index < count; index += 1) {
      if (Math.abs(x(index) - pointerX) < Math.abs(x(best) - pointerX)) {
        best = index;
      }
    }
    return best;
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    setActive(
      nearestIndex(event.clientX, event.currentTarget.getBoundingClientRect())
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = active ?? count - 1;
    const next: Record<string, number> = {
      ArrowLeft: Math.max(0, current - 1),
      ArrowRight: Math.min(count - 1, current + 1),
      Home: 0,
      End: count - 1,
    };
    if (event.key in next) {
      event.preventDefault();
      setActive(next[event.key] ?? current);
    } else if (event.key === "Escape") {
      setActive(null);
    }
  }

  const activeX = active === null ? 0 : x(active);
  const tooltipOnLeft = activeX > width / 2;
  const readoutIndex = active ?? count - 1;
  const readout = [
    labels[readoutIndex],
    ...series.map((item) => {
      const value = item.values[readoutIndex];
      return `${item.name} ${hasValue(value) ? formatRate(value) : "no data"}`;
    }),
  ].join(", ");

  return (
    <div className="chart-frame" ref={ref}>
      <div className="chart-legend">
        {series.map((item) => (
          <span key={item.name}>
            <i style={{ background: item.color }} />
            {item.name}
          </span>
        ))}
      </div>
      {/* The plot is a slider over its points: arrow keys move the same
          readout that pointer hover shows, and screen readers hear it. */}
      <div
        aria-label={title}
        aria-valuemax={count - 1}
        aria-valuemin={0}
        aria-valuenow={readoutIndex}
        aria-valuetext={readout}
        className="chart-plot"
        onBlur={() => setActive(null)}
        onFocus={() => setActive(count - 1)}
        onKeyDown={onKeyDown}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a range input cannot host the SVG plot and tooltip it controls
        role="slider"
        // Holds the plot's height until the width is measured and it draws.
        style={{ minHeight: chartHeight }}
        tabIndex={0}
      >
        {width > 0 && (
          <svg
            aria-hidden="true"
            height={chartHeight}
            onPointerLeave={() => setActive(null)}
            onPointerMove={onPointerMove}
            width={width}
          >
            {highlight !== undefined && highlight >= 0 && (
              <rect
                className="chart-highlight"
                height={plotBottom - margin.top}
                width={bandWidth}
                x={x(highlight) - bandWidth / 2}
                y={margin.top}
              />
            )}
            {yTicks.map((tick) => (
              <g key={tick}>
                <line
                  className="chart-grid"
                  x1={margin.left}
                  x2={width - margin.right}
                  y1={y(tick)}
                  y2={y(tick)}
                />
                <text
                  className="chart-axis-label"
                  dominantBaseline="middle"
                  textAnchor="end"
                  x={margin.left - 8}
                  y={y(tick)}
                >
                  {tick.toFixed(tick % 1 === 0 ? 0 : 2)}%
                </text>
              </g>
            ))}
            {ticks.map((tick, index) =>
              // Count back from the newest point so it always gets a label.
              (count - 1 - index) % tickEvery === 0 ? (
                <text
                  className="chart-axis-label"
                  key={`${tick}-${labels[index]}`}
                  textAnchor={tickPlacement(index).anchor}
                  x={tickPlacement(index).x}
                  y={chartHeight - 8}
                >
                  {tick}
                </text>
              ) : null
            )}
            {active !== null && (
              <line
                className="chart-crosshair"
                x1={activeX}
                x2={activeX}
                y1={margin.top}
                y2={plotBottom}
              />
            )}
            {series.map((item, seriesIndex) => (
              <g key={item.name}>
                <path
                  className="chart-line"
                  d={linePath(
                    item.values.map((value, index) =>
                      value === null ? null : [x(index), y(value)]
                    )
                  )}
                  stroke={item.color}
                />
                {item.values.map((value, index) =>
                  value !== null &&
                  (markers === "all" ||
                    index === ends[seriesIndex] ||
                    index === active) ? (
                    <circle
                      className="chart-marker"
                      cx={x(index)}
                      cy={y(value)}
                      fill={item.color}
                      key={labels[index]}
                      r={index === active ? 5 : 4}
                    />
                  ) : null
                )}
                {endLabelsFit && active === null && (
                  <text
                    className="chart-end-label"
                    dominantBaseline="middle"
                    x={x(ends[seriesIndex] ?? 0) + 9}
                    y={endYs[seriesIndex] ?? 0}
                  >
                    {formatRate(item.values[ends[seriesIndex] ?? 0] ?? 0)}
                  </text>
                )}
              </g>
            ))}
          </svg>
        )}
        {active !== null && (
          <div
            className="chart-tooltip"
            style={{
              left: tooltipOnLeft ? undefined : activeX + 12,
              right: tooltipOnLeft ? width - activeX + 12 : undefined,
            }}
          >
            <span className="chart-tooltip-label">{labels[active]}</span>
            {series.map((item) => {
              const value = item.values[active];
              return (
                <span className="chart-tooltip-row" key={item.name}>
                  <i style={{ background: item.color }} />
                  <strong>{hasValue(value) ? formatRate(value) : "—"}</strong>
                  {item.name}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface RankingItem {
  key: string;
  label: string;
  detail: string;
  value: number;
}

/** A ranked dot plot: close values stay readable without a zero baseline. */
export function RankingChart({
  items,
  title,
}: {
  items: readonly RankingItem[];
  title: string;
}) {
  if (items.length === 0) {
    return null;
  }
  const { lo, hi, ticks } = niceDomain(items.map((item) => item.value));
  const lowest = Math.min(...items.map((item) => item.value));
  const percent = (value: number) => `${((value - lo) / (hi - lo)) * 100}%`;

  return (
    <figure aria-label={title} className="ranking">
      <ol className="ranking-rows">
        {items.map((item) => (
          <li key={item.key}>
            <span className="ranking-label">
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </span>
            <span aria-hidden="true" className="ranking-track">
              {ticks.map((tick) => (
                <i key={tick} style={{ left: percent(tick) }} />
              ))}
              <b style={{ left: percent(item.value) }} />
            </span>
            <span className="ranking-value">
              {formatRate(item.value)}
              {item.value === lowest && <em>Lowest</em>}
            </span>
          </li>
        ))}
      </ol>
      <div aria-hidden="true" className="ranking-axis">
        <span />
        <span className="ranking-ticks">
          {ticks.map((tick) => (
            <span key={tick} style={{ left: percent(tick) }}>
              {tick.toFixed(tick % 1 === 0 ? 0 : 2)}%
            </span>
          ))}
        </span>
        <span />
      </div>
    </figure>
  );
}
