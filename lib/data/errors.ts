export class AppError extends Error {
  constructor(
    message: string,
    public code: string = "app_error",
  ) {
    super(message);
    this.name = new.target.name;
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
