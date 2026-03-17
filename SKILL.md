# Zoho Books — Skill

## What This Is
MCP server skill for Zoho Books integration. Enables AI Beings (Treta, Chanakya, or any Being) to manage company finances — invoices, bills, expenses, journals, contacts, bank accounts, and chart of accounts.

## Activation Keywords
zoho, books, invoice, bill, expense, journal, payment, finance, accounting, ledger, chart of accounts, vendor, customer, bank, GST, tax, receivable, payable, bookkeeping

## Available Tools (37)

### Organizations
- `list_organizations` — List all Zoho organizations
- `get_organization` — Get organization details

### Chart of Accounts
- `list_accounts` — List all accounts (find account_id values here)
- `get_account` — Get account details
- `create_account` — Create new account
- `list_account_transactions` — List transactions for an account

### Journals
- `list_journals` — List journal entries
- `get_journal` — Get journal details
- `create_journal` — Create journal entry (debit/credit)
- `update_journal` — Update existing journal
- `delete_journal` — Delete journal entry
- `publish_journal` — Publish draft journal
- `add_journal_attachment` — Upload attachment to journal
- `get_journal_attachment` — Get journal attachment info
- `delete_journal_attachment` — Remove journal attachment

### Expenses
- `list_expenses` — List all expenses
- `get_expense` — Get expense details
- `create_expense` — Create new expense
- `add_expense_receipt` — Upload receipt to expense
- `get_expense_receipt` — Get receipt info
- `delete_expense_receipt` — Remove receipt

### Bills (Accounts Payable)
- `list_bills` — List all bills
- `get_bill` — Get bill details
- `create_bill` — Create new bill
- `add_bill_attachment` — Upload attachment to bill
- `get_bill_attachment` — Get bill attachment info
- `delete_bill_attachment` — Remove bill attachment

### Invoices (Accounts Receivable)
- `list_invoices` — List all invoices
- `get_invoice` — Get invoice details
- `add_invoice_attachment` — Upload attachment to invoice
- `get_invoice_attachment` — Get invoice attachment info
- `delete_invoice_attachment` — Remove invoice attachment

### Contacts (Customers & Vendors)
- `list_contacts` — List all contacts
- `get_contact` — Get contact details

### Bank Accounts
- `list_bank_accounts` — List all bank accounts
- `get_bank_account` — Get bank account details
- `list_bank_transactions` — List bank transactions

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
