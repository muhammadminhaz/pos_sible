# Product.md — Sarkar POS (demo.posghor.com)

> Product inventory of the **Sarkar POS** web app (branded "Pos" / "Sarkar Pos", footer: *Developed By Sarkar IT*), based on a logged-in crawl of https://demo.posghor.com as `admin` on 2026-09-27.
> The app is a Laravel + AdminLTE/Bootstrap 3 build of **UltimatePOS**. It's a multi-location, multi-user retail POS and inventory system with accounting, aimed at Bangladeshi SMEs (currency ৳ BDT, bKash/Nagad/Rocket/Upay payments, "Inside Dhaka / Outside Dhaka" shipping zones).
>
> 72 pages were crawled. All returned HTTP 200 except **Customer Groups** (`/customer-group`), which returned 403 for this user.

---

## 1. Product overview

| Aspect | Details |
|---|---|
| Type | Web-based point of sale plus inventory, purchasing, CRM-lite, expenses, accounting, and reporting |
| Tenancy | One business with many **Business Locations** (demo has 2: *Rango Electronics (BL0001)* and *Nipun Poultry and Fish Feed (BL0003)*) |
| Users | Many users, and each record stores who added it. Users can be assigned to contacts, and there are sales commission agents, delivery persons, and service staff |
| Currency / locale | BDT (৳), dd/mm/yyyy dates, 12h time. Many UI languages (English, Spanish, Albanian, Hindi, Dutch, French, German, Arabic, …) |
| Local payment methods | Advance, Cash, Card, Cheque, Bank Transfer, Other, plus custom methods (Nagad, Bkash, Rocket, Upay, Nagad Merchant, Bkash Merchant) |
| Payment accounts | Bkash, Nagad (demo) |
| Industries served | Electronics, feed and grocery (units such as `bag (1bag=50KG)`, `Dram (1 Dram=185KG)`), repair shops (**Technicians**), and restaurants (tables, modifiers, kitchen, service staff; these modules can be toggled) |

### Core domain objects
- **Contact**: a Supplier, a Customer, or Both. Contacts can belong to a Customer Group and carry pay terms, credit limit, opening balance, advance balance, reward points, and 10 custom fields
- **Product**: Single, Variable, or Combo. Has a unit and sub-units, brand, category and sub-category, locations, tax, SKU, barcode type, expiry, warranty, IMEI/serial numbers, and images
- **Transaction** types: Purchase, Purchase Return, Sale (Final / Draft / Quotation / Proforma), Sales Order, Sell Return, Stock Transfer, Stock Adjustment, Expense
- **Payment**: belongs to a transaction and can post to a Payment Account
- **Register**: cash register session (open/close) per user and location
- **Settings entities**: Business Location, Invoice Scheme, Invoice Layout, Barcode sheet setting, Receipt Printer, Tax Rate / Tax Group, Selling Price Group, Unit, Category, Brand, Warranty, Variation template, Expense Category, Discount

---

## 2. Global layout and navigation

**Top header (purple bar):** Brand ("Sarkar Pos") · sidebar toggle ☰ · **Calendar** · **Calculator** popup · **SALE / POS** button that opens the POS screen · **Today's profit** popup · Notifications (bell) · user menu (display name) → **Profile**, **Sign Out**.

**Footer:** "Pos | Copyright © 2026 All rights reserved. | Developed By Sarkar IT"

**Sidebar menu (full tree):**

