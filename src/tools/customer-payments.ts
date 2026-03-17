/**
 * Customer Payment tools for Zoho Books API
 */

import { z } from "zod"
import type { FastMCP } from "fastmcp"
import { zohoGet, zohoPost, zohoDelete } from "../api/client.js"
import type { CustomerPayment } from "../api/types.js"
import { optionalOrganizationIdSchema, dateSchema, moneySchema, entityIdSchema } from "../utils/validation.js"

/**
 * Register customer payment tools on the server
 */
export function registerCustomerPaymentTools(server: FastMCP): void {
  // List Customer Payments
  server.addTool({
    name: "list_customer_payments",
    description: `List all customer payments (receipts).
Supports filtering by customer, date range, and pagination.
Returns payment details with customer, amount, and date.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: entityIdSchema.optional().describe("Filter by customer"),
      date_start: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_end: z.string().optional().describe("End date (YYYY-MM-DD)"),
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(200).optional(),
    }),
    annotations: {
      title: "List Customer Payments",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const queryParams: Record<string, string> = {}
      if (args.customer_id) queryParams.customer_id = args.customer_id
      if (args.date_start) queryParams.date_start = args.date_start
      if (args.date_end) queryParams.date_end = args.date_end
      if (args.page) queryParams.page = args.page.toString()
      if (args.per_page) queryParams.per_page = args.per_page.toString()

      const result = await zohoGet<{ customerpayments: CustomerPayment[] }>(
        "/customerpayments",
        args.organization_id,
        queryParams
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to list customer payments"
      }

      const payments = result.data?.customerpayments || []

      if (payments.length === 0) {
        return "No customer payments found."
      }

      const formatted = payments
        .map((p, index) => {
          return `${index + 1}. **${p.date}** - ${p.currency_code || ""} ${p.amount}
   - Payment ID: \`${p.payment_id}\`
   - Customer: ${p.customer_name || p.customer_id}
   - Mode: ${p.payment_mode || "N/A"}
   - Reference: ${p.reference_number || "N/A"}
   - Status: ${p.status || "N/A"}`
        })
        .join("\n\n")

      return `**Customer Payments** (${payments.length} items)\n\n${formatted}`
    },
  })

  // Get Customer Payment
  server.addTool({
    name: "get_customer_payment",
    description: `Get detailed information about a specific customer payment.
Returns full payment details including customer, amount, and applied invoices.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      payment_id: entityIdSchema.describe("Customer Payment ID"),
    }),
    annotations: {
      title: "Get Customer Payment Details",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoGet<{ payment: CustomerPayment }>(
        `/customerpayments/${args.payment_id}`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to get customer payment"
      }

      const payment = result.data?.payment

      if (!payment) {
        return "Customer payment not found"
      }

      return `**Customer Payment Details**

- **Payment ID**: \`${payment.payment_id}\`
- **Customer**: ${payment.customer_name || payment.customer_id}
- **Date**: ${payment.date}
- **Amount**: ${payment.currency_code || ""} ${payment.amount}
- **Payment Mode**: ${payment.payment_mode || "N/A"}
- **Account**: ${payment.account_name || payment.account_id || "N/A"}
- **Reference**: ${payment.reference_number || "N/A"}
- **Description**: ${payment.description || "N/A"}
- **Status**: ${payment.status || "N/A"}`
    },
  })

  // Create Customer Payment
  server.addTool({
    name: "create_customer_payment",
    description: `Create a new customer payment (receipt).
Use list_contacts to find customer_id values.
Use list_accounts to find account_id (deposit-to account) values.
Optionally apply to specific invoices.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: entityIdSchema.describe("Customer ID"),
      amount: moneySchema.describe("Payment amount (max 999,999,999.99, 2 decimal places)"),
      date: dateSchema.describe("Payment date (YYYY-MM-DD)"),
      payment_mode: z
        .enum(["cash", "check", "bankremittance", "banktransfer", "creditcard", "upi"])
        .optional()
        .describe("Payment mode"),
      account_id: entityIdSchema.describe("Deposit-to account ID"),
      reference_number: z.string().max(100).optional().describe("Reference number"),
      description: z.string().max(500).optional().describe("Payment description"),
      invoices: z
        .array(
          z.object({
            invoice_id: z.string().describe("Invoice ID to apply payment to"),
            amount_applied: z.number().positive().describe("Amount to apply to this invoice"),
          })
        )
        .optional()
        .describe("Invoices to apply payment against"),
    }),
    annotations: {
      title: "Create Customer Payment",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const payload: Record<string, unknown> = {
        customer_id: args.customer_id,
        amount: args.amount,
        date: args.date,
        account_id: args.account_id,
      }

      if (args.payment_mode) payload.payment_mode = args.payment_mode
      if (args.reference_number) payload.reference_number = args.reference_number
      if (args.description) payload.description = args.description
      if (args.invoices) payload.invoices = args.invoices

      const result = await zohoPost<{ payment: CustomerPayment }>(
        "/customerpayments",
        args.organization_id,
        payload
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to create customer payment"
      }

      const payment = result.data?.payment

      if (!payment) {
        return "Customer payment created but no details returned"
      }

      return `**Customer Payment Created Successfully**

- **Payment ID**: \`${payment.payment_id}\`
- **Customer**: ${payment.customer_name || payment.customer_id}
- **Date**: ${payment.date}
- **Amount**: ${payment.currency_code || ""} ${payment.amount}

Use this payment_id to reference this payment.`
    },
  })

  // Delete Customer Payment
  server.addTool({
    name: "delete_customer_payment",
    description: `Delete a customer payment.
This will remove the payment record and unapply it from any invoices.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      payment_id: entityIdSchema.describe("Customer Payment ID to delete"),
    }),
    annotations: {
      title: "Delete Customer Payment",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoDelete<Record<string, unknown>>(
        `/customerpayments/${args.payment_id}`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to delete customer payment"
      }

      return `**Customer Payment Deleted Successfully**

Payment \`${args.payment_id}\` has been deleted.`
    },
  })
}
