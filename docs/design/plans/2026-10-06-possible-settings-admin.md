# pos_sible — Settings and Admin Implementation Plan (sub-project 8)

**Goal:** Replace every placeholder under `/settings/*`, plus `/profile` and `/calendar`, and clear the parked POS follow-ups.
**Architecture:** `settingsService.update(section, patch)` already exists; Business Settings is one vertical-tab page where each tab is a small form bound to one settings section. Locations, users, roles, invoice schemes/layouts, barcodes, printers and tax rates are `CrudPage`-style screens with bespoke forms. Backup extends the existing `backupService`.
**Branch:** `feat/settings`. Local merge only; no trailer; no push.

## Global Constraints
Same as the Sales plan. Saving a settings tab validates with the section's zod schema and invalidates `["settings"]` so the whole app reacts without reload.

## Review Focus
- Changing a setting takes effect immediately in POS, sales and receipts (rounding, overselling, disabled buttons, shortcuts, reward rules).
- A role's permission change applies on the next navigation; the last admin can't be deleted or demoted.
- A user can't deactivate themself; usernames are unique; password change needs the current password.
- Deactivating a location hides it from pickers but keeps its history; the last active location can't be deactivated.
- Invoice scheme edits never renumber existing invoices; `count` only moves forward.
- Restoring a backup validates it first and never partially applies.
- Module toggles hide nav items and routes consistently.

## Tasks
### Task 1: Business settings shell + Business, Tax, Product, Contact tabs
### Task 2: Sale, POS, Purchases, Payment tabs
Sale and POS tabs include the keyboard-shortcut editor (records a key chord, detects conflicts), the weighing-scale barcode format and cash denominations.
### Task 3: Dashboard, System, Prefixes, Reward points, Modules, Custom labels tabs
### Task 4: Email and SMS tabs
Forms plus "Send test email/SMS" buttons that run a mocked send with a success/failure toast.
### Task 5: Business locations
List (name, location ID, landmark, city, zip, state, country, price group, invoice scheme, POS layout, sale layout) and form (payment methods, default accounts, featured products, active switch).
### Task 6: Invoice schemes and layouts
Schemes table + form; layout editor (header/footer text, logo, field toggles, labels) with a live thermal/A4 preview reusing the receipt components.
### Task 7: Barcode settings, Receipt printers, Tax rates and groups
### Task 8: Users and Roles
Users list/form (role, locations, commission agent and %, status, password reset); roles list with a grouped permission matrix.
### Task 9: Backup and Modules
Backup: create (JSON download), list with size/time, download, delete, restore with validation. Modules: enable/disable list (superadmin).
### Task 10: Profile and Calendar
Profile tabs (password, profile, photo, more info, bank details); calendar with events per location and an optional bookings toggle.
### Task 11: Parked POS follow-ups
Enforce `minRedeemPoint`; remove the phantom 0.01 receipt discount; Bangla digits in the stock toast and suspended badge; label association on select triggers; card-slip and cheque counts on register close; remove dead `pos.bySku`; refresh `maxQty` on merge; persist-key shape; Bangla "PM"/"Pc(s)"/plural; unit test for the register gate; scope the `shouldFire` number-input exception; verify the weighing-scale dialog and native print dialog; duplicate-mobile error in AddCustomer; points cap across suspended carts; channel filter in POS lists.
### Task 12: Final hardening
Accessibility pass (labels, focus, contrast in both themes), EN/BN parity check, Playwright smoke across every module, full checks, whole-project review, README update, merge.
