import { cn } from "cn";

/** Indigo square with a stylised receipt tear — the pos_sible mark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-xs", className)}
    >
      <svg viewBox="0 0 24 24" className="size-[60%]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3L6 20z" />
        <path d="M9.5 8h5M9.5 12h5" />
      </svg>
    </span>
  );
}
