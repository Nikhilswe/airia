package expo.modules.pdftext

import android.net.Uri
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

// PDF text extraction via PdfBox-Android. Android's built-in PdfRenderer only
// rasterises pages, and pdf.js cannot run under Hermes, so text extraction has
// to happen natively.
class PdfTextModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PdfText")

    OnCreate {
      // Unpacks the font/resource assets PdfBox needs; cheap and idempotent.
      appContext.reactContext?.let { PDFBoxResourceLoader.init(it) }
    }

    AsyncFunction("extractText") { uri: String ->
      val file = resolveFile(uri)
        ?: return@AsyncFunction mapOf("ok" to false, "reason" to "could not be located on disk")

      try {
        PDDocument.load(file).use { document ->
          if (document.isEncrypted) {
            return@AsyncFunction mapOf("ok" to false, "reason" to "is password protected")
          }

          val text = PDFTextStripper().getText(document)
          if (text.isBlank()) {
            return@AsyncFunction mapOf(
              "ok" to false,
              "reason" to "has no selectable text (likely a scan)"
            )
          }

          mapOf("ok" to true, "text" to text, "pageCount" to document.numberOfPages)
        }
      } catch (e: Exception) {
        mapOf("ok" to false, "reason" to "could not be parsed (${e.message ?: "unknown error"})")
      }
    }
  }

  /** DocumentPicker hands back file:// URIs; accept bare paths too. */
  private fun resolveFile(uri: String): File? {
    val path = if (uri.startsWith("file://")) Uri.parse(uri).path else uri
    val file = path?.let { File(it) }
    return if (file != null && file.exists()) file else null
  }
}
