"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import "./glide-select.css";

const SIZES = { sm: { chip: 28, row: 26, font: 12 }, md: { chip: 32, row: 30, font: 13 }, lg: { chip: 44, row: 40, font: 14 } } as const;
const PAD = 4;
const GAP = 1;
const MENU_GAP = 6;
const EDGE = 8;

export type GlideOption = { value: string; label: ReactNode; tag?: string; /** Extra text the search box matches against. */ keywords?: string; /** Shown on the closed trigger instead of `label`. */ chip?: ReactNode };
type Item = GlideOption;

export type GlideSelectProps = {
  options: (string | GlideOption)[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, option: GlideOption) => void;
  placeholder?: ReactNode;
  showTags?: boolean;
  size?: keyof typeof SIZES;
  radius?: number;
  /** Menu width in pixels; never narrower than the trigger. Omit to match the trigger. */
  menuWidth?: number;
  placement?: "top" | "bottom";
  align?: "left" | "right";
  popDuration?: number;
  glideDuration?: number;
  rememberPosition?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  /** Bordered, transparent trigger that matches the app's inputs (the default look inside forms and tables). */
  field?: boolean;
  id?: string;
  invalid?: boolean;
  autoFocus?: boolean;
  /** Several rows can be ticked; the menu stays open while picking. Uses `values` / `onValuesChange` instead of `value` / `onChange`. */
  multiple?: boolean;
  values?: string[];
  defaultValues?: string[];
  onValuesChange?: (values: string[]) => void;
  /** Chip text when more than two rows are ticked, e.g. "3 selected". */
  summary?: (count: number) => string;
  className?: string;
  /** Adds a search box that filters the rows as you type. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** When given, the parent does the filtering (e.g. a server search) and the rows are shown as passed in. */
  onSearch?: (query: string) => void;
  emptyText?: ReactNode;
  /** Small icon shown at the start of the trigger (e.g. a map pin on a Location filter). */
  icon?: ReactNode;
};

const norm = (o: string | GlideOption): Item => (typeof o === "string" ? { value: o, label: o } : o);
const textOf = (it: Item) => (typeof it.label === "string" ? it.label : it.value);
const typeaheadIndex = (items: Item[], from: number, ch: string) => {
  const c = ch.toLowerCase();
  for (let k = 1; k <= items.length; k++) {
    const i = (from + k) % items.length;
    if (textOf(items[i]).toLowerCase().startsWith(c)) return i;
  }
  return from;
};

type Phase = "closed" | "open" | "closing";
type Pos = { top?: number; bottom?: number; left: number; width: number; side: "top" | "bottom" };