```
Home
Contacts
  ├ Suppliers                 /contacts?type=supplier
  ├ Customers                 /contacts?type=customer
  ├ Customer Groups           /customer-group            (403 for admin)
  ├ Technicians               /order/reciever
  └ Import Contacts           /contacts/import
Products
  ├ List Products             /products
  ├ Add Product               /products/create
  ├ Update Price              /update-product-price
  ├ Print Labels              /labels/show
  ├ Variations                /variation-templates
  ├ Import Products           /import-products
  ├ Import Opening Stock      /import-opening-stock
  ├ Selling Price Group       /selling-price-group
  ├ Units                     /units
  ├ Categories                /taxonomies?type=product
  ├ Brands                    /brands
  └ Warranties                /warranties
Purchases
  ├ List Purchases            /purchases
  ├ Add Purchase              /purchases/create
  └ List Purchase Return      /purchase-return
Sell
  ├ Sales Order               /sales-order
  ├ All sales                 /sells
  ├ Add Sale                  /sells/create
  ├ List POS                  /pos
  ├ POS                       /pos/create
  ├ Add Draft                 /sells/create?status=draft
  ├ List Drafts               /sells/drafts
  ├ Add Quotation             /sells/create?status=quotation
  ├ List quotations           /sells/quotations
  ├ List Sell Return          /sell-return
  ├ Shipments                 /shipments
  ├ Discounts                 /discount
  └ Import Sales              /import-sales
Stock Transfers
  └ Add Stock Transfer        /stock-transfers/create
Stock Adjustment
  └ Add Stock Adjustment      /stock-adjustments/create
Expenses
  ├ List Expenses             /expenses
  ├ Add Expense               /expenses/create
  └ Expense Categories        /expense-categories
Payment Accounts
  ├ List Accounts             /account/account
  ├ Balance Sheet             /account/balance-sheet
  ├ Trial Balance             /account/trial-balance
  ├ Cash Flow                 /account/cash-flow
  └ Payment Account Report    /account/payment-account-report
Reports
  ├ Profit / Loss Report      /reports/profit-loss
  ├ Purchase & Sale           /reports/purchase-sell
  ├ Tax Report                /reports/tax-report
  ├ Supplier & Customer Report/reports/customer-supplier
  ├ Customer Groups Report    /reports/customer-group
  ├ Stock Report              /reports/stock-report
  ├ Stock Expiry Report       /reports/stock-expiry
  ├ Stock Adjustment Report   /reports/stock-adjustment-report
  ├ Trending Products         /reports/trending-products
  ├ Items Report              /reports/items-report
  ├ Product Purchase Report   /reports/product-purchase-report
  ├ Product Sell Report       /reports/product-sell-report
  ├ Purchase Payment Report   /reports/purchase-payment-report
  ├ Sell Payment Report       /reports/sell-payment-report
  ├ Expense Report            /reports/expense-report
  ├ Register Report           /reports/register-report
  ├ Sales Representative Rpt  /reports/sales-representative-report
  └ Table Report              /reports/table-report
Administer Backup             /backup
Modules                       /manage-modules
Settings
  ├ Business Settings         /business/settings
  ├ Business Locations        /business-location
  ├ Invoice Settings          /invoice-schemes
  ├ Barcode Settings          /barcodes
  ├ Receipt Printers          /printers
  └ Tax Rates                 /tax-rates
```

Also reachable: `/calendar`, `/user/profile`.

> **Missing from this user's menu:** User Management (users, roles, sales commission agents), plus list pages for Stock Transfers and Stock Adjustments. Only the "Add" pages are linked, but the Stock Adjustment *Report* lists adjustments.

### Common UI patterns
- **List pages** use a collapsible **Filters** box, then a DataTables grid with server-side paging, search, column visibility, and export when enabled. Default page size is configurable (25 to All). Each row has an **Action** dropdown (View / Edit / Delete / Payments / Print …)
- **Add/Edit** is either a full page (transactions, products) or a **modal** (units, brands, categories, tax rates, etc.)
- **Shared modals:**
  - *Add a new contact*: available from purchase and sale screens
  - *Add payment*: amount, paid on, method, account, and method-specific fields (card number/holder/type/month/year/CVV, cheque no., bank account no., 7 custom transaction-no. fields), plus a note
  - *Change return*: method and account used to return change
- **Date range pickers** with presets on most lists and reports
- **Location filter** on nearly every list and report ("All locations" or a specific one)
- **Imports** follow one pattern: Download template file → upload CSV/XLSX → Submit, with an Instructions table describing the columns

---

## 3. Modules and features

