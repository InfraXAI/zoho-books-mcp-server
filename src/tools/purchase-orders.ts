/**
 * Purchase Order tools for Zoho Books API
 */

import { z } from "zod"
import type { FastMCP } from "fastmcp"
import { zohoGet, zohoPost, zohoPut } from "../api/client.js"
import type { PurchaseOrder, PurchaseOrderLineItem } from "../api/types.js"
import { optionalOrganizationIdSchema, dateSchema, entityIdSchema } from "../utils/validation.js"

// Zod schema for purchase order line items
const poLineItemSchema = z.object({
  item_id: z.string().optional().describe("Item ID"),
  name: z.string().optional().describe("Item name"),
  description: z.string().optional().describe("Description"),
  quantity: z.number().positive().default(1).describe("Quantity"),
  rate: z.number().nonnegative().describe("Unit rate"),
  tax_id: z.string().optional().describe("Tax ID"),
})

/**
 * Register purchase order tools on the server
 */
export function registerPurchaseOrderTools(server: FastMCP): void {
  // List Purchase Orders
  server.addTool({
    name: "list_purchase_orders",
    description: `List all purchase orders.
Supports filtering by vendor, status, and date range.
Returns purchase order details with vendor, total, and status.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      vendor_id: entityIdSchema.optional().describe("Filter by vendor"),
      status: z
        .enum(["draft", "open", "billed", "cancelled"])
        .optional()
        .describe("Filter by status"),
      date_start: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_end: z.string().optional().describe("End date (YYYY-MM-DD)"),
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(200).optional(),
    }),
    annotations: {
      title: "List Purchase Orders",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const queryParams: Record<string, string> = {}
      if (args.vendor_id) queryParams.vendor_id = args.vendor_id
      if (args.status) queryParams.status = args.status
      if (args.date_start) queryParams.date_start = args.date_start
      if (args.date_end) queryParams.date_end = args.date_end
      if (args.page) queryParams.page = args.page.toString()
      if (args.per_page) queryParams.per_page = args.per_page.toString()

      const result = await zohoGet<{ purchaseorders: PurchaseOrder[] }>(
        "/purchaseorders",
        args.organization_id,
        queryParams
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to list purchase orders"
      }

      const orders = result.data?.purchaseorders || []

      if (orders.length === 0) {
        return "No purchase orders found."
      }

      const formatted = orders
        .map((po, index) => {
          return `${index + 1}. **${po.purchaseorder_number || "No number"}** - ${po.vendor_name || "Unknown vendor"}
   - PO ID: \`${po.purchaseorder_id}\`
   - Date: ${po.date}
   - Delivery Date: ${po.delivery_date || "N/A"}
   - Total: ${po.currency_code || "INR"} ${po.total}
   - Status: ${po.status || "N/A"}`
        })
        .join("\n\n")

      return `**Purchase Orders** (${orders.length} items)\n\n${formatted}`
    },
  })

  // Get Purchase Order
  server.addTool({
    name: "get_purchase_order",
    description: `Get detailed information about a specific purchase order.
Returns full purchase order details including line items and vendor info.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      purchaseorder_id: entityIdSchema.describe("Purchase Order ID"),
    }),
    annotations: {
      title: "Get Purchase Order Details",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoGet<{ purchaseorder: PurchaseOrder }>(
        `/purchaseorders/${args.purchaseorder_id}`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to get purchase order"
      }

      const po = result.data?.purchaseorder

      if (!po) {
        return "Purchase order not found"
      }

      let details = `**Purchase Order Details**

- **PO ID**: \`${po.purchaseorder_id}\`
- **PO Number**: ${po.purchaseorder_number || "N/A"}
- **Vendor**: ${po.vendor_name || po.vendor_id}
- **Date**: ${po.date}
- **Delivery Date**: ${po.delivery_date || "N/A"}
- **Total**: ${po.currency_code || "INR"} ${po.total}
- **Status**: ${po.status || "N/A"}
- **Reference**: ${po.reference_number || "N/A"}
- **Notes**: ${po.notes || "N/A"}

**Line Items**:`

      if (po.line_items && po.line_items.length > 0) {
        po.line_items.forEach((item: PurchaseOrderLineItem, i: number) => {
          details += `\n${i + 1}. ${item.name || item.item_id || "Item"} - Qty: ${item.quantity || 1} x ${po.currency_code || "INR"} ${item.rate || 0} = ${po.currency_code || "INR"} ${(item as Record<string, unknown>).item_total ?? item.amount ?? "N/A"}`
          if (item.description) details += `\n   Description: ${item.description}`
        })
      }

      return details
    },
  })

  // Create Purchase Order
  server.addTool({
    name: "create_purchase_order",
    description: `Create a new purchase order.
Use list_contacts to find vendor_id values.
Use list_items to find item_id values for line items.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      vendor_id: entityIdSchema.describe("Vendor ID"),
      date: dateSchema.describe("Purchase order date (YYYY-MM-DD)"),
      delivery_date: dateSchema.optional().describe("Expected delivery date (YYYY-MM-DD)"),
      purchaseorder_number: z.string().max(100).optional().describe("Purchase order number"),
      reference_number: z.string().max(100).optional().describe("Reference number"),
      notes: z.string().max(2000).optional().describe("Notes"),
      line_items: z.array(poLineItemSchema).min(1).describe("Array of line items"),
    }),
    annotations: {
      title: "Create Purchase Order",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const payload: Record<string, unknown> = {
        vendor_id: args.vendor_id,
        date: args.date,
        line_items: args.line_items,
      }

      if (args.delivery_date) payload.delivery_date = args.delivery_date
      if (args.purchaseorder_number) payload.purchaseorder_number = args.purchaseorder_number
      if (args.reference_number) payload.reference_number = args.reference_number
      if (args.notes) payload.notes = args.notes

      const result = await zohoPost<{ purchaseorder: PurchaseOrder }>(
        "/purchaseorders",
        args.organization_id,
        payload
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to create purchase order"
      }

      const po = result.data?.purchaseorder

      if (!po) {
        return "Purchase order created but no details returned"
      }

      return `**Purchase Order Created Successfully**

- **PO ID**: \`${po.purchaseorder_id}\`
- **PO Number**: ${po.purchaseorder_number || "N/A"}
- **Date**: ${po.date}
- **Total**: ${po.currency_code || "INR"} ${po.total}

Use this purchaseorder_id to update, open, or cancel this purchase order.`
    },
  })

  // Update Purchase Order
  server.addTool({
    name: "update_purchase_order",
    description: `Update an existing purchase order.
Only provided fields will be updated.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      purchaseorder_id: entityIdSchema.describe("Purchase Order ID to update"),
      vendor_id: entityIdSchema.optional().describe("Vendor ID"),
      date: dateSchema.optional().describe("Purchase order date (YYYY-MM-DD)"),
      delivery_date: dateSchema.optional().describe("Expected delivery date (YYYY-MM-DD)"),
      purchaseorder_number: z.string().max(100).optional().describe("Purchase order number"),
      reference_number: z.string().max(100).optional().describe("Reference number"),
      notes: z.string().max(2000).optional().describe("Notes"),
      line_items: z.array(poLineItemSchema).min(1).optional().describe("Array of line items"),
    }),
    annotations: {
      title: "Update Purchase Order",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const payload: Record<string, unknown> = {}

      if (args.vendor_id) payload.vendor_id = args.vendor_id
      if (args.date) payload.date = args.date
      if (args.delivery_date) payload.delivery_date = args.delivery_date
      if (args.purchaseorder_number) payload.purchaseorder_number = args.purchaseorder_number
      if (args.reference_number) payload.reference_number = args.reference_number
      if (args.notes) payload.notes = args.notes
      if (args.line_items) payload.line_items = args.line_items

      const result = await zohoPut<{ purchaseorder: PurchaseOrder }>(
        `/purchaseorders/${args.purchaseorder_id}`,
        args.organization_id,
        payload
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to update purchase order"
      }

      const po = result.data?.purchaseorder

      if (!po) {
        return "Purchase order updated but no details returned"
      }

      return `**Purchase Order Updated Successfully**

- **PO ID**: \`${po.purchaseorder_id}\`
- **PO Number**: ${po.purchaseorder_number || "N/A"}
- **Total**: ${po.currency_code || "INR"} ${po.total}
- **Status**: ${po.status || "N/A"}`
    },
  })

  // Mark Purchase Order as Open
  server.addTool({
    name: "mark_purchase_order_open",
    description: `Mark a purchase order as open.
Changes the purchase order status to 'open'.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      purchaseorder_id: entityIdSchema.describe("Purchase Order ID to mark as open"),
    }),
    annotations: {
      title: "Mark Purchase Order Open",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoPost<Record<string, unknown>>(
        `/purchaseorders/${args.purchaseorder_id}/status/open`,
        args.organization_id,
        {}
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to mark purchase order as open"
      }

      return `**Purchase Order Marked as Open**

Purchase order \`${args.purchaseorder_id}\` status changed to open.`
    },
  })

  // Cancel Purchase Order
  server.addTool({
    name: "cancel_purchase_order",
    description: `Cancel a purchase order.
Changes the purchase order status to 'cancelled'.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      purchaseorder_id: entityIdSchema.describe("Purchase Order ID to cancel"),
    }),
    annotations: {
      title: "Cancel Purchase Order",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoPost<Record<string, unknown>>(
        `/purchaseorders/${args.purchaseorder_id}/status/cancelled`,
        args.organization_id,
        {}
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to cancel purchase order"
      }

      return `**Purchase Order Cancelled**

Purchase order \`${args.purchaseorder_id}\` status changed to cancelled.`
    },
  })
}
