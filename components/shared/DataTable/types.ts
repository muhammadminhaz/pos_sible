import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Plain-text label for the column menu and CSV header (defaults to a string `header`). */
    label?: string;
    align?: "left" | "right" | "center";
    /** Value written to CSV; defaults to the accessor value. Return `undefined` to skip the column. */
    csv?: (row: TData) => unknown;
    className?: string;
  }
}

export type TableQuery = { page: number; pageSize: number; search: string; sort?: { id: string; desc: boolean } };