### 3.1 Home / Dashboard (`/home`)
- Greeting ("Welcome <name>"), a **location selector**, and **Filter by date** (date range)
- KPI tiles: **Total Sales**, **Net**, **Invoice Due**, **Total Sell Return**, **Total Purchase**, **Purchase Due**, **Total Purchase Return**, **Expense**
- Upstream UltimatePOS also shows sales charts, a stock alert list, and due tables when permissions allow. These were not rendered for this user.

### 3.2 Contacts
**Suppliers / Customers** (`/contacts?type=…`)
- Filters: Purchase Due / Sell Due, Purchase Return / Sell Return, Advance Balance, Opening Balance (checkboxes). Also *Has no sell from* (1/3/6/12 months), Customer Group, Assigned to (user), Status (Active/Inactive)
- Supplier columns: Contact ID, Business Name, Name, Email, Tax number, Pay term, Opening Balance, Advance Balance, Added On, Address, Mobile, Total Purchase Due, Total Purchase Return Due, Custom Field 1–10
- Customer columns: all of the supplier columns plus Credit Limit, **Point** (reward points), Customer Group, Total Sale Due, Total Sell Return Due
- **Add / Edit contact form:** Contact type (Supplier / Customer / Both), Individual vs Business, Customer Group, Business Name, Prefix, Full Name*, Mobile*, Alternate number, Email, DOB, CRM Source, CRM Life Stage, Assigned to (users), Tax number, Opening Balance, Pay term (number + Days/Months), Credit Limit, Address line 1/2, City, State, Country, Zip, Shipping address, Custom Field 1–10

**Customer Groups** (`/customer-group`): returns 403 for this user. Customer groups exist anyway (e.g. "5%", "Daimond") and are used for group pricing and discounts.

**Technicians** (`/order/reciever`): a custom Sarkar addition. It's a simple list of technician names with Add, Save, and Delete. Technicians can be picked on the POS screen ("Select Technician"), which suits repair and service shops.

**Import Contacts**: CSV/XLSX upload with a template.

### 3.3 Products
**List Products** (`/products`)
- Tabs: **All Products** | **Stock Report**
- Filters: Product Type (Single/Variable/Combo), Category, Unit, Tax, Brand, Business Location, Active state, Not for selling
- Columns: checkbox, image, Action, Product, Business Location, Unit Purchase Price, Selling Price, Current stock, Product Type, Category, Brand, Tax, SKU, custom fields
- Bulk actions: **Delete Selected**, **Add to location**, **Remove from location**, **Deactivate Selected**
- Row actions (typical): Labels, View, Edit, Delete, Add/Edit Opening Stock, Product stock history, Duplicate

**Add / Edit Product** (`/products/create`)
- Basic: Product Name*, SKU (auto if blank, with an SKU prefix), Barcode Type* (C128, C39, EAN-13, EAN-8, UPC-A, UPC-E), Unit*, Related Sub Units, Brand, Category, Sub category, Business Locations (multi), Manage Stock? plus Alert quantity, Description (rich text), Image, Brochure
- Advanced: Expires in (number + Months/Days/N/A), Enable IMEI/Serial/description, Not for selling, Weight, Preparation time (minutes), Rack/Row/Position (when enabled), Warranty, custom fields
- Pricing: Applicable Tax, Selling Price Tax Type* (Inclusive/Exclusive), Product Type* (Single / Variable / Combo)
  - *Single*: Default Purchase Price (Exc. tax / Inc. tax), x Margin %, Default Selling Price (Exc. / Inc. tax), and a variation image
  - *Variable*: build variations from templates (e.g. Size × Color) with a per-variation SKU, prices, and images
  - *Combo*: a bundle of other products and quantities
- Save options: **Save**, **Save And Add Another**, **Save & Add Opening Stock**, **Save & Add Selling-Price-Group Prices**

**Update Price** (`/update-product-price`): **Export product prices** to a spreadsheet, edit it, then import it back. Covers default and price-group prices.

**Print Labels** (`/labels/show`)
- Search and add products. Each row has No. of labels, EXP Date, Packing Date, and Selling Price Group
- Per-field toggles, each with a font size: Product name, Variations, Price (Inc./Exc. tax), Business name, Packing date, Exp date
- Barcode sheet setting: 20/30/32/40/50 labels per 8.5"×11" sheet, continuous rolls (31.75×25.4 mm), or custom
- **Preview**, then **Print**

