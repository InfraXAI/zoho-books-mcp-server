/**
 * Vendor Payment tools for Zoho Books API
 */

import { z } from "zod"
import type { FastMCP } from "fastmcp"
import { zohoGet, zohoPost, zohoDelete } from "../api/client.js"
import type { VendorPayment } from "../api/types.js"
import { optionalOrganizationIdSchema, dateSchema, moneySchema, entityIdSchema } from "../utils/validation.js"

/**
 * Register vendor payment tools on the server
 */
export function registerVendorPaymentTools(server: FastMCP): void {
  // List Vendor Payments
  server.addTool({
    name: "list_vendor_payments",
    description: `List all vendor payments (bill payments).
Supports filtering by vendor and date range.
Returns payment details with vendor, amount, and date.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      vendor_id: entityIdSchema.optional().describe("Filter by vendor"),
      date_start: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_end: z.string().optional().describe("End date (YYYY-MM-DD)"),
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(200).optional(),
    }),
    annotations: {
      title: "List Vendor Payments",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const queryParams: Record<string, string> = {}
      if (args.vendor_id) queryParams.vendor_id = args.vendor_id
      if (args.date_start) queryParams.date_start = args.date_start
      if (args.date_end) queryParams.date_end = args.date_end
      if (args.page) queryParams.page = args.page.toString()
      if (args.per_page) queryParams.per_page = args.per_page.toString()

      const result = await zohoGet<{ vendorpayments: VendorPayment[] }>(
        "/vendorpayments",
        args.organization_id,
        queryParams
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to list vendor payments"
      }

      const payments = result.data?.vendorpayments || []

      if (payments.length === 0) {
        return "No vendor payments found."
      }

      const formatted = payments
        .map((p, index) => {
          return `${index + 1}. **${p.date}** - ${p.currency_code || ""} ${p.amount}
   - Payment ID: \`${p.payment_id}\`
   - Vendor: ${p.vendor_name || p.vendor_id}
   - Mode: ${p.payment_mode || "N/A"}
   - Paid Through: ${p.paid_through_account_name || p.paid_through_account_id || "N/A"}
   - Reference: ${p.reference_number || "N/A"}
   - Status: ${p.status || "N/A"}`
        })
        .join("\n\n")

      return `**Vendor Payments** (${payments.length} items)\n\n${formatted}`
    },
  })

  // Get Vendor Payment
  server.addTool({
    name: "get_vendor_payment",
    description: `Get detailed information about a specific vendor payment.
Returns full payment details including vendor, amount, and applied bills.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      payment_id: entityIdSchema.describe("Vendor Payment ID"),
    }),
    annotations: {
      title: "Get Vendor Payment Details",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoGet<{ vendorpayment: VendorPayment }>(
        `/vendorpayments/${args.payment_id}`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to get vendor payment"
      }

      const payment = result.data?.vendorpayment

      if (!payment) {
        return "Vendor payment not found"
      }

      return `**Vendor Payment Details**

- **Payment ID**: \`${payment.payment_id}\`
- **Vendor**: ${payment.vendor_name || payment.vendor_id}
- **Date**: ${payment.date}
- **Amount**: ${payment.currency_code || ""} ${payment.amount}
- **Payment Mode**: ${payment.payment_mode || "N/A"}
- **Paid Through**: ${payment.paid_through_account_name || payment.paid_through_account_id || "N/A"}
- **Reference**: ${payment.reference_number || "N/A"}
- **Description**: ${payment.description || "N/A"}
- **Status**: ${payment.status || "N/A"}`
    },
  })

  // Create Vendor Payment
  server.addTool({
    name: "create_vendor_payment",
    description: `Create a new vendor payment (bill payment).
Use list_contacts to find vendor_id values.
Use list_accounts to find paid_through_account_id values.
Optionally apply to specific bills.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      vendor_id: entityIdSchema.describe("Vendor ID"),
      amount: moneySchema.describe("Payment amount (max 999,999,999.99, 2 decimal places)"),
      date: dateSchema.describe("Payment date (YYYY-MM-DD)"),
      paid_through_account_id: entityIdSchema.describe("Payment account ID (bank/cash/credit card)"),
      payment_mode: z
        .enum(["cash", "check", "bankremittance", "banktransfer", "creditcard", "upi"])
        .optional()
        .describe("Payment mode"),
      reference_number: z.string().max(100).optional().describe("Reference number"),
      description: z.string().max(500).optional().describe("Payment description"),
      bills: z
        .array(
          z.object({
            bill_id: z.string().describe("Bill ID to apply payment to"),
            amount_applied: z.number().positive().describe("Amount to apply to this bill"),
          })
        )
        .optional()
        .describe("Bills to apply payment against"),
    }),
    annotations: {
      title: "Create Vendor Payment",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const payload: Record<string, unknown> = {
        vendor_id: args.vendor_id,
        amount: args.amount,
        date: args.date,
        paid_through_account_id: args.paid_through_account_id,
      }

      if (args.payment_mode) payload.payment_mode = args.payment_mode
      if (args.reference_number) payload.reference_number = args.reference_number
      if (args.description) payload.description = args.description
      if (args.bills) payload.bills = args.bills

      const result = await zohoPost<{ vendorpayment: VendorPayment }>(
        "/vendorpayments",
        args.organization_id,
        payload
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to create vendor payment"
      }

      const payment = result.data?.vendorpayment

      if (!payment) {
        return "Vendor payment created but no details returned"
      }

      return `**Vendor Payment Created Successfully**

- **Payment ID**: \`${payment.payment_id}\`
- **Vendor**: ${payment.vendor_name || payment.vendor_id}
- **Date**: ${payment.date}
- **Amount**: ${payment.currency_code || ""} ${payment.amount}

Use this payment_id to reference this payment.`
    },
  })

  // Delete Vendor Payment
  server.addTool({
    name: "delete_vendor_payment",
    description: `Delete a vendor payment.
This will remove the payment record and unapply it from any bills.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      payment_id: entityIdSchema.describe("Vendor Payment ID to delete"),
    }),
    annotations: {
      title: "Delete Vendor Payment",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoDelete<Record<string, unknown>>(
        `/vendorpayments/${args.payment_id}`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to delete vendor payment"
      }

      return `**Vendor Payment Deleted Successfully**

Payment \`${args.payment_id}\` has been deleted.`
    },
  })
}
