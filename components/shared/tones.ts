export type Tone = "default" | "primary" | "success" | "warning" | "danger" | "info";

/** Soft chip styling per tone — used by StatusBadge, StatCard icons and payment chips. */
export const TONE_SOFT: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success-foreground dark:text-success",
  warning: "bg-warning/12 text-warning-foreground dark:text-warning",
  danger: "bg-danger/10 text-danger-foreground dark:text-danger",
  info: "bg-info/10 text-info-foreground dark:text-info",
};