**Variations** (`/variation-templates`): template name plus values (e.g. Size: S, M, L).
**Import Products / Import Opening Stock**: template-based bulk import.
**Selling Price Group** (`/selling-price-group`): Name and Description. Lets you keep extra price lists (wholesale, dealer…) per product.
**Units** (`/units`): Name, Short name, Allow decimal. A unit can also be a *multiple of a base unit* (e.g. 1 bag = 50 KG).
**Categories** (`/taxonomies?type=product`): Category, Code, Description, with parent/child sub-categories.
**Brands**: Name and Note. **Warranties**: Name, Description, Duration (days/months/years).

### 3.4 Purchases
**List Purchases** (`/purchases`)
- Filters: Location, Supplier, Purchase Status (Received/Pending/Ordered), Payment Status (Paid/Due/Partial/Overdue), Date range
- Columns: Action, Date, Reference No, Location, Supplier, Purchase Status, Payment Status, Grand Total, Payment due, Added By
- **Update Status** modal

**Add Purchase** (`/purchases/create`)
- Header: Supplier* (with inline add-contact), Reference No, Purchase Date*, Purchase Status*, Business Location*, Currency Exchange Rate*, Pay term, Attach Document
- Line items: search by name/SKU/barcode, **Import Products** from a file, **Add new product** inline
  - Columns: Product, Qty, Unit Cost (before discount), Discount %, Unit Cost (before tax), Subtotal (before tax), Product Tax, Net Cost, Line Total, **Profit Margin %**, **Unit Selling Price (Inc. tax)**, MFG / EXP date (and Lot no. when enabled)
- Footer: Discount (Fixed/%), Purchase Tax, Additional Notes, Shipping Details, Additional Shipping charges, **up to 4 additional expenses** (name + amount), then the Payment block and **Save**

**Purchase Return** (`/purchase-return`): Filters for Location and Date range. Returns can be created against a purchase.

### 3.5 Sell
**All sales** (`/sells`) and **List POS** (`/pos`)
- Filters: Location, Customer, Payment Status, Date range, User (created by), Sales Commission Agent, Shipping Status, *Subscriptions only*
- Columns: Action, Date, Invoice No., Customer name, Contact Number, Location, Payment Status, Payment Method, Total amount, Total paid, Sell Due, Sell Return Due, Shipping Status, Total Items, Types of service, Custom fields, Added By, Sell note, Staff note, Shipping Details, Table, Service staff

**Add Sale** (`/sells/create`); **Add Draft** and **Add Quotation** use the same form with a preset status
- Location selector, Customer* (search by name/phone, shows reward points), Pay term, Sale Date*, Status* (Final / Draft / Quotation / Proforma), Invoice scheme, Invoice No. (manual override), Attach Document, **Link Sales Orders** (multi)
- Line items: Product, Quantity, Unit Price, Discount, Tax, Price inc. tax, Subtotal. Search matches name, SKU, barcode, and the selected "Search products by" fields
- Order-level: Discount (Fixed/%)*, **Redeem reward points**, Order Tax*, Sell note
- Shipping: Details, Address, Charges, Status (Ordered/Packed/Shipped/Delivered/Cancelled), Delivered To, Delivery Person, Shipping Documents
- 4 additional expenses, the Payment block, Change-return method
- **Subscribe** (recurring invoice): interval (Days/Months/Years), no. of repetitions, repeat on day N
- Buttons: **Save**, **Save and print**

