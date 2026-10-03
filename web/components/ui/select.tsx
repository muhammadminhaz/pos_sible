"use client";

import { Children, Fragment, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import GlideSelect, { type GlideOption } from "./glide-select";

/**
 * The app's dropdown. Same composition as before (`Select > SelectTrigger > SelectValue`, `SelectContent > SelectItem`),
 * rendered by React Bits GlideSelect: the pieces below only describe the dropdown, `Select` reads them and draws it.
 */
type RootProps = { value?: string; defaultValue?: string; onValueChange?: (value: string) => void; disabled?: boolean; children?: ReactNode };
type TriggerProps = { id?: string; className?: string; size?: "sm" | "default"; "aria-label"?: string; "aria-invalid"?: boolean | "true" | "false"; autoFocus?: boolean; children?: ReactNode };
type ItemProps = { value: string; children?: ReactNode; disabled?: boolean };

/** Markers only: `Select` reads their props and draws the dropdown, so they render nothing themselves. */
const marker = <P,>() => (props: P) => (void props, null);
const SelectValue = marker<{ placeholder?: ReactNode; className?: string }>();
const SelectTrigger = marker<TriggerProps>();
const SelectItem = marker<ItemProps>();
const SelectContent = marker<{ children?: ReactNode; position?: string; align?: string; className?: string }>();

/** Children can be nested in fragments, arrays and conditionals; walk them in order and pick out the pieces by type. */
function collect<P>(nodes: ReactNode, type: unknown, out: ReactElement<P>[] = []): ReactElement<P>[] {
  Children.forEach(nodes, (n) => {
    if (!isValidElement(n)) return;
    if (n.type === type) out.push(n as ReactElement<P>);
    else if (n.type === Fragment) collect((n.props as { children?: ReactNode }).children, type, out);
  });
  return out;
}

function Select({ value, defaultValue, onValueChange, disabled, children }: RootProps) {
  const trigger = collect<TriggerProps>(children, SelectTrigger)[0];
  const content = collect<ComponentProps<typeof SelectContent>>(children, SelectContent)[0];
  const options: GlideOption[] = collect<ItemProps>(content?.props.children, SelectItem).map((i) => ({ value: i.props.value, label: i.props.children }));
  const tp = trigger?.props ?? {};
  const placeholder = collect<ComponentProps<typeof SelectValue>>(tp.children, SelectValue)[0]?.props.placeholder;
  const invalid = tp["aria-invalid"] === true || tp["aria-invalid"] === "true";

  return (
    <GlideSelect
      field
      options={options}
      value={value}
      defaultValue={defaultValue}
      onChange={onValueChange}
      placeholder={placeholder ?? ""}
      showTags={false}
      size={tp.size === "sm" ? "sm" : "md"}
      disabled={disabled}
      id={tp.id}
      autoFocus={tp.autoFocus}
      ariaLabel={tp["aria-label"]}
      invalid={invalid}
      className={tp.className}
    />
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };

/** A dropdown with ticks: pick as many rows as you like, the menu stays open. */
export function MultiSelect({ options, values, onChange, placeholder, summary, id, size, className, disabled, ariaLabel }: {
  options: { value: string; label: ReactNode }[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: ReactNode;
  summary?: (count: number) => string;
  id?: string;
  size?: "sm" | "default";
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <GlideSelect
      field multiple showTags={false} options={options} values={values} onValuesChange={onChange} placeholder={placeholder ?? ""}
      summary={summary} id={id} size={size === "sm" ? "sm" : "md"} className={className ?? "w-full"} disabled={disabled} ariaLabel={ariaLabel}
    />
  );
}
