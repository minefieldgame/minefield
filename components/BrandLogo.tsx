"use client";

import Image from "next/image";
import { useState } from "react";

export default function BrandLogo({
  className = "h-16 w-auto",
  priority = false
}: {
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return process.env.NODE_ENV === "development" ? (
      <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
        Developer warning: public/minefield-logo.png is missing or unreadable.
      </div>
    ) : null;
  }

  return (
    <Image
      src="/minefield-logo.png"
      alt="Minefield"
      width={720}
      height={710}
      priority={priority}
      sizes="(max-width: 640px) 112px, 136px"
      className={className}
      onError={() => {
        console.error("[Minefield brand] public/minefield-logo.png could not be loaded.");
        setFailed(true);
      }}
    />
  );
}