**POS screen** (`/pos/create`): full-screen, no sidebar
- **Top bar:** Location selector, current date/time, keyboard-shortcut hint, **Add Expense**, Suspended sales (pause icon), Register details, Close register, Calculator, Today's profit/cash-in-hand, Return (sell return), Cancel, Go back
- **Left pane (cart):**
  - Customer select (default *Walk-In Customer*) with ➕ add customer
  - Product search (name / SKU / barcode) with ➕ add product
  - **Select Technician** (custom)
  - **Invoice layout** selector (New Invoice, Haque Inter, Haque, Sarkar)
  - Transaction date
  - Cart table: Product, Quantity, Price inc. tax, Subtotal, ✕. Line items expand to edit price, discount, tax, notes, IMEI/serial, and service staff
  - Totals: Items, Total, Discount (edit modal), Order Tax (edit modal), Shipping (modal with **Inside Dhaka / Outside Dhaka / Free** zone presets), Reward points
- **Right pane:** Category and Brand filters, Product/Service filter, and a **product grid** of image cards (name + SKU) with infinite scroll. Also Featured Products
- **Bottom action bar:** **Quotation**, **Draft**, **Suspend**, **Credit Sale**, **Card**, **Multiple Pay / Payment Details**, one-click **Nagad**, **Bkash**, **Cash / Express checkout**, **Print**, **Cancel**. Shows **Total Payable**, a **Given** amount input, and the computed **Return** (change)
- **Recent Transactions** drawer with Final / Quotation / Draft tabs (edit, print, delete)
- **Weighing Scale** barcode modal (prefix + SKU length + qty integer/decimal length)
- Configurable **keyboard shortcuts** for express checkout, pay & checkout, draft, cancel, recent product qty, weighing scale, edit discount, edit order tax, add payment row, finalize payment, and add new product
- Payment modal: multiple payment rows, card transaction details, and cash denominations when enabled

**Sales Order** (`/sales-order`)
- Filters: Location, Customer, Status (Ordered/Partial/Completed), Shipping Status, Date range
- Columns: Date, Order No., Customer, Contact, Location, Status, Shipping Status, **Quantity Remaining**, Added By
- Orders are later converted into sales by linking them on Add Sale

**Drafts / Quotations** (`/sells/drafts`, `/sells/quotations`)
- Filters: Location, Customer, Date range, User
- Columns: Date, Reference No, Customer, Contact, Location, Total Items, Added By, Action (convert to invoice, edit, print, delete)

**Sell Return** (`/sell-return`)
- Filters: Location, Customer, Date range, User
- Columns: Date, Invoice No., **Parent Sale**, Customer, Location, Payment Status, Total, Payment due

**Shipments** (`/shipments`)
- Filters: Location, Customer, Date range, User, Payment Status, Shipping Status, Delivery Person
- Columns: Invoice, Customer, Contact, Location, Delivery Person, Shipping Status, Payment Status, Service staff

**Discounts** (`/discount`)
- Rule-based discounts: Name, Starts At, Ends At, Discount Amount (fixed/%), **Priority**, and scope (Brand / Category / Products / Location). Can be applied to price groups and customer groups
- Supports **Deactivate Selected**

**Import Sales** (`/import-sales`): **Upload and review** step, then import. Keeps an import history (batch, time, created by, invoices) that can be reverted.

### 3.6 Stock
**Stock Transfer** (`/stock-transfers/create`)
- Header: Date*, Reference No, Status* (Pending / In Transit / Completed), Location From*, Location To*
- Body: product search and lines (Qty, Unit Price, Subtotal), Shipping Charges, Additional Notes

**Stock Adjustment** (`/stock-adjustments/create`)
- Header: Location*, Reference No, Date*, Adjustment type* (Normal / Abnormal)
- Body: product lines, **Total amount recovered**, Reason

### 3.7 Expenses
**List** (`/expenses`)
- Filters: Category, Sub category, Date range, Payment Status
- Columns: Date, Ref No, **Recurring details**, Category, Sub category, Location, Payment Status, Tax, Total, Payment due, Expense for (user), Contact, Note, Added By

**Add** (`/expenses/create`)
- Location*, Category and Sub category, Ref No, Date*, Expense for (user), Expense for contact, Attach Document, Applicable Tax, Total amount*, Note
- **Is refund?** and **Is recurring?** (interval / repetitions / repeat-on day), plus the Payment block

**Expense Categories**: Name and Code, with sub-categories.

