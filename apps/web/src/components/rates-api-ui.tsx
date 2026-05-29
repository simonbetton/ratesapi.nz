import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  type ApiGlyphType,
  type EndpointIconName,
  rateTableRows,
} from "./rates-api-content";

const pillClass =
  "inline-flex items-center gap-[7px] rounded-[40px] bg-white px-3.5 py-[7px] text-[13px] font-medium text-[#1a2035] shadow-[0_2px_4px_#12376914,0_1px_1px_#1237690a,0_0_0_1px_#12376914] [&_svg]:shrink-0";

export const cardClass =
  "relative rounded-lg bg-white p-6 shadow-[0_0_0_1px_#f2f2f6] transition-all duration-[1500ms] ease-[cubic-bezier(.19,1,.22,1)] [&>p]:mb-4 [&>p]:text-sm max-[640px]:px-[35px]";

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

export function SmallIcon({
  children,
  className,
}: { children: ReactNode } & ClassNameProp) {
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-black/10 bg-white text-[#1a2035]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ApiGlyph({
  type = "code",
  className,
}: { type?: ApiGlyphType } & ClassNameProp) {
  if (type === "chart") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        height="16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        width="16"
      >
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M7 15l4-4 3 3 5-7" />
      </svg>
    );
  }

  if (type === "clock") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        height="16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        width="16"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  if (type === "db") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        height="16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        width="16"
      >
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="16"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function EndpointIcon({
  icon,
  className,
}: { icon: EndpointIconName } & ClassNameProp) {
  if (icon === "home") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        height="18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        width="18"
      >
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
      </svg>
    );
  }

  if (icon === "wallet") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        height="18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        width="18"
      >
        <path d="M3 7h18v13H3z" />
        <path d="M16 12h5v4h-5z" />
        <path d="M3 7l3-4h12l3 4" />
      </svg>
    );
  }

  if (icon === "car") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        height="18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        width="18"
      >
        <path d="M5 12l2-5h10l2 5" />
        <path d="M4 12h16v6H4z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
      </svg>
    );
  }

  if (icon === "card") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        height="18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        width="18"
      >
        <rect height="14" rx="2" width="20" x="2" y="5" />
        <path d="M2 10h20" />
        <path d="M6 15h4" />
      </svg>
    );
  }

  if (icon === "chart") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        height="18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        width="18"
      >
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M7 15l4-4 3 3 5-7" />
      </svg>
    );
  }

  if (icon === "schema") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        height="18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        width="18"
      >
        <rect height="7" rx="1" width="7" x="3" y="3" />
        <rect height="7" rx="1" width="7" x="14" y="3" />
        <rect height="7" rx="1" width="7" x="8.5" y="14" />
        <path d="M10 6.5h4M12 10v4" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="18"
    >
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
      <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
    </svg>
  );
}

export function EndpointCard({
  title,
  body,
  href,
  icon,
  className,
}: {
  title: string;
  body: string;
  href: string;
  icon: EndpointIconName;
} & ClassNameProp) {
  return (
    <div
      className={cn(
        "flex w-[300px] shrink-0 flex-col rounded-[10px] bg-[#f7fafc] p-6 [&_h3]:mb-2 [&_p]:mb-4 [&_p]:flex-1 [&_p]:text-sm [&_p]:leading-[22px]",
        className,
      )}
    >
      <div className={cn("mb-4 flex w-full items-start")}>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-black/10 bg-white text-[#1a2035]",
          )}
        >
          <EndpointIcon icon={icon} />
        </div>
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      <a
        className={cn(
          "font-medium text-[#1a2035] text-sm no-underline hover:underline",
        )}
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        Learn more -&gt;
      </a>
    </div>
  );
}

export function MiniBrowser({
  children,
  label,
  className,
}: { children: ReactNode; label: string } & ClassNameProp) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[10px] bg-[#0e1117] text-left shadow-[0_2px_4px_#12376914,0_1px_1px_#1237690a,0_0_0_1px_#12376914]",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-white/10 border-b bg-[#161b22] px-4 py-3",
        )}
      >
        <span className={cn("size-2 rounded-full bg-[#ff5f57]")} />
        <span className={cn("size-2 rounded-full bg-[#ffbd2e]")} />
        <span className={cn("size-2 rounded-full bg-[#28c840]")} />
        <code
          className={cn(
            "ml-2 rounded bg-white/5 px-2 py-1 text-[#9fa3b5] text-[11px]",
          )}
        >
          {label}
        </code>
      </div>
      {children}
    </div>
  );
}

export function RateTableMock({ className }: ClassNameProp) {
  return (
    <div
      className={cn(
        "rounded-[14px] bg-white p-5 text-[13px] shadow-[0_2px_4px_#12376914,0_1px_1px_#1237690a,0_0_0_1px_#12376914]",
        className,
      )}
    >
      <div
        className={cn(
          "mb-4 flex items-center justify-between border-[#eaecf0] border-b pb-3.5",
        )}
      >
        <div>
          <strong
            className={cn("block font-medium text-[#1a2035] text-[15px]")}
          >
            ANZ mortgage rates
          </strong>
          <span className={cn("text-[#717583] text-xs")}>institution:anz</span>
        </div>
        <span
          className={cn(
            "rounded-[30px] bg-[#e4f5ff] px-2 py-1 font-mono text-[#00a0ff] text-[10px]",
          )}
        >
          JSON
        </span>
      </div>
      {rateTableRows.map(([product, term, rate]) => (
        <div
          className={cn(
            "grid grid-cols-[1fr_90px_64px] gap-3 border-[#f1f3f6] border-b py-2.5 last:border-b-0",
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

export function JsonSnippet({ className }: ClassNameProp) {
  return (
    <pre
      className={cn(
        "max-h-[420px] overflow-auto p-6 font-mono text-[#c9d1d9] text-[13px] leading-6",
        className,
      )}
    >
      <code>{`{
  "id": "institution:anz",
  "name": "ANZ",
  "products": [
    {
      "id": "product:anz:special",
      "rates": [
        { "term": "6 months", "rate": 4.49 },
        { "term": "1 year", "rate": 4.69 }
      ]
    }
  ]
}`}</code>
    </pre>
  );
}

export function FeatureCard({
  title,
  copy,
  icon = "code",
  href,
  className,
}: {
  title: string;
  copy: string;
  icon?: ApiGlyphType;
  href?: string;
} & ClassNameProp) {
  return (
    <div className={cn(cardClass, "flex-1", className)}>
      <SmallIcon className="mb-4">
        <ApiGlyph type={icon} />
      </SmallIcon>
      <h3>{title}</h3>
      <p>{copy}</p>
      {href ? (
        <a
          className={cn(
            "font-medium text-[#1a2035] text-sm no-underline hover:underline",
          )}
          href={href}
          rel="noopener noreferrer"
          target="_blank"
        >
          Learn more -&gt;
        </a>
      ) : null}
    </div>
  );
}
