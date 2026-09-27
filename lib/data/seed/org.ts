import {
  account, accountType, barcodeSetting, contact, customerGroup, discount, expenseCategory, invoiceLayout,
  invoiceScheme, location, printer, role, technician, user,
  type Account, type AccountType, type BarcodeSetting, type Contact, type CustomerGroup, type Discount,
  type ExpenseCategory, type InvoiceLayout, type InvoiceScheme, type Location, type Printer, type Product,
  type Role, type Technician, type User,
} from "@/lib/data/schemas";
import { addDays, format, parseISO, subDays } from "date-fns";
import type { z } from "zod";
import { PG } from "./catalog";
import { LOC_NIPUN, LOC_RANGO, mk, SEED_USER, WALK_IN } from "./mk";
import { address, CUSTOMER_BUSINESSES, mobile, personName, SUPPLIER_BUSINESSES } from "./names";
import type { Rng } from "./rng";

export const ACC = { cash: "acc_cash", bkash: "acc_bkash", nagad: "acc_nagad", bank: "acc_city" };
export const ROLE = { admin: "role_admin", manager: "role_manager", cashier: "role_cashier" };
export const SCHEME = { default: "scheme_default", haque: "scheme_haque" };
export const LAYOUT = { classic: "layout_classic", receipt: "layout_receipt", a4: "layout_a4" };

const PAYMENT_METHODS = ["cash", "card", "cheque", "bank_transfer", "other", "custom_pay_1", "custom_pay_2", "custom_pay_3", "custom_pay_4"] as const;
const DEFAULT_ACCOUNTS = {
  cash: ACC.cash, card: ACC.bank, cheque: ACC.bank, bank_transfer: ACC.bank, other: null,
  custom_pay_1: ACC.bkash, custom_pay_2: ACC.nagad, custom_pay_3: null, custom_pay_4: null,
};

export const MANAGER_PERMISSIONS = [
  "dashboard.view", "contacts.supplier", "contacts.customer", "customer_group.view", "product.view", "product.create",
  "product.update", "product.delete", "purchase.view", "purchase.create", "sell.view", "sell.create", "sell.update",
  "pos.access", "stock_transfer.view", "stock_adjustment.view", "expense.view", "expense.create", "account.view",
  "report.view", "settings.barcode", "settings.printer",
];
export const CASHIER_PERMISSIONS = ["dashboard.view", "contacts.customer", "product.view", "sell.view", "sell.create", "pos.access"];

export type Org = {
  locations: Location[];
  roles: Role[];
  users: User[];
  contacts: Contact[];
  customerGroups: CustomerGroup[];
  technicians: Technician[];
  accountTypes: AccountType[];
  accounts: Account[];
  expenseCategories: ExpenseCategory[];
  invoiceSchemes: InvoiceScheme[];
  invoiceLayouts: InvoiceLayout[];
  barcodeSettings: BarcodeSetting[];
  printers: Printer[];
};

