import { describe, expect, it } from "vitest";
import { AppError, BelowMinPriceError, CreditLimitError, deserializeError, EditWindowExpiredError, ForbiddenError, InsufficientStockError, NotFoundError, ProductUnavailableError, SerialsRequiredError, serializeError, ValidationError } from "./errors";

describe("errors cross the network as the same classes", () => {
  const cases: [string, Error, (e: Error) => void][] = [
    ["forbidden", new ForbiddenError("sell.create"), (e) => expect((e as ForbiddenError).permission).toBe("sell.create")],
    ["validation", new ValidationError({ username: "duplicate" }), (e) => expect((e as ValidationError).fields).toEqual({ username: "duplicate" })],
    ["stock", new InsufficientStockError("Tea", 3), (e) => expect([(e as InsufficientStockError).productName, (e as InsufficientStockError).available]).toEqual(["Tea", 3])],
    ["credit", new CreditLimitError(), () => {}],
    ["window", new EditWindowExpiredError(), () => {}],
    ["notfound", new NotFoundError("Order"), (e) => expect(e.message).toMatch(/Order/)],
    ["serials", new SerialsRequiredError("Phone", 2), (e) => expect((e as SerialsRequiredError).count).toBe(2)],
    ["unavailable", new ProductUnavailableError("Fan"), (e) => expect((e as ProductUnavailableError).productName).toBe("Fan")],
    ["minprice", new BelowMinPriceError("Fan"), (e) => expect((e as BelowMinPriceError).productName).toBe("Fan")],
    ["app", new AppError("nope", "order_in_use"), (e) => expect((e as AppError).code).toBe("order_in_use")],
  ];
  for (const [name, err, extra] of cases) {
    it(name, () => {
      const back = deserializeError(JSON.parse(JSON.stringify(serializeError(err))));
      expect(back.constructor).toBe(err.constructor);
      expect((back as AppError).code).toBe((err as AppError).code);
      extra(back);
    });
  }
  it("hides the details of unexpected errors", () => {
    expect(serializeError(new TypeError("secret path /etc/passwd"))).toEqual({ name: "Error", code: "internal", message: "Something went wrong on the server." });
  });
});