### 3.8 Payment Accounts (Accounting)
- **Accounts** (`/account/account`)
  - Tabs: Accounts | Account Types
  - Status filter: Active / Closed
  - Columns: Name, Account Type, Sub Type, Account Number, Note, **Balance**, Account details, Added By, Action (Edit, Account Book, Fund Transfer, Deposit, Close)
- **Balance Sheet**: Liabilities vs Assets, filtered by location and date. Printable
- **Trial Balance**: Debit / Credit, filtered by location and date. Printable
- **Cash Flow**: filters for Account, Location, Date range, and Transaction Type (Debit/Credit). Columns: Date, Account, Description, Payment Method, Payment details, Debit, Credit, Account Balance, Total Balance
- **Payment Account Report**: links payments to accounts. Columns: Date, Payment Ref, Invoice/Ref No., Amount, Payment Type, Account, Description, and a *Link account* action

### 3.9 Reports
All reports filter by location and date range, and most can be printed or exported.

| Report | Key filters | Output |
|---|---|---|
| **Profit / Loss** | Location, date | Summary (opening/closing stock, purchases, sales, expenses, gross & net profit) plus tabs: Profit by **products / categories / brands / locations / invoice / date / customer / day** |
| **Purchase & Sale** | Location, date | Purchases block, Sales block, Overall ((Sale − Sell Return) − (Purchase − Purchase Return)), Due amount |
| **Tax** | Location, contact, date | Tabs: Input Tax / Output Tax / Expense Tax. Shows the net (Output − Input − Expense). Has a custom tax column ("Ati vet") |
| **Customers & Suppliers** | Customer group, type, location, contact, date | Contact, Total Purchase, Purchase Return, Total Sale, Sell Return, Opening Balance Due, Due |
| **Customer Groups** | Group, location, date | Group, Total Sale |
| **Stock** | Location, category, sub-cat, brand, unit | SKU, Product, Variation, Category, Location, Unit Selling Price, Current stock, Stock value (by purchase / by sale price), Potential profit, Units sold / transferred / adjusted |
| **Stock Expiry** | Same, plus *View stocks* (Expired, within 1 wk / 15 d / 1 mo / 3 mo / 6 mo / 1 yr) | Product, SKU, Location, Stock Left, Lot, EXP, MFG. Expired stock can be edited or removed |
| **Stock Adjustment** | Location, date | Totals (normal/abnormal/recovered) plus a list |
| **Trending Products** | Location, cat, sub-cat, brand, unit, date, top-N, product type | Bar chart of top-selling products |
| **Items** | Supplier, purchase date, customer, sell date, location | Traces each unit from purchase to sale (purchase price vs selling price) |
| **Product Purchase** | Product, supplier, location, date, brand | Per-line purchase history |
| **Product Sell** | Product, customer, customer group, location, category, brand, date, **time range** | Tabs: Detailed / Detailed (with purchase lot) / Grouped / By Category / By Brand |
| **Purchase Payment** | Supplier, location, date | Payments made |
| **Sell Payment** | Customer, location, payment method, customer group, date | Payments received |
| **Expense** | Location, category, date | Total per category, with a chart |
| **Register** | User, status (Open/Close), date | Per register session: totals by card, cheque, cash, bank transfer, advance, **Nagad, Bkash, Rocket, Upay, Nagad Merchant, Bkash Merchant**, other |
| **Sales Representative** | User, location, date | Summary (sales − returns, commission, expenses). Tabs: Sales Added / Sales With Commission / Expenses / Payments with commission |
| **Table** | Location, date | Total sale per restaurant table |

### 3.10 Administration
- **Backup** (`/backup`): list backups and **Create New Backup** (download/delete)
- **Modules** (`/manage-modules`): superadmin only. Upload, install, and regenerate add-on modules, or buy them (UltimatePOS module marketplace)

### 3.11 Settings
**Business Settings** (`/business/settings`) is a single vertical-tab page with these tabs:

