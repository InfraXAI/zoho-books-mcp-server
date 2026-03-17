/**
 * Zoho Books MCP Server — Chanakya CFO Toolkit
 *
 * A Model Context Protocol server for Zoho Books integration.
 * 86 tools across 16 modules for complete financial management.
 */

import { FastMCP } from "fastmcp"

// Tool registrations — Core
import { registerOrganizationTools } from "./tools/organizations.js"
import { registerChartOfAccountsTools } from "./tools/chart-of-accounts.js"
import { registerJournalTools } from "./tools/journals.js"
import { registerExpenseTools } from "./tools/expenses.js"
import { registerBillTools } from "./tools/bills.js"
import { registerInvoiceTools } from "./tools/invoices.js"
import { registerContactTools } from "./tools/contacts.js"
import { registerBankAccountTools } from "./tools/bank-accounts.js"

// Tool registrations — Payments
import { registerCustomerPaymentTools } from "./tools/customer-payments.js"
import { registerVendorPaymentTools } from "./tools/vendor-payments.js"

// Tool registrations — Sales & Procurement
import { registerItemTools } from "./tools/items.js"
import { registerEstimateTools } from "./tools/estimates.js"
import { registerPurchaseOrderTools } from "./tools/purchase-orders.js"

// Tool registrations — Compliance & Automation
import { registerTaxTools } from "./tools/taxes.js"
import { registerCreditNoteTools } from "./tools/credit-notes.js"
import { registerRecurringInvoiceTools } from "./tools/recurring-invoices.js"

// Create the MCP server
const server = new FastMCP({
  name: "zoho-books-mcp",
  version: "2.0.0",
  instructions: `
Zoho Books MCP server — AI CFO toolkit for complete financial management.

## Multi-Organization Support
- Default org is pre-configured via ZOHO_ORGANIZATION_ID environment variable.
- You can pass organization_id to any tool to target a specific org.
- Org aliases are supported (e.g., "naturnest" instead of "60026116971") — configured via ZOHO_ORG_ALIASES env var.
- Use switch_organization to change the active org for the entire session.
- Use list_organizations to see all available orgs with aliases and active status.
- Use get_organization_summary for a quick financial snapshot of any org.

## Available Tools (88)

### Chart of Accounts
- list_accounts, get_account, create_account, list_account_transactions

### Journals
- list_journals, get_journal, create_journal, update_journal, delete_journal, publish_journal
- add_journal_attachment, get_journal_attachment, delete_journal_attachment

### Contacts (Customers & Vendors)
- list_contacts, get_contact, create_contact, update_contact
- mark_contact_active, mark_contact_inactive

### Items (Products & Services)
- list_items, get_item, create_item, update_item, mark_item_active

### Invoices (Accounts Receivable)
- list_invoices, get_invoice, create_invoice, update_invoice
- send_invoice, void_invoice, email_invoice
- add_invoice_attachment, get_invoice_attachment, delete_invoice_attachment

### Bills (Accounts Payable)
- list_bills, get_bill, create_bill
- add_bill_attachment, get_bill_attachment, delete_bill_attachment

### Expenses
- list_expenses, get_expense, create_expense
- add_expense_receipt, get_expense_receipt, delete_expense_receipt

### Customer Payments
- list_customer_payments, get_customer_payment, create_customer_payment, delete_customer_payment

### Vendor Payments
- list_vendor_payments, get_vendor_payment, create_vendor_payment, delete_vendor_payment

### Estimates / Quotes
- list_estimates, get_estimate, create_estimate, update_estimate
- mark_estimate_sent, mark_estimate_accepted

### Purchase Orders
- list_purchase_orders, get_purchase_order, create_purchase_order, update_purchase_order
- mark_purchase_order_open, cancel_purchase_order

### Credit Notes
- list_credit_notes, get_credit_note, create_credit_note
- apply_credit_to_invoice, void_credit_note, delete_credit_note

### Taxes
- list_taxes, get_tax, create_tax, list_tax_groups

### Recurring Invoices
- list_recurring_invoices, get_recurring_invoice, create_recurring_invoice
- stop_recurring_invoice, resume_recurring_invoice

### Bank Accounts
- list_bank_accounts, get_bank_account, list_bank_transactions

### Organizations
- list_organizations, get_organization, switch_organization, get_organization_summary
`,
  health: {
    enabled: true,
    message: JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "2.0.0",
      service: "zoho-books-mcp",
    }),
    path: "/health",
    status: 200,
  },
})

// Register all tools — Core
registerOrganizationTools(server)
registerChartOfAccountsTools(server)
registerJournalTools(server)
registerExpenseTools(server)
registerBillTools(server)
registerInvoiceTools(server)
registerContactTools(server)
registerBankAccountTools(server)

// Register all tools — Payments
registerCustomerPaymentTools(server)
registerVendorPaymentTools(server)

// Register all tools — Sales & Procurement
registerItemTools(server)
registerEstimateTools(server)
registerPurchaseOrderTools(server)

// Register all tools — Compliance & Automation
registerTaxTools(server)
registerCreditNoteTools(server)
registerRecurringInvoiceTools(server)

export default server
