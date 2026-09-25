import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { rateTableRows } from "./rates-api-content";

const pillClass =
  "inline-flex items-center gap-[7px] rounded-[40px] bg-white px-3.5 py-[7px] text-[13px] font-medium text-[#1a2035] shadow-[0_2px_4px_#12376914,0_1px_1px_#1237690a,0_0_0_1px_#12376914] [&_svg]:shrink-0";

interface ClassNameProp {
  className?: string;
}

function BadgeIcon({ className }: ClassNameProp) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      height="14"
      viewBox="0 0 14 14"
      width="14"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 10.5h10M2 7h10M2 3.5h10"
        stroke="#1a2035"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
      <path
        d="M4 2v10M10 2v10"
        opacity=".45"
        stroke="#1a2035"
        strokeLinecap="round"
        strokeWidth="1.1"
      />
    </svg>
  );
}

export function SectionBadge({
  children,
  className,
}: { children: ReactNode } & ClassNameProp) {
  return (
    <span className={cn(pillClass, className)}>
      <BadgeIcon />
      {children}
    </span>
  );
}

export function RateTableMock({ className }: ClassNameProp) {
  return (
    <div
      className={cn(
        "w-[90%] max-w-[320px] rounded-[14px] bg-white p-4 text-xs shadow-[0_2px_4px_#12376914,0_1px_1px_#1237690a,0_0_0_1px_#12376914]",
        className
      )}
    >
      <div
        className={cn(
          "mb-4 flex items-center justify-between border-b border-[#eaecf0] pb-3.5"
        )}
      >
        <div>
          <strong
            className={cn("block text-[15px] font-medium text-[#1a2035]")}
          >
            ANZ mortgage rates
          </strong>
          <span className={cn("text-xs text-[#717583]")}>institution:anz</span>
        </div>
        <span
          className={cn(
            "rounded-[30px] bg-[#e4f5ff] px-2 py-1 font-mono text-[10px] text-[#00a0ff]"
          )}
        >
          JSON
        </span>
      </div>
      {rateTableRows.map(([product, term, rate]) => (
        <div
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto] gap-2 border-b border-[#f1f3f6] py-2.5 last:border-b-0"
          )}
          key={`${product}-${term}`}
        >
          <span className={cn("text-[#1a2035]")}>{product}</span>
          <span className={cn("text-[#717583]")}>{term}</span>
          <strong className={cn("text-right font-medium text-[#1a2035]")}>
            {rate}
          </strong>
        </div>
      ))}
    </div>
  );
}
