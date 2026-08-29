"use client";

import { IconLabel } from "@/components/Icon";
import { RotateCcw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Something broke</h1>
      <p className="text-sm text-muted">
        {error.message || "The FPL feed may be down. Retry in a minute."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center rounded-md bg-accent px-3 py-2 text-sm text-on-accent"
      >
        <IconLabel icon={RotateCcw} size="sm">
          Retry
        </IconLabel>
      </button>
    </div>
  );
}
