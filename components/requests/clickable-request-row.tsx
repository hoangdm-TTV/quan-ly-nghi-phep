"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

interface ClickableRequestRowProps {
  href: string;
  children: ReactNode;
  className?: string;
  label: string;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest('a, button, input, select, textarea, [role="button"]'),
    )
  );
}

export default function ClickableRequestRow({
  href,
  children,
  className,
  label,
}: ClickableRequestRowProps) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    if (!isInteractiveTarget(event.target)) router.push(href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (
      (event.key === "Enter" || event.key === " ") &&
      event.target === event.currentTarget
    ) {
      event.preventDefault();
      router.push(href);
    }
  }

  return (
    <tr
      className={`${className || ""} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="link"
      aria-label={label}
    >
      {children}
    </tr>
  );
}
