# Zoho Books — Agent Guide

You are an AI Being with access to Zoho Books via 88 MCP tools. This guide helps you use them effectively.

## Before You Start

- Organization ID is pre-configured — you do NOT need to call `list_organizations` first
- All tools accept an optional `organization_id` param (alias or numeric ID)
- Org aliases are auto-discovered: e.g., "naturnest", "infrax", "treta"
- Use `switch_organization("alias")` to change the active org for the session
- Date format is always `YYYY-MM-DD`

## Multi-Org Operations

```
switch_organization("treta")    → All calls now target Treta Test Lab
switch_organization("naturnest") → Switch to NaturNest AI
list_invoices(organization_id: "infrax") → One-off query to InfraX AI
```

## Common Workflows

### 1. Check Financial Health
1. `list_invoices` (status: "overdue") — unpaid receivables
2. `list_bills` (status: "overdue") — unpaid payables
3. `list_bank_accounts` — check balances
4. `list_expenses` (date range) — spending overview

### 2. Record an Expense
1. `list_accounts` (filter: AccountType.Expense) — find expense account_id
2. `list_accounts` (filter: AccountType.Asset) — find payment account_id (Petty Cash, bank)
3. `create_expense` with account_id, paid_through_account_id, date, amount
4. Optional: `add_expense_receipt` to attach receipt file
5. Optional: set `is_billable: true` + `customer_id` for billable expenses

### 3. Create Invoice & Collect Payment
1. `list_contacts` (contact_type: "customer") — find customer_id
2. `create_invoice` with customer_id, date, line_items [{name, quantity, rate}]
3. `send_invoice` — mark as sent
4. When paid: `create_customer_payment` with customer_id, amount, account_id, invoices [{invoice_id, amount_applied}]

### 4. Record a Bill & Pay Vendor
1. `list_contacts` (contact_type: "vendor") — find vendor_id
2. `list_accounts` (filter: AccountType.Expense) — find expense account(s)
3. `create_bill` with vendor_id, date, line_items [{account_id, rate, quantity}]
4. When paying: `create_vendor_payment` with vendor_id, amount, paid_through_account_id

### 5. Quote to Cash (Full Pipeline)
1. `create_estimate` → customer_id, date, line_items
2. `mark_estimate_sent` → required before acceptance
3. `mark_estimate_accepted` → customer agrees
4. `create_invoice` with `estimate_id` → converts estimate to invoice
5. `send_invoice` → mark as sent
6. `create_customer_payment` → record payment received

### 6. Procure to Pay (Full Pipeline)
1. `create_item` with purchase_rate + purchase_account_id → item with purchase info
2. `create_purchase_order` → vendor_id, line_items with item_id
3. `mark_purchase_order_open` → finalize PO
4. `create_bill` → record vendor invoice
5. `create_vendor_payment` → pay the vendor

### 7. Returns & Adjustments
1. `create_credit_note` → customer_id, line_items (reason for credit)
2. `apply_credit_to_invoice` → apply against outstanding invoice(s)

### 8. Subscription / Recurring Billing
1. `create_recurring_invoice` → customer_id, recurrence_name, frequency, start_date, line_items
2. `stop_recurring_invoice` → pause when needed
3. `resume_recurring_invoice` → restart

### 9. Journal Entry (Manual Bookkeeping)
1. `list_accounts` — find debit and credit account IDs
2. `create_journal` with journal_date and line_items (must balance: total debits = total credits)
3. `publish_journal` — make it live (created as draft by default)

### 10. Monthly Salary Recording
1. `create_expense` with account_id (Salaries & Employee Wages), amount, date, reference_number
2. Or use `create_journal` for split entries (salary + PF + TDS deductions)

## Important Gotchas

1. **Bill line items use `rate` + `quantity`** — NOT `amount`. Zoho calculates item_total = rate x quantity.
2. **Items for Purchase Orders** must have purchase info — set `purchase_rate` + `purchase_account_id` when creating items. Without this, Zoho rejects PO creation.
3. **Estimates must be sent before accepting** — call `mark_estimate_sent` before `mark_estimate_accepted`.
4. **Journal entries must balance** — total debits must equal total credits.
5. **Expense list returns `total` field** — detail view returns `amount`. Our tools handle both.
6. **Line items return `item_total`** not `amount` — our tools handle the fallback.
7. **Always verify IDs** before creating transactions — use list tools first.
8. **Don't delete without confirmation** — always ask the human before deleting anything.
9. **Attachments** must be in allowed directories (~/Documents or /tmp/zoho-bookkeeper-uploads).

## Rate Limit Awareness
- Max 100 API calls per minute per org
- If you get a 429 error, wait before retrying
- Use pagination (per_page up to 200) to minimize calls
- Cache results within a session when possible

## Error Handling
- **Auth errors** → credentials may need refresh (tell human to check SETUP.md)
- **404** → entity doesn't exist, verify the ID
- **400** → bad request, check parameters (dates, required fields)
- **429** → rate limit hit, wait 1 minute
- **29032** → PO item needs purchase info (create item with purchase_rate first)
- **4043** → status change not allowed (e.g., estimate must be sent before accepting)

## India-Specific (GST)
- Contacts support `gst_no`, `gst_treatment`, `place_of_supply`
- Items support `hsn_or_sac` (HSN for goods, SAC for services)
- Use `create_tax` for GST rates (18%, 12%, etc.)
- Use `list_tax_groups` for composite tax groups (CGST + SGST)