export function createOrg(r: Rng, createdAt: string): Org {
  const base = { createdAt, createdBy: SEED_USER };

  const locations = [
    mk(location, {
      ...base, id: LOC_RANGO, code: "BL0001", name: "Rango Electronics", landmark: "Opposite Mirpur 10 Metro Station",
      address: { line1: "Shop 12, Shah Ali Plaza", line2: "Mirpur 10", city: "Dhaka", state: "Dhaka", country: "Bangladesh", zip: "1216" },
      mobile: "01711223344", email: "rango@sarkarpos.com.bd", priceGroupId: null,
      invoiceSchemeId: SCHEME.default, posLayoutId: LAYOUT.receipt, saleLayoutId: LAYOUT.classic,
      paymentMethods: [...PAYMENT_METHODS], defaultAccounts: DEFAULT_ACCOUNTS, active: true,
    }),
    mk(location, {
      ...base, id: LOC_NIPUN, code: "BL0003", name: "Nipun Poultry & Fish Feed", landmark: "Bhaluka Bazar",
      address: { line1: "Holding 45, Dhaka-Mymensingh Highway", line2: "Bhaluka", city: "Mymensingh", state: "Mymensingh", country: "Bangladesh", zip: "2240" },
      mobile: "01819556677", email: "nipun@sarkarpos.com.bd", priceGroupId: null,
      invoiceSchemeId: SCHEME.haque, posLayoutId: LAYOUT.receipt, saleLayoutId: LAYOUT.a4,
      paymentMethods: [...PAYMENT_METHODS], defaultAccounts: DEFAULT_ACCOUNTS, active: true,
    }),
  ];

  const roles = [
    mk(role, { ...base, id: ROLE.admin, name: "Admin", permissions: ["*"] }),
    mk(role, { ...base, id: ROLE.manager, name: "Manager", permissions: MANAGER_PERMISSIONS }),
    mk(role, { ...base, id: ROLE.cashier, name: "Cashier", permissions: CASHIER_PERMISSIONS }),
  ];

  const staff: [string, string, string, string, string[], boolean, number][] = [
    // id, username, first, last, locations, salesAgent, commission%
    ["user_manager", "rafiq", "Rafiq", "Islam", [], false, 0],
    ["user_nipun", "nazmul", "Nazmul", "Haque", [LOC_NIPUN], false, 0],
    ["user_sales1", "sabbir", "Sabbir", "Ahmed", [LOC_RANGO], true, 2],
    ["user_sales2", "farzana", "Farzana", "Akter", [LOC_RANGO], true, 1.5],
    ["user_sales3", "liton", "Liton", "Das", [LOC_NIPUN], true, 1],
    ["user_tech", "shuvo", "Shuvo", "Talukder", [LOC_RANGO], false, 0],
  ];
  const users = [
    mk(user, {
      ...base, createdBy: null, id: SEED_USER, username: "admin", password: "112233", prefix: "Mr", firstName: "Mahmud",
      lastName: "Sarkar", email: "admin@sarkarpos.com.bd", roleId: ROLE.admin, profile: { mobile: "01711000001" },
    }),
    mk(user, {
      ...base, id: "user_cashier", username: "cashier", password: "112233", firstName: "Rubel", lastName: "Hossain",
      email: "cashier@sarkarpos.com.bd", roleId: ROLE.cashier, locationIds: [LOC_RANGO], profile: { mobile: "01711000002" },
    }),
    ...staff.map(([id, username, firstName, lastName, locationIds, isSalesAgent, commissionPercent], i) =>
      mk(user, {
        ...base, id, username, password: "112233", firstName, lastName, email: `${username}@sarkarpos.com.bd`,
        roleId: i === 0 ? ROLE.manager : ROLE.cashier, locationIds, isSalesAgent, commissionPercent,
        profile: { mobile: mobile(r) },
      }),
    ),
  ];

  const customerGroups = [
    mk(customerGroup, { ...base, id: "cg_retail", name: "Retail", calcType: "percentage", amount: 0 }),
    mk(customerGroup, { ...base, id: "cg_wholesale", name: "Wholesale", calcType: "selling_price_group", priceGroupId: PG.wholesale }),
    mk(customerGroup, { ...base, id: "cg_dealer", name: "Dealer", calcType: "selling_price_group", priceGroupId: PG.dealer }),
    mk(customerGroup, { ...base, id: "cg_vip", name: "VIP", calcType: "percentage", amount: -3 }),
  ];

  const technicians = ["Shuvo Talukder", "Apu Mollah", "Mithu Sheikh"].map((name, i) =>
    mk(technician, { ...base, id: `tech_${i + 1}`, name }),
  );

  let code = 0;
  const nextCode = () => `CO${String(++code).padStart(4, "0")}`;
  const contacts: Contact[] = [
    mk(contact, {
      ...base, id: WALK_IN, code: nextCode(), type: "customer", name: "Walk-In Customer", mobile: "01700000000",
      address: { line1: "", line2: "", city: "", state: "", country: "Bangladesh", zip: "" }, isDefault: true,
    }),
  ];
  SUPPLIER_BUSINESSES.forEach((biz, i) => {
    const p = personName(r);
    contacts.push(
      mk(contact, {
        ...base, id: `sup_${String(i + 1).padStart(2, "0")}`, code: nextCode(), type: "supplier", kind: "business",
        businessName: biz, name: `${p.first} ${p.last}`, mobile: mobile(r), email: r.chance(0.5) ? `sales${i + 1}@supplier.com.bd` : "",
        taxNumber: r.chance(0.6) ? String(r.int(100000000, 999999999)) : "",
        payTerm: r.chance(0.6) ? { number: r.pick([15, 30, 45]), type: "days" } : null,
        openingBalance: r.chance(0.25) ? r.money(5000, 60000) : 0,
        address: address(r),
      }),
    );
  });
  for (let i = 0; i < 38; i++) {
    const p = personName(r);
    const biz = i < CUSTOMER_BUSINESSES.length ? CUSTOMER_BUSINESSES[i] : "";
    const group = biz ? r.pick(["cg_wholesale", "cg_dealer"]) : r.chance(0.15) ? "cg_vip" : r.chance(0.5) ? "cg_retail" : null;
    contacts.push(
      mk(contact, {
        ...base, id: `cus_${String(i + 1).padStart(2, "0")}`, code: nextCode(), type: "customer",
        kind: biz ? "business" : "individual", businessName: biz, prefix: r.chance(0.3) ? "Mr" : "",
        name: `${p.first} ${p.last}`, mobile: mobile(r), email: r.chance(0.3) ? `${p.first.toLowerCase()}${i}@gmail.com` : "",
        customerGroupId: group,
        payTerm: biz ? { number: 30, type: "days" } : null,
        creditLimit: biz ? r.pick([50000, 100000, 200000]) : null,
        openingBalance: r.chance(0.15) ? r.money(1000, 20000) : 0,
        dob: r.chance(0.3) ? `19${r.int(70, 99)}-${String(r.int(1, 12)).padStart(2, "0")}-${String(r.int(1, 28)).padStart(2, "0")}` : null,
        address: address(r),
      }),
    );
  }
  for (let i = 0; i < 2; i++) {
    const p = personName(r);
    contacts.push(
      mk(contact, {
        ...base, id: `both_${i + 1}`, code: nextCode(), type: "both", kind: "business",
        businessName: ["Sarkar Agro Traders", "Haque Electronics Mart"][i], name: `${p.first} ${p.last}`, mobile: mobile(r),
        payTerm: { number: 30, type: "days" }, address: address(r),
      }),
    );
  }

  const accountTypes = [
    mk(accountType, { ...base, id: "at_assets", name: "Current Assets" }),
    mk(accountType, { ...base, id: "at_cash", name: "Cash in Hand", parentId: "at_assets" }),
    mk(accountType, { ...base, id: "at_mfs", name: "Mobile Banking", parentId: "at_assets" }),
    mk(accountType, { ...base, id: "at_bank", name: "Bank Accounts" }),
  ];
  const accounts = [
    mk(account, { ...base, id: ACC.cash, name: "Cash", typeId: "at_cash", number: "CASH-01", openingBalance: 50000 }),
    mk(account, { ...base, id: ACC.bkash, name: "bKash Merchant", typeId: "at_mfs", number: "01711223344", openingBalance: 15000, details: [{ label: "Type", value: "Merchant" }] }),
    mk(account, { ...base, id: ACC.nagad, name: "Nagad Merchant", typeId: "at_mfs", number: "01819556677", openingBalance: 8000 }),
    mk(account, {
      ...base, id: ACC.bank, name: "City Bank", typeId: "at_bank", number: "1502 3345 6789 001", openingBalance: 450000,
      details: [{ label: "Branch", value: "Mirpur" }, { label: "Routing", value: "225263195" }],
    }),
  ];

  const expenseCategories = (
    [
      ["exp_rent", "Rent", null], ["exp_utility", "Utilities", null], ["exp_electricity", "Electricity", "exp_utility"],
      ["exp_water", "Water", "exp_utility"], ["exp_internet", "Internet", "exp_utility"], ["exp_salary", "Salaries", null],
      ["exp_transport", "Transport & Delivery", null], ["exp_maintenance", "Maintenance", null], ["exp_marketing", "Marketing", null],
      ["exp_office", "Office Supplies", null], ["exp_snacks", "Tea & Snacks", null],
    ] as const
  ).map(([id, name, parentId], i) => mk(expenseCategory, { ...base, id, name, code: `EC${i + 1}`, parentId }));

  const invoiceSchemes = [
    mk(invoiceScheme, { ...base, id: SCHEME.default, name: "Default", prefix: "", numberingType: "sequential", digits: 4, isDefault: true }),
    mk(invoiceScheme, { ...base, id: SCHEME.haque, name: "Haque", prefix: "HQ-", numberingType: "sequential", digits: 5 }),
  ];
  const invoiceLayouts = [
    mk(invoiceLayout, { ...base, id: LAYOUT.classic, name: "Classic", design: "classic", paper: "a4", footerText: "Thank you for shopping with us.", isDefault: true, showBrand: true, showWarranty: true }),
    mk(invoiceLayout, { ...base, id: LAYOUT.receipt, name: "Compact receipt", design: "slim", paper: "80mm", footerText: "Goods once sold are not returnable without receipt.", showBarcode: true }),
    mk(invoiceLayout, { ...base, id: LAYOUT.a4, name: "A4 detailed", design: "detailed", paper: "a4", showEmail: true, showTax1: true, showPreviousDue: true, showSignature: true, showQrCode: true }),
  ];

  const bs = (id: string, name: string, x: Omit<z.input<typeof barcodeSetting>, "id" | "name" | "createdAt" | "createdBy">) =>
    mk(barcodeSetting, { ...base, id, name, ...x });
  const sheet = { paperWidth: 8.5, paperHeight: 11 };
  const barcodeSettings = [
    bs("bc_20", "20 Labels per Sheet", { ...sheet, description: "Sheet Size: 8.5\" x 11\", Label Size: 4\" x 1\", Labels per sheet: 20", labelWidth: 4, labelHeight: 1, topMargin: 0.5, leftMargin: 0.125, rowDistance: 0, colDistance: 0.1875, perRow: 2, perSheet: 20, isDefault: true }),
    bs("bc_30", "30 Labels per sheet", { ...sheet, description: "Sheet Size: 8.5\" x 11\", Label Size: 2.625\" x 1\", Labels per sheet: 30", labelWidth: 2.625, labelHeight: 1, topMargin: 0.5, leftMargin: 0.1875, colDistance: 0.125, perRow: 3, perSheet: 30 }),
    bs("bc_32", "32 Labels per sheet", { ...sheet, description: "Sheet Size: 8.5\" x 11\", Label Size: 2\" x 1.25\", Labels per sheet: 32", labelWidth: 2, labelHeight: 1.25, topMargin: 0.5, leftMargin: 0.25, rowDistance: 0, colDistance: 0, perRow: 4, perSheet: 32 }),
    bs("bc_40", "40 Labels per sheet", { ...sheet, description: "Sheet Size: 8.5\" x 11\", Label Size: 2\" x 1\", Labels per sheet: 40", labelWidth: 2, labelHeight: 1, topMargin: 0.3, leftMargin: 0.25, rowDistance: 0, colDistance: 0, perRow: 4, perSheet: 40 }),
    bs("bc_50", "50 Labels per Sheet", { ...sheet, description: "Sheet Size: 8.5\" x 11\", Label Size: 1.5\" x 1\", Labels per sheet: 50", labelWidth: 1.5, labelHeight: 1, topMargin: 0.5, leftMargin: 0.5, rowDistance: 0, colDistance: 0, perRow: 5, perSheet: 50 }),
    bs("bc_roll", "Continuous Rolls - 31.75mm x 25.4mm", { paperWidth: 1.25, paperHeight: null, isContinuous: true, description: "Label Size: 31.75mm x 25.4mm, Gap: 3.18mm", labelWidth: 1.25, labelHeight: 1, rowDistance: 0.125, perRow: 1, perSheet: null }),
  ];

  const printers = [
    mk(printer, { ...base, id: "printer_counter", name: "Counter Printer", connectionType: "network", capabilityProfile: "default", charPerLine: 42, ip: "192.168.0.50", port: "9100" }),
  ];

  return {
    locations, roles, users, contacts, customerGroups, technicians, accountTypes, accounts, expenseCategories,
    invoiceSchemes, invoiceLayouts, barcodeSettings, printers,
  };
}

export function createDiscounts(products: Product[], today: string, createdAt: string): Discount[] {
  const base = { createdAt, createdBy: SEED_USER };
  const d = (n: number) => format(addDays(parseISO(today), n), "yyyy-MM-dd'T'HH:mm:ss");
  const accessories = products.filter((p) => p.categoryId === "cat_acc").slice(0, 3).map((p) => p.id);
  return [
    mk(discount, { ...base, id: "disc_walton", name: "Walton Festival Offer", locationId: LOC_RANGO, brandId: "brand_walton", priority: 2, type: "percentage", amount: 5, startsAt: d(-10), endsAt: d(20) }),
    mk(discount, { ...base, id: "disc_feed_bulk", name: "Poultry Feed Bulk Discount", locationId: LOC_NIPUN, categoryId: "cat_poultry", priority: 1, type: "fixed", amount: 2, startsAt: d(-30), endsAt: d(60) }),
    mk(discount, { ...base, id: "disc_clearance", name: "Accessories Clearance", locationId: null, productIds: accessories, priority: 3, type: "percentage", amount: 10, startsAt: format(subDays(parseISO(today), 90), "yyyy-MM-dd'T'00:00:00"), endsAt: d(-60), active: false }),
  ];
}