/** React Bits GlideSelect: a chip that grows a menu whose highlight pill glides between rows. */
export default function GlideSelect({
  options, value, defaultValue, onChange, placeholder = "Select…", showTags = true, size = "md", radius = 10, menuWidth,
  placement = "bottom", align = "left", popDuration = 180, glideDuration = 220, rememberPosition = true, disabled = false,
  ariaLabel = "Select", field = false, id: idProp, invalid, autoFocus, multiple = false, values, defaultValues, onValuesChange, summary, className = "",
  searchable = false, searchPlaceholder = "Search…", onSearch, emptyText = "No results", icon,
}: GlideSelectProps) {
  const all = options.map(norm);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const items = !searchable || onSearch || !needle ? all : all.filter((it) => `${textOf(it)} ${it.value} ${it.tag ?? ""} ${it.keywords ?? ""}`.toLowerCase().includes(needle));
  const [inner, setInner] = useState(defaultValue ?? "");
  const [innerMulti, setInnerMulti] = useState<string[]>(defaultValues ?? []);
  const ticked = values ?? innerMulti;
  const current = multiple ? ticked.join("\u0000") : (value ?? inner);
  const isOn = (v: string) => (multiple ? ticked.includes(v) : v === current);
  const selected = items.findIndex((it) => isOn(it.value));
  const chosen = all.filter((it) => isOn(it.value));
  const chipText: ReactNode = !multiple
    ? chosen.length ? (chosen[0].chip ?? chosen[0].label) : placeholder
    : chosen.length === 0 ? placeholder : chosen.length <= 2 ? chosen.map(textOf).join(", ") : (summary?.(chosen.length) ?? `${chosen.length} selected`);
  const [phase, setPhase] = useState<Phase>("closed");
  const [active, setActive] = useState<number | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const instant = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrub = useRef<{ id: number; top: number } | null>(null);
  const uid = useId();
  const S = SIZES[size] ?? SIZES.md;
  const step = S.row + GAP;
  const popOut = Math.round((popDuration * 2) / 3);

  // Place the menu against the trigger in viewport coordinates, flipping when the chosen side would leave the screen.
  const place = () => {
    const t = triggerRef.current;
    const m = menuRef.current;
    if (!t || !m) return;
    const r = t.getBoundingClientRect();
    const width = Math.max(r.width, menuWidth ?? 0);
    const h = m.offsetHeight;
    const below = window.innerHeight - r.bottom - MENU_GAP - EDGE;
    const above = r.top - MENU_GAP - EDGE;
    const side = placement === "bottom" ? (h > below && above > below ? "top" : "bottom") : h > above && below > above ? "bottom" : "top";
    const left = Math.min(Math.max(EDGE, align === "left" ? r.left : r.right - width), window.innerWidth - width - EDGE);
    setPos(side === "bottom" ? { top: r.bottom + MENU_GAP, left, width, side } : { bottom: window.innerHeight - r.top + MENU_GAP, left, width, side });
  };

  useLayoutEffect(() => {
    if (phase !== "open") return;
    const el = menuRef.current;
    if (!el) return;
    place();
    el.style.transitionDuration = instant.current ? "0ms" : "";
    el.dataset.state = "closed";
    void el.offsetHeight;
    el.dataset.state = "open";
    const p = pillRef.current;
    if (p) {
      p.style.transition = "none";
      p.style.transform = `translateY(${Math.max(0, selected) * step}px)`;
      p.style.opacity = "0";
      void p.offsetHeight;
      p.style.transition = "";
    }
    // Bring the chosen row into view in long lists.
    if (selected >= 0) el.scrollTop = Math.max(0, selected * step - el.clientHeight / 2 + S.row / 2);
    searchRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useLayoutEffect(() => {
    const p = pillRef.current;
    if (!p || phase !== "open") return;
    if (active === null || active >= items.length) {
      p.style.opacity = "0";
      return;
    }
    const jump = instant.current || p.style.opacity !== "1";
    p.style.transitionDuration = jump ? "0ms, 150ms" : "";
    p.style.transform = `translateY(${active * step}px)`;
    p.style.opacity = "1";
    instant.current = false;
  }, [active, phase, step, items.length]);

  const open = (viaKey: boolean) => {
    if (disabled) return;
    clearTimeout(closeTimer.current);
    instant.current = true;
    setActive(selected >= 0 ? selected : viaKey ? 0 : null);
    setPhase("open");
  };
  const close = (mode: "instant" | "pop") => {
    setActive(null);
    if (searchable) triggerRef.current?.focus({ preventScroll: true }); // the search box is portalled, so hand focus back to the trigger
    if (query) {
      setQuery("");
      onSearch?.("");
    }
    clearTimeout(closeTimer.current);
    const el = menuRef.current;
    if (mode === "instant" || !el) {
      setPhase("closed");
      return;
    }
    el.style.transitionDuration = "";
    el.dataset.state = "closed";
    setPhase("closing");
    closeTimer.current = setTimeout(() => setPhase("closed"), popOut + 20);
  };
  const pick = (i: number, viaKey: boolean) => {
    const it = items[i];
    if (!it) return close("instant");
    if (multiple) {
      const next = ticked.includes(it.value) ? ticked.filter((x) => x !== it.value) : all.map((x) => x.value).filter((x) => x === it.value || ticked.includes(x));
      if (values === undefined) setInnerMulti(next);
      onValuesChange?.(next);
      return; // stays open so several rows can be ticked
    }
    if (it.value !== current) {
      if (value === undefined) setInner(it.value);
      onChange?.(it.value, it);
      if (!viaKey && rootRef.current) rootRef.current.dataset.swap = "";
    }
    close("instant");
    triggerRef.current?.focus({ preventScroll: true });
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    const n = items.length;
    const cur = active ?? Math.max(0, selected);
    if (phase !== "open") {
      if (k === "Enter" || k === " " || k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault();
        open(true);
      }
      return;
    }
    const go = (i: number) => {
      e.preventDefault();
      instant.current = true;
      setActive(Math.min(n - 1, Math.max(0, i)));
    };
    if (k === "ArrowDown" || k === "ArrowUp") go(active === null ? cur : cur + (k === "ArrowDown" ? 1 : -1));
    else if (k === "Home" || k === "End") go(k === "Home" ? 0 : n - 1);
    else if (k === "Enter" || k === " ") {
      e.preventDefault();
      pick(cur, true);
    } else if (k === "Escape" || k === "Tab") {
      if (k === "Escape") {
        e.preventDefault();
        e.stopPropagation(); // closes the menu, not the dialog around it
      }
      close("instant");
    } else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) go(typeaheadIndex(items, cur, k));
  };

  useEffect(() => {
    // A modal dialog's focus trap pulls focus back from outside nodes; the portalled menu is ours, so keep focusin from reaching it.
    const m = menuRef.current;
    if (!m || !searchable) return undefined;
    const stop = (e: Event) => e.stopPropagation();
    m.addEventListener("focusin", stop);
    return () => m.removeEventListener("focusin", stop);
  }, [phase, searchable]);

  useEffect(() => {
    if (phase === "closed") return undefined;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close("pop");
    };
    const onMove = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (e.type === "resize" && document.activeElement === searchRef.current) return; // the mobile keyboard opening resizes the window
      close("instant");
    };
    // Captured on window so it runs before a dialog's own Escape handler: Escape closes the menu, not the dialog behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      close("instant");
      triggerRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  // A trigger that becomes disabled while open: the menu just goes away with it.
  const showing = phase !== "closed" && !disabled;
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const rowAt = (y: number) => {
    const s = scrub.current;
    if (!s) return null;
    const i = Math.floor((y - s.top - PAD) / step);
    return i >= 0 && i < items.length ? i : null;
  };
  const onListDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (scrub.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    scrub.current = { id: e.pointerId, top: e.currentTarget.getBoundingClientRect().top + PAD };
    instant.current = true;
    setActive(rowAt(e.clientY));
  };
  const onListMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrub.current || scrub.current.id !== e.pointerId) return;
    const i = rowAt(e.clientY);
    if (i !== active) setActive(i);
  };
  const onListUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrub.current || scrub.current.id !== e.pointerId) return;
    const i = e.type === "pointerup" ? rowAt(e.clientY) : null;
    scrub.current = null;
    if (i !== null) pick(i, false);
    else if (!rememberPosition) setActive(null);
  };
  const onListOver = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || scrub.current) return;
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (!row) return;
    const i = Number(row.dataset.index);
    if (i !== active) setActive(i);
  };

  const side = pos?.side ?? placement;
  const menu =
    showing && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="glide-select__menu"
            data-state="open"
            data-side={side}
            style={{
              top: pos?.top, bottom: pos?.bottom, left: pos?.left, width: pos?.width, minWidth: pos?.width, visibility: pos ? "visible" : "hidden",
              pointerEvents: "auto", // a modal dialog turns pointer events off everywhere else on the page
              "--gs-radius": `${radius}px`, "--gs-inner-radius": `${Math.max(3, radius - 4)}px`, "--gs-row": `${S.row}px`, "--gs-font": `${S.font}px`,
              "--gs-pop": `${popDuration}ms`, "--gs-pop-out": `${popOut}ms`, "--gs-glide": `${glideDuration}ms`,
              "--gs-origin": `${side === "bottom" ? "top" : "bottom"} ${align}`,
              "--gs-surface": "var(--popover)", "--gs-highlight": "var(--accent)", "--gs-text": "var(--popover-foreground)", "--gs-accent": "var(--primary)",
            } as CSSProperties}
            // A dialog treats a press outside itself as "dismiss": keep this one from reaching it.
            onPointerDown={(e) => e.nativeEvent.stopPropagation()}
            onMouseDown={(e) => {
              if (e.target !== searchRef.current) e.preventDefault(); // pressing a row must not pull focus off the trigger
            }}
          >
            {searchable ? (
              <input
                ref={searchRef}
                className="glide-select__search"
                value={query}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoComplete="off"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                  onSearch?.(e.target.value);
                }}
                onKeyDown={(e) => {
                  // Only navigation keys go to the list; everything else, including space, types into the box.
                  if (["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab"].includes(e.key)) onTriggerKey(e);
                }}
              />
            ) : null}
            <div
              id={`${uid}-list`}
              role="listbox"
              aria-multiselectable={multiple || undefined}
              aria-label={ariaLabel}
              className="glide-select__list"
              data-live={active !== null ? "" : undefined}
              onPointerOver={onListOver}
              onPointerLeave={() => {
                if (!scrub.current && !rememberPosition) setActive(null);
              }}
              onPointerDown={onListDown}
              onPointerMove={onListMove}
              onPointerUp={onListUp}
              onPointerCancel={onListUp}
              onLostPointerCapture={onListUp}
            >
              <span ref={pillRef} className="glide-select__pill" aria-hidden="true" />
              {items.map((it, i) => (
                <div key={it.value} id={`${uid}-${i}`} role="option" aria-selected={isOn(it.value)} data-index={i} className="glide-select__option">
                  <span className="glide-select__name">{it.label}</span>
                  {showTags && it.tag ? <span className="glide-select__tag">{it.tag}</span> : null}
                  <span className="glide-select__check" data-on={isOn(it.value) ? "" : undefined} aria-hidden="true">
                    <CheckIcon size={13} strokeWidth={2.5} />
                  </span>
                </div>
              ))}
              {items.length === 0 ? <div className="glide-select__empty">{emptyText}</div> : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`glide-select${className ? ` ${className}` : ""}`}
      data-size={size}
      data-field={field ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      style={{
        "--gs-surface": "var(--popover)", "--gs-highlight": "var(--accent)", "--gs-text": "var(--popover-foreground)", "--gs-accent": "var(--primary)",
        "--gs-radius": `${radius}px`, "--gs-inner-radius": `${Math.max(3, radius - 4)}px`, "--gs-chip": `${S.chip}px`, "--gs-font": `${S.font}px`,
      } as CSSProperties}
      onAnimationEnd={(e) => {
        if (e.animationName === "gs-swap" && rootRef.current) delete rootRef.current.dataset.swap;
      }}
    >
      <button
        ref={triggerRef}
        id={idProp}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={phase === "open"}
        aria-controls={`${uid}-list`}
        aria-activedescendant={active !== null ? `${uid}-${active}` : undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        autoFocus={autoFocus}
        className="glide-select__trigger"
        onPointerDown={(e) => {
          if (e.button !== 0 || disabled) return;
          e.currentTarget.focus({ preventScroll: true });
          if (phase === "open") close("pop");
          else open(false);
        }}
        onKeyDown={onTriggerKey}
      >
        {icon ? <span className="glide-select__icon" aria-hidden="true">{icon}</span> : null}
        <span className="glide-select__label" key={current} data-empty={chosen.length === 0 ? "" : undefined}>
          {chipText}
        </span>
        <span className="glide-select__chevron" aria-hidden="true">
          <ChevronDownIcon size={14} strokeWidth={2.5} />
        </span>
      </button>
      {menu}
    </div>
  );
}