| Tab | Settings |
|---|---|
| **Business** | Name, Start date, Default profit %, Currency and symbol placement, Time zone, Logo, Financial year start month, **Stock accounting method (FIFO/LIFO)**, Transaction edit days, Date/Time format, Currency and quantity precision, Code 1/2 labels |
| **Tax** | Tax 1/2 name & number, enable inline tax in purchase & sell |
| **Product** | SKU prefix, enable expiry (per item, or MFG + period) and on-expiry behaviour (keep selling / stop N days before), enable Brands / Categories / Sub-categories / Price & Tax info / Sub-units / Racks / Row / Position / Warranty / Secondary unit, image required, default unit |
| **Contact** | Default credit limit |
| **Sale** | Default sale discount and tax, item addition method (new row vs increase qty), amount rounding (none / whole / 0.05 / 0.1 / 0.5), min-selling-price enforcement, allow overselling, enable Sales Order, pay term required, commission agent mode (disabled / logged-in user / user list / agent list), commission calculation (invoice value vs payment received), payment link (Razorpay, Stripe keys) |
| **POS** | Keyboard shortcuts, plus toggles: disable multiple pay, draft, express checkout, product suggestion, recent transactions, discount, order tax, suspend, credit sale button. Also subtotal editable, transaction date on POS, inline/required service staff, weighing scale (+ barcode format), show invoice scheme / layout dropdown, print on suspend, pricing on tooltip |
| **Purchases** | Edit product price from purchase, enable purchase status, lot number, purchase order, purchase requisition |
| **Payment** | Cash denominations (on POS or all screens, per method, strict check) |
| **Dashboard** | Stock-expiry alert days |
| **System** | Theme colour (Blue, Black, Purple, Green, Red, Yellow, Blue Light), default table page size, show help tooltips, enable export |
| **Prefixes** | Reference prefixes for Purchase, Purchase Return, Requisition, PO, Stock Transfer, Stock Adjustment, Sell Return, Expense, Contacts, Purchase/Sell/Expense Payment, Business Location, Username, Subscription, Draft, Sales Order |
| **Email Settings** | SMTP (host, port, user, password, encryption, from). Has a **Send test email** button |
| **SMS Settings** | Nexmo / Twilio / **Other (generic HTTP gateway)** with URL, param names, GET/POST, 3 headers, 10 params. Has a **Send test SMS** button |
| **Reward Point Settings** | Enable, display name, amount per point, min order to earn, max points per order, redeem value per point, min order to redeem, min/max redeem points, expiry (months/years) |
| **Modules** | Enable/disable: Purchases, Add Sale, POS, Stock Transfers, Stock Adjustment, Expenses, Account, Tables, Modifiers, Service staff, Bookings, Kitchen, Subscription, Types of service |
| **Custom Labels** | Names for 7 custom payment methods, and labels for custom fields on contacts (10), products, locations, users, purchases, purchase shipping, sells, sale shipping, and types of service |

**Business Locations** (`/business-location`)
- Columns: Name, Location ID, Landmark, City, Zip, State, Country, **Price Group**, **Invoice scheme**, **Invoice layout for POS**, **Invoice layout for sale**
- Per location you can also set the enabled payment methods / default accounts, featured products, and activate or deactivate it

**Invoice Settings** (`/invoice-schemes`)
- Tabs: **Invoice Schemes** (Name, Prefix, Numbering type (sequential/random), Start from, Invoice count, Digits) | **Invoice Layouts** (design editor for receipt/A4 templates: header/footer text, logo, which fields to show, labels)

**Barcode Settings** (`/barcodes`): sticker sheet presets (paper size, label size, rows/columns, margins, gaps).
**Receipt Printers** (`/printers`): Name, Connection type (Network/Windows/Linux), Capability profile, Characters per line, IP, Port, Path.
**Tax Rates** (`/tax-rates`): Tax rates (Name, %) and **Tax groups** (combinations of several rates).

### 3.12 Other
- **Calendar** (`/calendar`): events calendar filtered by location, with a Bookings toggle (restaurant bookings)
- **My Profile** (`/user/profile`):
  - Change password
  - Profile: prefix, name, email, language
  - Photo
  - More info: DOB, gender, marital status, blood group, phone numbers, social links, custom fields, guardian, ID proof, permanent/current address
  - Bank details: holder, number, bank, code, branch, tax payer ID

