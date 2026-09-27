import { LocaleToggle } from "@/components/layout/LocaleToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_50%_-10%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[48px_48px] opacity-40 mask-[radial-gradient(40rem_28rem_at_50%_30%,black,transparent)]"
      />
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LocaleToggle />
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  );
}
