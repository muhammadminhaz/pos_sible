export class AppError extends Error {
  constructor(
    message: string,
    public code: string = "app_error",
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ForbiddenError extends AppError {
  constructor(public permission: string) {
    super(`Missing permission: ${permission}`, "forbidden");
  }
}

export class ValidationError extends AppError {
  constructor(
    public fields: Record<string, string>,
    message = "Please fix the highlighted fields.",
  ) {
    super(message, "validation");
  }
}

export class InsufficientStockError extends AppError {
  constructor(
    public productName: string,
    public available: number,
  ) {
    super(`Only ${available} of ${productName} in stock.`, "insufficient_stock");
  }
}

export class CreditLimitError extends AppError {
  constructor(message = "This sale exceeds the customer's credit limit.") {
    super(message, "credit_limit");
  }
}

export class EditWindowExpiredError extends AppError {
  constructor(message = "This transaction is older than the allowed edit window.") {
    super(message, "edit_window_expired");
  }
}

export class NotFoundError extends AppError {
  constructor(what = "Record") {
    super(`${what} not found.`, "not_found");
  }
}

export class SerialsRequiredError extends AppError {
  constructor(
    public productName: string,
    public count: number,
  ) {
    super(`Enter ${count} serial numbers for ${productName}.`, "serials_required");
  }
}

export class ProductUnavailableError extends AppError {
  constructor(public productName: string) {
    super(`${productName} is no longer available.`, "product_unavailable");
  }
}

export class BelowMinPriceError extends AppError {
  constructor(public productName: string) {
    super(`${productName} can't be sold below its minimum price.`, "below_min_price");
  }
}

// ---- Crossing the network: errors travel as plain objects and come back as the same classes -----------------------

export type WireError = {
  name: string; code: string; message: string;
  fields?: Record<string, string>; permission?: string; productName?: string; available?: number; count?: number;
};

/** Class names are mangled in production bundles, so each error type is named explicitly on the wire. */
function wireName(e: AppError): string {
  if (e instanceof ForbiddenError) return "ForbiddenError";
  if (e instanceof ValidationError) return "ValidationError";
  if (e instanceof InsufficientStockError) return "InsufficientStockError";
  if (e instanceof CreditLimitError) return "CreditLimitError";
  if (e instanceof EditWindowExpiredError) return "EditWindowExpiredError";
  if (e instanceof NotFoundError) return "NotFoundError";
  if (e instanceof SerialsRequiredError) return "SerialsRequiredError";
  if (e instanceof ProductUnavailableError) return "ProductUnavailableError";
  if (e instanceof BelowMinPriceError) return "BelowMinPriceError";
  return "AppError";
}

export function serializeError(e: unknown): WireError {
  if (e instanceof AppError) {
    const o = e as AppError & Partial<WireError>;
    return { name: wireName(e), code: e.code, message: e.message, fields: o.fields, permission: o.permission, productName: o.productName, available: o.available, count: o.count };
  }
  return { name: "Error", code: "internal", message: "Something went wrong on the server." };
}

export function deserializeError(w: WireError): Error {
  switch (w.name) {
    case "ForbiddenError": return new ForbiddenError(w.permission ?? "");
    case "ValidationError": return new ValidationError(w.fields ?? {}, w.message);
    case "InsufficientStockError": return new InsufficientStockError(w.productName ?? "", w.available ?? 0);
    case "CreditLimitError": return new CreditLimitError(w.message);
    case "EditWindowExpiredError": return new EditWindowExpiredError(w.message);
    case "NotFoundError": return Object.assign(new NotFoundError(), { message: w.message });
    case "SerialsRequiredError": return new SerialsRequiredError(w.productName ?? "", w.count ?? 0);
    case "ProductUnavailableError": return new ProductUnavailableError(w.productName ?? "");
    case "BelowMinPriceError": return new BelowMinPriceError(w.productName ?? "");
    case "AppError": return new AppError(w.message, w.code);
    default: return new Error(w.message);
  }
}
