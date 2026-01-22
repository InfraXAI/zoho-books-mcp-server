/**
 * Unit tests for MIME type utilities
 */
import { describe, it, expect } from "vitest"
import {
  getMimeType,
  isSupportedExtension,
  getSupportedExtensions,
  validateAttachment,
} from "../../utils/mime-types.js"

describe("MIME Type Utilities", () => {
  describe("getMimeType", () => {
    it("returns correct MIME type for PDF", () => {
      expect(getMimeType("/path/to/file.pdf")).toBe("application/pdf")
      expect(getMimeType("document.PDF")).toBe("application/pdf")
    })

    it("returns correct MIME type for images", () => {
      expect(getMimeType("image.png")).toBe("image/png")
      expect(getMimeType("photo.jpg")).toBe("image/jpeg")
      expect(getMimeType("photo.jpeg")).toBe("image/jpeg")
      expect(getMimeType("animation.gif")).toBe("image/gif")
    })

    it("returns correct MIME type for Office documents", () => {
      expect(getMimeType("document.doc")).toBe("application/msword")
      expect(getMimeType("document.docx")).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
      expect(getMimeType("spreadsheet.xls")).toBe("application/vnd.ms-excel")
      expect(getMimeType("spreadsheet.xlsx")).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    })

    it("returns octet-stream for unknown extensions", () => {
      expect(getMimeType("file.xyz")).toBe("application/octet-stream")
      expect(getMimeType("file.unknown")).toBe("application/octet-stream")
    })
  })

  describe("isSupportedExtension", () => {
    it("returns true for supported extensions", () => {
      expect(isSupportedExtension("file.pdf")).toBe(true)
      expect(isSupportedExtension("file.png")).toBe(true)
      expect(isSupportedExtension("file.jpg")).toBe(true)
      expect(isSupportedExtension("file.jpeg")).toBe(true)
      expect(isSupportedExtension("file.gif")).toBe(true)
      expect(isSupportedExtension("file.doc")).toBe(true)
      expect(isSupportedExtension("file.docx")).toBe(true)
      expect(isSupportedExtension("file.xls")).toBe(true)
      expect(isSupportedExtension("file.xlsx")).toBe(true)
    })

    it("returns false for unsupported extensions", () => {
      expect(isSupportedExtension("file.zip")).toBe(false)
      expect(isSupportedExtension("file.exe")).toBe(false)
      expect(isSupportedExtension("file.mp4")).toBe(false)
      expect(isSupportedExtension("file.mp3")).toBe(false)
    })

    it("handles uppercase extensions", () => {
      expect(isSupportedExtension("FILE.PDF")).toBe(true)
      expect(isSupportedExtension("IMAGE.PNG")).toBe(true)
    })
  })

  describe("getSupportedExtensions", () => {
    it("returns array of supported extensions", () => {
      const extensions = getSupportedExtensions()

      expect(Array.isArray(extensions)).toBe(true)
      expect(extensions).toContain(".pdf")
      expect(extensions).toContain(".png")
      expect(extensions).toContain(".jpg")
    })
  })

  describe("validateAttachment", () => {
    it("returns valid for supported files", () => {
      expect(validateAttachment("receipt.pdf").valid).toBe(true)
      expect(validateAttachment("invoice.png").valid).toBe(true)
      expect(validateAttachment("document.docx").valid).toBe(true)
    })

    it("returns invalid for unsupported files", () => {
      const result = validateAttachment("archive.zip")
      expect(result.valid).toBe(false)
      expect(result.error).toContain("Unsupported file type")
      expect(result.error).toContain(".zip")
    })

    it("returns invalid for files without extension", () => {
      const result = validateAttachment("noextension")
      expect(result.valid).toBe(false)
      expect(result.error).toContain("no extension")
    })
  })
})
