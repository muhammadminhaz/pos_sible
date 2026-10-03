/** Every combination of the chosen values, e.g. [["S","M"],["Red"]] → ["S / Red", "M / Red"]. Empty dimensions are ignored. */
export function combinations(dimensions: string[][]): string[] {
  return dimensions
    .filter((d) => d.length > 0)
    .reduce<string[]>((acc, values) => (acc.length ? acc.flatMap((a) => values.map((v) => `${a} / ${v}`)) : values), []);
}
