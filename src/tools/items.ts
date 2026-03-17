/**
 * Item tools for Zoho Books API
 */

import { z } from "zod"
import type { FastMCP } from "fastmcp"
import { zohoGet, zohoPost, zohoPut } from "../api/client.js"
import type { Item } from "../api/types.js"
import { optionalOrganizationIdSchema, moneySchema, entityIdSchema } from "../utils/validation.js"

/**
 * Register item tools on the server
 */
export function registerItemTools(server: FastMCP): void {
  // List Items
  server.addTool({
    name: "list_items",
    description: `List all items (products and services).
Supports filtering by name search and pagination.
Returns item details with name, rate, and type.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      name: z.string().optional().describe("Search items by name"),
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(200).optional(),
    }),
    annotations: {
      title: "List Items",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const queryParams: Record<string, string> = {}
      if (args.name) queryParams.name = args.name
      if (args.page) queryParams.page = args.page.toString()
      if (args.per_page) queryParams.per_page = args.per_page.toString()

      const result = await zohoGet<{ items: Item[] }>(
        "/items",
        args.organization_id,
        queryParams
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to list items"
      }

      const items = result.data?.items || []

      if (items.length === 0) {
        return "No items found."
      }

      const formatted = items
        .map((item, index) => {
          return `${index + 1}. **${item.name}** - ${item.currency_code || ""} ${item.rate}
   - Item ID: \`${item.item_id}\`
   - SKU: ${item.sku || "N/A"}
   - Type: ${item.product_type || "N/A"}
   - HSN/SAC: ${item.hsn_or_sac || "N/A"}
   - Status: ${item.status || "N/A"}`
        })
        .join("\n\n")

      return `**Items** (${items.length} items)\n\n${formatted}`
    },
  })

  // Get Item
  server.addTool({
    name: "get_item",
    description: `Get detailed information about a specific item.
Returns full item details including rate, accounts, and tax info.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      item_id: entityIdSchema.describe("Item ID"),
    }),
    annotations: {
      title: "Get Item Details",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoGet<{ item: Item }>(
        `/items/${args.item_id}`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to get item"
      }

      const item = result.data?.item

      if (!item) {
        return "Item not found"
      }

      return `**Item Details**

- **Item ID**: \`${item.item_id}\`
- **Name**: ${item.name}
- **Rate**: ${item.currency_code || ""} ${item.rate}
- **Purchase Rate**: ${item.purchase_rate !== undefined ? `${item.currency_code || ""} ${item.purchase_rate}` : "N/A"}
- **SKU**: ${item.sku || "N/A"}
- **Type**: ${item.product_type || "N/A"}
- **HSN/SAC**: ${item.hsn_or_sac || "N/A"}
- **Unit**: ${item.unit || "N/A"}
- **Tax**: ${item.tax_name || "N/A"}
- **Income Account**: ${item.account_name || item.account_id || "N/A"}
- **Purchase Account**: ${item.purchase_account_id || "N/A"}
- **Description**: ${item.description || "N/A"}
- **Status**: ${item.status || "N/A"}`
    },
  })

  // Create Item
  server.addTool({
    name: "create_item",
    description: `Create a new item (product or service).
Use list_accounts to find account_id (income account) and purchase_account_id values.
Use list_taxes to find tax_id values.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      name: z.string().max(200).describe("Item name"),
      rate: moneySchema.describe("Selling rate (max 999,999,999.99, 2 decimal places)"),
      description: z.string().max(500).optional().describe("Item description"),
      sku: z.string().max(100).optional().describe("Stock Keeping Unit"),
      product_type: z.enum(["goods", "service"]).optional().describe("Product type"),
      hsn_or_sac: z.string().max(20).optional().describe("HSN or SAC code (India GST)"),
      tax_id: entityIdSchema.optional().describe("Tax ID"),
      account_id: entityIdSchema.optional().describe("Income account ID"),
      purchase_rate: moneySchema.optional().describe("Purchase rate"),
      purchase_account_id: entityIdSchema.optional().describe("Purchase account ID"),
      unit: z.string().max(50).optional().describe("Unit of measurement"),
    }),
    annotations: {
      title: "Create Item",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const payload: Record<string, unknown> = {
        name: args.name,
        rate: args.rate,
      }

      if (args.description) payload.description = args.description
      if (args.sku) payload.sku = args.sku
      if (args.product_type) payload.product_type = args.product_type
      if (args.hsn_or_sac) payload.hsn_or_sac = args.hsn_or_sac
      if (args.tax_id) payload.tax_id = args.tax_id
      if (args.account_id) payload.account_id = args.account_id
      if (args.purchase_rate !== undefined || args.purchase_account_id) {
        payload.item_type = "sales_and_purchases"
        if (args.purchase_rate !== undefined) payload.purchase_rate = args.purchase_rate
        if (args.purchase_account_id) payload.purchase_account_id = args.purchase_account_id
      }
      if (args.unit) payload.unit = args.unit

      const result = await zohoPost<{ item: Item }>(
        "/items",
        args.organization_id,
        payload
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to create item"
      }

      const item = result.data?.item

      if (!item) {
        return "Item created but no details returned"
      }

      return `**Item Created Successfully**

- **Item ID**: \`${item.item_id}\`
- **Name**: ${item.name}
- **Rate**: ${item.currency_code || ""} ${item.rate}
- **Type**: ${item.product_type || "N/A"}

Use this item_id to reference this item in invoices, estimates, and purchase orders.`
    },
  })

  // Update Item
  server.addTool({
    name: "update_item",
    description: `Update an existing item.
Only provided fields will be updated.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      item_id: entityIdSchema.describe("Item ID to update"),
      name: z.string().max(200).optional().describe("Item name"),
      rate: moneySchema.optional().describe("Selling rate"),
      description: z.string().max(500).optional().describe("Item description"),
      sku: z.string().max(100).optional().describe("Stock Keeping Unit"),
      product_type: z.enum(["goods", "service"]).optional().describe("Product type"),
      hsn_or_sac: z.string().max(20).optional().describe("HSN or SAC code (India GST)"),
      tax_id: entityIdSchema.optional().describe("Tax ID"),
      account_id: entityIdSchema.optional().describe("Income account ID"),
      purchase_rate: moneySchema.optional().describe("Purchase rate"),
      purchase_account_id: entityIdSchema.optional().describe("Purchase account ID"),
      unit: z.string().max(50).optional().describe("Unit of measurement"),
    }),
    annotations: {
      title: "Update Item",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const payload: Record<string, unknown> = {}

      if (args.name) payload.name = args.name
      if (args.rate) payload.rate = args.rate
      if (args.description) payload.description = args.description
      if (args.sku) payload.sku = args.sku
      if (args.product_type) payload.product_type = args.product_type
      if (args.hsn_or_sac) payload.hsn_or_sac = args.hsn_or_sac
      if (args.tax_id) payload.tax_id = args.tax_id
      if (args.account_id) payload.account_id = args.account_id
      if (args.purchase_rate !== undefined || args.purchase_account_id) {
        payload.item_type = "sales_and_purchases"
        if (args.purchase_rate !== undefined) payload.purchase_rate = args.purchase_rate
        if (args.purchase_account_id) payload.purchase_account_id = args.purchase_account_id
      }
      if (args.unit) payload.unit = args.unit

      const result = await zohoPut<{ item: Item }>(
        `/items/${args.item_id}`,
        args.organization_id,
        payload
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to update item"
      }

      const item = result.data?.item

      if (!item) {
        return "Item updated but no details returned"
      }

      return `**Item Updated Successfully**

- **Item ID**: \`${item.item_id}\`
- **Name**: ${item.name}
- **Rate**: ${item.currency_code || ""} ${item.rate}
- **Status**: ${item.status || "N/A"}`
    },
  })

  // Mark Item Active
  server.addTool({
    name: "mark_item_active",
    description: `Mark an inactive item as active.
Reactivates the item so it can be used in transactions.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      item_id: entityIdSchema.describe("Item ID to activate"),
    }),
    annotations: {
      title: "Mark Item Active",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoPost<Record<string, unknown>>(
        `/items/${args.item_id}/active`,
        args.organization_id,
        {}
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to mark item as active"
      }

      return `**Item Activated Successfully**

Item \`${args.item_id}\` has been marked as active.`
    },
  })
}
