# Zoho Books — Skill (v2.0)

## What This Is
MCP server skill for Zoho Books — the AI CFO toolkit. Enables AI Beings (Chanakya, Treta, or any Being) to fully manage company finances — invoices, payments, estimates, purchase orders, items, taxes, credit notes, recurring invoices, expenses, journals, contacts, and bank accounts.

## Activation Keywords
zoho, books, invoice, bill, expense, journal, payment, finance, accounting, ledger, chart of accounts, vendor, customer, bank, GST, tax, receivable, payable, bookkeeping, estimate, quote, purchase order, credit note, recurring, item, product, service

## Available Tools (86)

### Organizations (2)
- `list_organizations` — List all Zoho organizations
- `get_organization` — Get organization details

### Chart of Accounts (4)
- `list_accounts` — List all accounts (find account_id values here)
- `get_account` — Get account details
- `create_account` — Create new account
- `list_account_transactions` — List transactions for an account

### Journals (9)
- `list_journals` — List journal entries
- `get_journal` — Get journal details
- `create_journal` — Create journal entry (debit/credit)
- `update_journal` — Update existing journal
- `delete_journal` — Delete journal entry
- `publish_journal` — Publish draft journal
- `add_journal_attachment` — Upload attachment to journal
- `get_journal_attachment` — Get journal attachment info
- `delete_journal_attachment` — Remove journal attachment

### Contacts — Customers & Vendors (6)
- `list_contacts` — List all contacts
- `get_contact` — Get contact details
- `create_contact` — Create customer or vendor (with GST fields)
- `update_contact` — Update contact details
- `mark_contact_active` — Activate contact
- `mark_contact_inactive` — Deactivate contact

### Items — Products & Services (5)
- `list_items` — List all items
- `get_item` — Get item details
- `create_item` — Create product/service (with HSN/SAC code)
- `update_item` — Update item details
- `mark_item_active` — Activate item

### Invoices — Accounts Receivable (10)
- `list_invoices` — List all invoices
- `get_invoice` — Get invoice details
- `create_invoice` — Create customer invoice (or convert estimate)
- `update_invoice` — Update invoice
- `send_invoice` — Mark invoice as sent
- `void_invoice` — Void an invoice
- `email_invoice` — Email invoice to recipients
- `add_invoice_attachment` — Upload attachment to invoice
- `get_invoice_attachment` — Get invoice attachment info
- `delete_invoice_attachment` — Remove invoice attachment

### Bills — Accounts Payable (6)
- `list_bills` — List all bills
- `get_bill` — Get bill details
- `create_bill` — Create new bill
- `add_bill_attachment` — Upload attachment to bill
- `get_bill_attachment` — Get bill attachment info
- `delete_bill_attachment` — Remove bill attachment

### Expenses (6)
- `list_expenses` — List all expenses
- `get_expense` — Get expense details
- `create_expense` — Create new expense
- `add_expense_receipt` — Upload receipt to expense
- `get_expense_receipt` — Get receipt info
- `delete_expense_receipt` — Remove receipt

### Customer Payments (4)
- `list_customer_payments` — List payments received
- `get_customer_payment` — Get payment details
- `create_customer_payment` — Record payment against invoice(s)
- `delete_customer_payment` — Delete payment record

### Vendor Payments (4)
- `list_vendor_payments` — List payments made
- `get_vendor_payment` — Get payment details
- `create_vendor_payment` — Record payment against bill(s)
- `delete_vendor_payment` — Delete payment record

### Estimates / Quotes (6)
- `list_estimates` — List all estimates
- `get_estimate` — Get estimate details
- `create_estimate` — Create sales quote/estimate
- `update_estimate` — Update estimate
- `mark_estimate_sent` — Mark as sent
- `mark_estimate_accepted` — Mark as accepted

### Purchase Orders (6)
- `list_purchase_orders` — List all POs
- `get_purchase_order` — Get PO details
- `create_purchase_order` — Create purchase order
- `update_purchase_order` — Update PO
- `mark_purchase_order_open` — Open PO
- `cancel_purchase_order` — Cancel PO

### Credit Notes (6)
- `list_credit_notes` — List credit notes
- `get_credit_note` — Get credit note details
- `create_credit_note` — Create credit note
- `apply_credit_to_invoice` — Apply credit to outstanding invoice(s)
- `void_credit_note` — Void credit note
- `delete_credit_note` — Delete credit note

### Taxes (4)
- `list_taxes` — List all taxes (GST, etc.)
- `get_tax` — Get tax details
- `create_tax` — Create tax rate
- `list_tax_groups` — List tax groups

### Recurring Invoices (5)
- `list_recurring_invoices` — List recurring invoices
- `get_recurring_invoice` — Get recurring invoice details
- `create_recurring_invoice` — Create recurring invoice
- `stop_recurring_invoice` — Stop recurring
- `resume_recurring_invoice` — Resume recurring

### Bank Accounts (3)
- `list_bank_accounts` — List all bank accounts
- `get_bank_account` — Get bank account details
- `list_bank_transactions` — List bank transactions

## Key Workflows
- **Quote to Cash:** create_estimate → mark_estimate_accepted → create_invoice (with estimate_id) → send_invoice → create_customer_payment
- **Procure to Pay:** create_purchase_order → create_bill → create_vendor_payment
- **Returns:** create_credit_note → apply_credit_to_invoice
- **Subscription:** create_recurring_invoice → stop/resume as needed

## Transport
- **stdio** (default) — for Claude Code MCP integration
- **httpStream** — for remote/multi-client access (port 8004)

## Region
Default: India (`zohoapis.in`). Configurable via `ZOHO_API_URL` env var.

## Rate Limits
- 100 requests/minute per organization
- Daily: 1K (Free) / 2K (Standard) / 5K (Professional) / 10K (Premium+)

## Source
Forked from [bu5hm4nn/zoho-bookkeeper-mcp](https://github.com/bu5hm4nn/zoho-bookkeeper-mcp) (MIT).
Repo: [InfraXAI/zoho-books-mcp-server](https://github.com/InfraXAI/zoho-books-mcp-server)
