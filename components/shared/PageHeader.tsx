import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  actionsHiddenOnMobile,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Hide the actions below md when the page renders them elsewhere (e.g. beside a mobile filter toggle). */
  actionsHiddenOnMobile?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-muted-foreground">{description}</p>}
        </div>
        {actions && (
          <div data-print-hide className={actionsHiddenOnMobile ? "hidden flex-wrap items-center gap-2 md:flex" : "flex flex-wrap items-center gap-2"}>
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
