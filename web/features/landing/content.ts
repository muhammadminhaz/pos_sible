import { SITE } from "@/lib/site";

// ponytail: English-only marketing copy; move to scripts/messages.mjs when a Bangla landing page is wanted.
export const BRAND = SITE.name;

/** Sign-up is only open when the deployment says so, otherwise everyone goes through the sign-in page. */
export const GET_STARTED_HREF = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true" ? "/signup" : "/login";

export const NAV = [
  { href: "#product", label: "Product" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

export const HERO = {
  badge: "New: Opportunities and Goals",
  title: "Run every counter, shelf and taka from one place",
  body: "Fast checkout, stock across branches, purchases, expenses and reports, built for Bangladeshi shops. Works in English and বাংলা.",
  primary: "Get started",
  secondary: "Try the demo",
  trust: "Priced in ৳ BDT. Takes cash, card, bKash, Nagad, Rocket and Upay.",
} as const;

export const BENTO = {
  eyebrow: "Meet POS-sible",
  title: "Everything a shop needs to sell and grow",
  body: "Checkout, stock, purchases, expenses and accounts share one set of books, so every number on screen agrees with the one beside it.",
  cards: [
    { title: "Checkout in seconds", body: "Scan a barcode, split cash and bKash, print a 58 or 80 mm receipt." },
    { title: "Stock in every branch", body: "Per-location stock, transfers, low-stock and expiry alerts." },
    { title: "Sales as they happen", body: "Today's takings, profit and dues update the moment a bill is paid." },
  ],
} as const;

export const STATS = [
  { value: 8, suffix: "", label: "Ways to get paid, from cash to bKash" },
  { value: 7, suffix: "", label: "Modules in one app, from POS to reports" },
  { value: 2, suffix: "", label: "Languages, English and বাংলা" },
  { value: 3, suffix: "", label: "Plans, starting at ৳500 a month" },
] as const;

export const VISIBILITY = {
  title: "See every taka, in every branch",
  body: "Profit by product, branch and day, with books that reconcile with stock to the paisa.",
  points: [
    "Profit and loss by product, category, location or invoice",
    "Dues from customers and to suppliers in one view",
    "CSV export and print on every report",
  ],
  donutTitle: "How customers pay",
  statTitle: "Double-entry books",
  statBody: "Every sale, purchase and expense posts to your accounts automatically.",
} as const;

export const GROWTH = {
  eyebrow: "Inside the app",
  title: "One system from shelf to ledger",
  body: "Ring up a sale, move stock between branches and read the profit report without leaving the app.",
  tabs: [
    { id: "checkout", label: "Checkout", body: "Scan, split payments, suspend and resume bills." },
    { id: "stock", label: "Stock and transfers", body: "Move stock between branches and watch it arrive." },
    { id: "reports", label: "Reports", body: "Profit and loss that ties back to every invoice." },
  ],
} as const;

export const FEATURES = {
  eyebrow: "Key features",
  title: "Core features that run the shop",
  body: "Everything the counter, the stockroom and the back office need, in a single product.",
  items: [
    { icon: "truck", title: "Purchases and suppliers", body: "Receive stock in lots with expiry dates and pay suppliers in parts." },
    { icon: "receipt", title: "Expenses", body: "Categorise rent, wages and bills, repeat the regular ones and record refunds." },
    { icon: "landmark", title: "Accounts", body: "Deposits, transfers, balance sheet and trial balance on the same books." },
    { icon: "shield", title: "Roles and permissions", body: "View, create, update and delete per area, enforced on the server." },
    { icon: "bell", title: "Alerts that matter", body: "Overdue invoices, low or expired stock and transfers stuck in transit." },
    { icon: "languages", title: "English and বাংলা", body: "Switch language any time, with Bangla digits and light or dark themes." },
  ],
} as const;

export const POSSIBLE = {
  eyebrow: "Power pack",
  title: "Shows what is possible next",
  body: "Opportunities read your own sales and tell you where to act this week.",
  items: [
    { title: "Restock in time", body: "Spot the fast sellers that will run out within 7 days." },
    { title: "Win back regulars", body: "Find customers with 2 or more visits who have been away for 45 to 180 days." },
    { title: "Collect old dues", body: "List every invoice left unpaid for over 30 days, oldest first." },
  ],
} as const;

export const HOW = {
  eyebrow: "How it works",
  title: "Up and running in an afternoon",
  body: "Start with sample data or an empty shop, then bring in your own products.",
  steps: [
    { title: "Set up your shop", body: "Import products from a CSV file or add them one by one, with units, tax and barcodes." },
    { title: "Sell at the counter", body: "Scan items, take split payments, suspend a bill and pick it up again." },
    { title: "Review and grow", body: "Check the forecast, set goals and act on the opportunities it finds." },
  ],
} as const;

export const SHOPS = {
  title: "Built for shops like yours",
  body: "Examples of what each kind of shop gets out of the box.",
  items: [
    { kind: "Grocery", title: "Weighing-scale barcodes, expiry lots and FIFO costing.", points: ["Sell loose rice and dal by weight", "Track expiry by lot", "Profit that follows the cost you paid"] },
    { kind: "Phones and electronics", title: "IMEI and serial numbers per unit, with warranties.", points: ["Record the serial on every sale", "Warranty terms per product", "Technician and repair tracking"] },
    { kind: "Pharmacy", title: "Expiry dates on every lot, and no sales of expired stock.", points: ["Near-expiry alerts", "Lot-wise stock", "Stop-sale on expired items"] },
  ],
} as const;

export const PAYMENTS = {
  eyebrow: "Payments",
  title: "Works with how Bangladesh pays",
  body: "Every payment method and device below is built in, so there is nothing to connect or install.",
  items: [
    { name: "Cash", dot: "bg-emerald-500" },
    { name: "Card", dot: "bg-sky-500" },
    { name: "Bank transfer", dot: "bg-slate-500" },
    { name: "Cheque", dot: "bg-amber-500" },
    { name: "bKash", dot: "bg-bkash" },
    { name: "Nagad", dot: "bg-nagad" },
    { name: "Rocket", dot: "bg-rocket" },
    { name: "Upay", dot: "bg-upay" },
    { name: "Barcode scanner", dot: "bg-primary" },
    { name: "Thermal printer", dot: "bg-primary" },
    { name: "Weighing scale", dot: "bg-primary" },
    { name: "CSV import and export", dot: "bg-primary" },
  ],
} as const;

/** Mirrors the seeded rows in api/lib/server/schema.ts; content.test.ts fails if they drift. */
export const PLANS = [
  { id: "starter", label: "Starter", users: 3, price: 500, blurb: "For a single counter getting started.", usersLabel: "Up to 3 users" },
  { id: "standard", label: "Standard", users: 10, price: 1500, blurb: "For a shop with a team and a few branches.", usersLabel: "Up to 10 users", featured: true },
  { id: "premium", label: "Premium", users: null, price: 3000, blurb: "For growing chains with no user limit.", usersLabel: "Unlimited users" },
] as const;

export const PLAN_FEATURES = [
  "All 7 modules included",
  "English and বাংলা",
  "Role-based permissions",
  "Your data kept apart from other shops",
] as const;

export const PRICING = {
  eyebrow: "Pricing",
  title: "Simple plans in ৳ BDT",
  note: "Pay by bKash or bank transfer. Your account is switched on when payment arrives.",
  best: "Best for most shops",
} as const;

export const FAQ = {
  title: "Got questions?",
  body: "Short answers about payments, language, branches and getting your data in.",
  items: [
    { q: "Which payments can I take?", a: "Cash, card, bank transfer, cheque, bKash, Nagad, Rocket and Upay. You can split one bill across several methods." },
    { q: "Does it work in Bangla?", a: "Yes. Every screen is available in English and বাংলা, and you can switch at any time." },
    { q: "Can I run more than one branch?", a: "Yes. Stock is tracked per location, and you can transfer stock between branches and follow it until it arrives." },
    { q: "Can staff have limited access?", a: "Yes. Give each person view, create, update or delete rights per area. The server enforces them, not just the screen." },
    { q: "Can I import my products?", a: "Yes. Upload a CSV file, check the preview and import. You can also export any report as CSV." },
    { q: "How do I pay for a plan?", a: "Pay by bKash or bank transfer. Your account is switched on when the payment arrives." },
    { q: "Is my data separate from other shops?", a: "Yes. Every shop's data is kept apart from every other shop's." },
  ],
} as const;

export const TOUR = {
  eyebrow: "Take a tour",
  title: "More than a till",
  cards: [
    { title: "Opportunities and Goals", body: "Weekly actions picked from your own sales, and targets you can track." },
    { title: "Analytics", body: "Heatmaps, the 80/20 view of your products and a list of dead stock." },
    { title: "Teams and roles", body: "Invite staff, choose what each person can do and see who did what." },
  ],
} as const;

export const CTA = {
  title: "Open your shop on POS-sible",
  body: "Start selling today, in English or বাংলা.",
  action: "Get started",
} as const;

export const FOOTER = {
  blurb: "Point of sale, inventory and accounting for retail shops in Bangladesh.",
  columns: [
    { title: "Product", links: [{ href: "#features", label: "Features" }, { href: "#pricing", label: "Pricing" }, { href: "#faq", label: "FAQ" }] },
    { title: "App", links: [{ href: "/login", label: "Sign in" }, { href: GET_STARTED_HREF, label: "Get started" }, { href: "/login", label: "Try the demo" }] },
  ],
} as const;