---

## 4. Key business rules (observed or implied by the settings)
1. **Multi-location stock.** Stock is tracked per location per variation. Products must be assigned to a location before they can be sold there.
2. **Costing** uses FIFO or LIFO, set per business. Purchase lines carry an optional lot number and MFG/EXP dates.
3. **Pricing:** default selling price = purchase price × (1 + margin %). Prices can be tax inclusive or exclusive. Selling Price Groups can override prices per location or customer. Discount rules are applied by priority.
4. **Transaction lifecycle:**
   - Sale: `Quotation → Draft → Final` (also Proforma and Suspended)
   - Purchase: `Ordered → Pending → Received`
   - Stock Transfer: `Pending → In Transit → Completed`
   - Shipping: `Ordered → Packed → Shipped → Delivered / Cancelled`
5. **Payment status** (Paid / Due / Partial / Overdue) is derived from the payments recorded and the pay term.
6. **Credit control:** customer credit limit, pay terms, and a credit-sale button. Advance balances can be used as a payment method.
7. **Transaction edit window:** edits are limited to *N* days after the transaction (Transaction Edit Days).
8. **Register:** POS use requires an open cash register. Closing it produces a per-method summary, which feeds the Register Report.
9. **Reward points** are earned and redeemed under the configured thresholds, and they expire.
10. **Commission:** agents earn commission on invoice value or on payments received.

---

## 5. Customisations beyond stock UltimatePOS
- **Technicians** module (`/order/reciever`) and a technician picker on POS
- Bangladeshi payment methods as dedicated one-click POS buttons (**Nagad**, **Bkash**), and per-method columns in the Register Report (Rocket, Upay, merchant accounts)
- POS **Shipping zones** preset: Inside Dhaka / Outside Dhaka / Free
- Several named invoice layouts (Sarkar, Haque, Haque Inter, New Invoice)
- Branding: "Sarkar Pos", purple theme, "Developed By Sarkar IT"

---

## 6. Observations and gaps (useful when rebuilding)
- **Permissions:** the `admin` demo user gets **403 on Customer Groups** and has **no User Management menu**. Roles and permissions exist but are not visible here.
- **Stock Transfers** and **Stock Adjustments** only link to "Add" pages in the menu. Their list views are missing.
- **Console errors:** the dashboard logs 6–8 JavaScript errors on every load, and the POS page logs 6.
- **Dashboard:** only the KPI tiles render. There are no charts, and all tiles show ৳ 0.00 for the default range.
- **UI quality:** the UI is dense and dated (AdminLTE 2 / Bootstrap 3, jQuery DataTables). Forms are very long (Business Settings has 100+ fields). The POS screen is feature-rich but visually busy. The product grid has many placeholder images.
- **Terminology:** labels are inconsistent: "reciever" (typo in the URL), "Ati vet" as a tax column, "Sell" vs "Sale", and "Payment Accounts" used for the whole accounting module.

---

## 7. Suggested MVP scope for a rebuild (pos_sible)
1. **Auth and tenancy:** business → locations → users with roles
2. **Catalog:** products (single + variable), units with sub-units, categories, brands, tax rates, barcodes and labels
3. **Contacts:** customers, suppliers, groups, balances
4. **POS screen:** cart, product grid, customer, discount/tax, multi-payment (Cash / Card / bKash / Nagad), change calculation, receipt print, suspend/draft, cash register open/close
5. **Sales:** list, returns, quotations/drafts
6. **Purchases:** list, receive stock, returns
7. **Inventory:** stock per location, transfers, adjustments, expiry
8. **Expenses** and **payment accounts**
9. **Reports:** P&L, stock, sales/purchase, payments, register, tax
10. **Settings:** business, locations, invoice schemes/layouts, prefixes, POS toggles

Later: sales orders and shipments, subscriptions, reward points, commission agents, restaurant modules (tables/kitchen/modifiers/bookings), SMS/email notifications, imports, backups.
