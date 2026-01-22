/**
 * MIME type utilities for file attachments
 */

import * as path from "path"

// Map of file extensions to MIME types
const MIME_TYPES: Record<string, string> = {
  // Documents
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".rtf": "application/rtf",

  // Images
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",

  // Archives
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
}

// Supported extensions for Zoho Books attachments
const ZOHO_SUPPORTED_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
])

/**
 * Get the MIME type for a file based on its extension
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || "application/octet-stream"
}

/**
 * Check if a file extension is supported by Zoho Books for attachments
 */
export function isSupportedExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return ZOHO_SUPPORTED_EXTENSIONS.has(ext)
}

/**
 * Get a list of supported file extensions for Zoho Books attachments
 */
export function getSupportedExtensions(): string[] {
  return Array.from(ZOHO_SUPPORTED_EXTENSIONS)
}

/**
 * Validate a file for Zoho Books attachment upload
 */
export function validateAttachment(filePath: string): { valid: boolean; error?: string } {
  const ext = path.extname(filePath).toLowerCase()

  if (!ext) {
    return { valid: false, error: "File has no extension" }
  }

  if (!isSupportedExtension(filePath)) {
    return {
      valid: false,
      error: `Unsupported file type: ${ext}. Supported types: ${getSupportedExtensions().join(", ")}`,
    }
  }

  return { valid: true }
}
