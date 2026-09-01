import ExpoModulesCore
import PDFKit

// PDF text extraction via PDFKit, which ships with iOS — no third-party
// dependency and no JS-side PDF parser (pdf.js cannot run under Hermes).
public class PdfTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PdfText")

    AsyncFunction("extractText") { (uri: String) -> [String: Any] in
      guard let url = Self.fileURL(from: uri) else {
        return ["ok": false, "reason": "could not be located on disk"]
      }

      guard let document = PDFDocument(url: url) else {
        return ["ok": false, "reason": "is not a readable PDF"]
      }

      if document.isLocked {
        return ["ok": false, "reason": "is password protected"]
      }

      // `document.string` covers the whole document but returns nil for scans,
      // which carry no text layer at all.
      guard let text = document.string, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        return ["ok": false, "reason": "has no selectable text (likely a scan)"]
      }

      return ["ok": true, "text": text, "pageCount": document.pageCount]
    }
  }

  /// Accepts both `file://` URLs and bare paths; DocumentPicker yields the former.
  private static func fileURL(from uri: String) -> URL? {
    let url = uri.hasPrefix("file://") ? URL(string: uri) : URL(fileURLWithPath: uri)
    guard let url, FileManager.default.fileExists(atPath: url.path) else { return nil }
    return url
  }
}
