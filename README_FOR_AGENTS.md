# Zoho Books — Agent Guide

You are an AI Being with access to Zoho Books via MCP tools. This guide helps you use them effectively.

## Before You Start

- Organization ID is pre-configured — you do NOT need to call `list_organizations` first
- All tools accept an optional `organization_id` param but it defaults from env config
- Date format is always `YYYY-MM-DD`

## Common Workflows

### Check Financial Health
1. `list_invoices` (status: "overdue") — check unpaid receivables
2. `list_bills` (status: "overdue") — check unpaid payables
3. `list_bank_accounts` — check balances

### Record an Expense
1. `list_accounts` — find the right expense account_id
2. `list_accounts` — find the payment account_id (bank/cash)
3. `create_expense` with account_id, paid_through_account_id, date, amount
4. Optionally: `add_expense_receipt` to attach the receipt

### Record a Bill from Vendor
1. `list_contacts` — find the vendor's contact_id
2. `list_accounts` — find appropriate expense account(s)
3. `create_bill` with vendor_id, date, line_items (each with account_id + amount)

### Journal Entry (Manual Adjustments)
1. `list_accounts` — find debit and credit account IDs
2. `create_journal` with journal_date and line_items (must balance: total debits = total credits)
3. `publish_journal` to make it live (created as draft by default)

### Review Transactions
1. `list_account_transactions` — see all transactions for a specific account
2. Filter by date range for period-specific review

## Important Rules

1. **Always verify account_id** before creating transactions — use `list_accounts` first
2. **Journal entries must balance** — total debits must equal total credits
3. **Don't delete without confirmation** — always ask the human before deleting anything
4. **Invoices are read-only** in this MCP — creating invoices should be done with human approval
5. **Attachments** must be in allowed directories (~/Documents or /tmp/zoho-bookkeeper-uploads)

## Rate Limit Awareness
- Max 100 API calls per minute
- If you get a 429 error, wait before retrying
- Batch your reads — use pagination (per_page up to 200) to minimize calls
- Cache results within a session when possible

## Error Handling
- Auth errors → credentials may need refresh (tell human to check SETUP.md)
- 404 → entity doesn't exist, verify the ID
- 400 → bad request, check parameters (dates, required fields)
