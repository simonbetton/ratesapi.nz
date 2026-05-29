import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ text, label = "Copy code" }: { text: string; label?: string }) {
  const [status, setStatus] = useState<"ready" | "copied" | "error">("ready");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <span className="copy-control">
      <button className="copy-button" type="button" onClick={copy} aria-label={label}>
        {status === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {status === "copied" ? "Copied" : "Copy"}
      </button>
      <span className={status === "error" ? "copy-error" : "sr-only"} role="status">
        {status === "copied" ? `${label}: copied to clipboard.` : status === "error" ? "Copy unavailable. Select and copy the code below." : ""}
      </span>
    </span>
  );
}
