/**
 * Zoho Bookkeeper MCP Server
 *
 * A Model Context Protocol server for Zoho Books integration with proper
 * multipart file upload support for attachments.
 */

import { FastMCP } from "fastmcp"

// Tool registrations
import { registerOrganizationTools } from "./tools/organizations.js"
import { registerChartOfAccountsTools } from "./tools/chart-of-accounts.js"
import { registerJournalTools } from "./tools/journals.js"
import { registerExpenseTools } from "./tools/expenses.js"
import { registerBillTools } from "./tools/bills.js"
import { registerInvoiceTools } from "./tools/invoices.js"
import { registerContactTools } from "./tools/contacts.js"
import { registerBankAccountTools } from "./tools/bank-accounts.js"

// Create the MCP server
const server = new FastMCP({
  name: "zoho-bookkeeper-mcp",
  version: "1.0.0",
  instructions: `
Zoho Books MCP server for bookkeeping workflows.

## Getting Started
1. First use \`list_organizations\` to get your organization_id
2. Use that organization_id for all subsequent API calls

## Available Tool Categories

### Organizations (2 tools)
- list_organizations: List all Zoho organizations (use first to get org_id)
- get_organization: Get organization details

### Chart of Accounts (4 tools)
- list_accounts: List all accounts (find account_id values here)
- get_account: Get account details
- create_account: Create new account
- list_account_transactions: List transactions for an account

### Journals (9 tools)
- list_journals: List journal entries
- get_journal: Get journal details
- create_journal: Create journal entry (debits must equal credits)
- update_journal: Update journal entry
- delete_journal: Delete journal entry
- publish_journal: Publish/post a draft journal
- add_journal_attachment: Upload file to journal
- get_journal_attachment: Get journal attachment info
- delete_journal_attachment: Remove journal attachment

### Expenses (6 tools)
- list_expenses: List expenses
- get_expense: Get expense details
- create_expense: Create expense
- add_expense_receipt: Upload receipt to expense
- get_expense_receipt: Get expense receipt info
- delete_expense_receipt: Remove expense receipt

### Bills (6 tools)
- list_bills: List bills (accounts payable)
- get_bill: Get bill details
- create_bill: Create bill
- add_bill_attachment: Upload file to bill
- get_bill_attachment: Get bill attachment info
- delete_bill_attachment: Remove bill attachment

### Invoices (5 tools)
- list_invoices: List invoices (accounts receivable)
- get_invoice: Get invoice details
- add_invoice_attachment: Upload file to invoice
- get_invoice_attachment: Get invoice attachment info
- delete_invoice_attachment: Remove invoice attachment

### Contacts (2 tools)
- list_contacts: List customers and vendors
- get_contact: Get contact details

### Bank Accounts (3 tools)
- list_bank_accounts: List bank accounts in Zoho
- get_bank_account: Get bank account details
- list_bank_transactions: List bank transactions

## Common Workflows

### Create a Journal Entry with Receipt
1. list_organizations -> get organization_id
2. list_accounts -> find account_id values
3. create_journal -> create the entry (balanced debits/credits)
4. add_journal_attachment -> attach the receipt file

### Record an Expense with Receipt
1. list_organizations -> get organization_id
2. list_accounts -> find expense account_id and payment account_id
3. create_expense -> record the expense
4. add_expense_receipt -> attach the receipt

### Create a Bill from Vendor
1. list_organizations -> get organization_id
2. list_contacts with contact_type="vendor" -> find vendor_id
3. list_accounts -> find expense account_id
4. create_bill -> create the bill
5. add_bill_attachment -> attach the vendor invoice
`,
  health: {
    enabled: true,
    message: JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      service: "zoho-bookkeeper-mcp",
    }),
    path: "/health",
    status: 200,
  },
})

// Register all tools
registerOrganizationTools(server)
registerChartOfAccountsTools(server)
registerJournalTools(server)
registerExpenseTools(server)
registerBillTools(server)
registerInvoiceTools(server)
registerContactTools(server)
registerBankAccountTools(server)

export default server
