/**
 * Bank Account tools for Zoho Books API
 */

import { z } from "zod"
import type { FastMCP } from "fastmcp"
import { zohoGet, zohoPost } from "../api/client.js"
import type { BankAccount, BankTransaction } from "../api/types.js"
import {
  entityIdSchema,
  optionalDateSchema,
  optionalOrganizationIdSchema,
} from "../utils/validation.js"

/**
 * Register bank account tools on the server
 */
export function registerBankAccountTools(server: FastMCP): void {
  // List Bank Accounts
  server.addTool({
    name: "list_bank_accounts",
    description: `List all bank accounts in Zoho Books.
Returns bank account details with name, type, and balance.
These are the accounts linked in Zoho Books, not live bank data.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      filter_by: z
        .enum(["Status.All", "Status.Active", "Status.Inactive"])
        .optional()
        .describe("Filter by status"),
      sort_column: z.enum(["account_name", "account_type"]).optional(),
    }),
    annotations: {
      title: "List Bank Accounts",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const queryParams: Record<string, string> = {}
      if (args.filter_by) queryParams.filter_by = args.filter_by
      if (args.sort_column) queryParams.sort_column = args.sort_column

      const result = await zohoGet<{ bankaccounts: BankAccount[] }>(
        "/bankaccounts",
        args.organization_id,
        queryParams
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to list bank accounts"
      }

      const accounts = result.data?.bankaccounts || []

      if (accounts.length === 0) {
        return "No bank accounts found."
      }

      const formatted = accounts
        .map((acc, index) => {
          const balance =
            acc.balance !== undefined ? ` | Balance: ${acc.currency_code || "INR"} ${acc.balance}` : ""
          // Security: Sanitize account number (remove non-digits) before masking
          const digitsOnly = acc.account_number?.replace(/\D/g, "")
          const maskedAccount =
            digitsOnly && digitsOnly.length >= 4 ? `****${digitsOnly.slice(-4)}` : "N/A"
          return `${index + 1}. **${acc.account_name}** (${acc.account_type})
   - Account ID: \`${acc.account_id}\`
   - Bank: ${acc.bank_name || "N/A"}
   - Account Number: ${maskedAccount}
   - Active: ${acc.is_active ? "Yes" : "No"}${balance}`
        })
        .join("\n\n")

      return `**Bank Accounts** (${accounts.length} accounts)\n\n${formatted}`
    },
  })

  // Get Bank Account
  server.addTool({
    name: "get_bank_account",
    description: `Get detailed information about a specific bank account.
Returns full bank account details including routing number and balance.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      account_id: entityIdSchema.describe("Bank account ID"),
    }),
    annotations: {
      title: "Get Bank Account Details",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoGet<{ bankaccount: BankAccount }>(
        `/bankaccounts/${args.account_id}`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to get bank account"
      }

      const account = result.data?.bankaccount

      if (!account) {
        return "Bank account not found"
      }

      // Security: Sanitize account/routing numbers (remove non-digits) before masking
      const accountDigits = account.account_number?.replace(/\D/g, "")
      const maskedAccount =
        accountDigits && accountDigits.length >= 4 ? `****${accountDigits.slice(-4)}` : "N/A"
      const routingDigits = account.routing_number?.replace(/\D/g, "")
      const maskedRouting =
        routingDigits && routingDigits.length >= 4 ? `****${routingDigits.slice(-4)}` : "N/A"

      return `**Bank Account Details**

- **Account ID**: \`${account.account_id}\`
- **Name**: ${account.account_name}
- **Type**: ${account.account_type}
- **Code**: ${account.account_code || "N/A"}
- **Bank Name**: ${account.bank_name || "N/A"}
- **Account Number**: ${maskedAccount}
- **Routing Number**: ${maskedRouting}
- **Currency**: ${account.currency_code || "N/A"}
- **Balance**: ${account.currency_code || "INR"} ${account.balance || 0}
- **Active**: ${account.is_active ? "Yes" : "No"}`
    },
  })

  // List Bank Transactions
  server.addTool({
    name: "list_bank_transactions",
    description: `List bank transactions in Zoho Books.
Returns transactions recorded in Zoho Books for bank reconciliation.
These are transactions imported/entered in Zoho, not live bank feeds.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      account_id: entityIdSchema.describe("Bank account ID"),
      date_start: optionalDateSchema.describe("Start date (YYYY-MM-DD)"),
      date_end: optionalDateSchema.describe("End date (YYYY-MM-DD)"),
      status: z.enum(["All", "uncategorized", "categorized", "excluded"]).optional(),
      sort_column: z.enum(["date", "amount"]).optional(),
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(200).optional(),
    }),
    annotations: {
      title: "List Bank Transactions",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const queryParams: Record<string, string> = {
        account_id: args.account_id,
      }
      if (args.date_start) queryParams.date_start = args.date_start
      if (args.date_end) queryParams.date_end = args.date_end
      if (args.status) queryParams.status = args.status
      if (args.sort_column) queryParams.sort_column = args.sort_column
      if (args.page) queryParams.page = args.page.toString()
      if (args.per_page) queryParams.per_page = args.per_page.toString()

      const result = await zohoGet<{ banktransactions: BankTransaction[] }>(
        "/banktransactions",
        args.organization_id,
        queryParams
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to list bank transactions"
      }

      const transactions = result.data?.banktransactions || []

      if (transactions.length === 0) {
        return "No bank transactions found."
      }

      const formatted = transactions
        .map((tx, index) => {
          const amount = tx.debit_or_credit === "debit" ? `-${tx.amount}` : `+${tx.amount}`
          return `${index + 1}. **${tx.date}** - ${tx.currency_code || "INR"} ${amount}
   - Transaction ID: \`${tx.transaction_id}\`
   - Type: ${tx.transaction_type}
   - Status: ${tx.status}
   - Payee: ${tx.payee || "N/A"}
   - Reference: ${tx.reference_number || "N/A"}
   - Description: ${tx.description || "N/A"}`
        })
        .join("\n\n")

      return `**Bank Transactions** (${transactions.length} transactions)\n\n${formatted}`
    },
  })

  // Match Bank Transaction
  server.addTool({
    name: "match_bank_transaction",
    description: `Match an uncategorized bank feed transaction with an existing Zoho transaction.
Links the imported bank entry to an already-recorded expense, journal, or payment.
Use list_bank_transactions with status="uncategorized" to find bank transactions to match.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      bank_transaction_id: entityIdSchema.describe("The uncategorized bank transaction ID to match"),
      account_id: entityIdSchema.describe("Bank account ID"),
      match_transaction_id: entityIdSchema.describe("The existing transaction ID (expense/journal/payment) to match with"),
      match_transaction_type: z.enum(["expense", "journal", "customer_payment", "vendor_payment", "bill", "invoice"])
        .describe("Type of the existing transaction to match"),
    }),
    annotations: {
      title: "Match Bank Transaction",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const payload = {
        transactions_to_be_matched: [{
          transaction_id: args.match_transaction_id,
          transaction_type: args.match_transaction_type,
        }],
      }

      const result = await zohoPost<{ message: string }>(
        `/banktransactions/match/${args.bank_transaction_id}?account_id=${args.account_id}`,
        args.organization_id,
        payload
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to match bank transaction"
      }

      return `**Bank transaction matched successfully.** Bank txn \`${args.bank_transaction_id}\` → ${args.match_transaction_type} \`${args.match_transaction_id}\``
    },
  })

  // Exclude Uncategorized Bank Transactions
  server.addTool({
    name: "exclude_bank_transactions",
    description: `Exclude uncategorized bank transactions from reconciliation.
Use this for transactions that are already manually recorded and don't need bank feed linking.
Excluded transactions won't show as "uncategorized" anymore.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      transaction_ids: z.array(z.string()).min(1).describe("Array of bank transaction IDs to exclude"),
    }),
    annotations: {
      title: "Exclude Bank Transactions",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const payload = {
        transaction_ids: args.transaction_ids,
      }

      const result = await zohoPost<{ message: string }>(
        "/banktransactions/uncategorized/exclude",
        args.organization_id,
        payload
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to exclude bank transactions"
      }

      return `**${args.transaction_ids.length} bank transaction(s) excluded successfully.**`
    },
  })
}
