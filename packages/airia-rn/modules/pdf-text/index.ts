import { requireNativeModule } from 'expo-modules-core'

/**
 * Result of a native extraction attempt. Failure carries a human-readable
 * `reason` so the prompt can state why a document is unreadable rather than
 * leaving the model to guess at its contents.
 */
export type PdfTextResult =
  | { ok: true; text: string; pageCount: number }
  | { ok: false; reason: string }

interface PdfTextNativeModule {
  extractText(uri: string): Promise<PdfTextResult>
}

const PdfText = requireNativeModule<PdfTextNativeModule>('PdfText')

/** Extracts text from a PDF at a local file URI. Never throws. */
export async function extractPdfText(uri: string): Promise<PdfTextResult> {
  try {
    return await PdfText.extractText(uri)
  } catch (err) {
    return { ok: false, reason: `could not be read (${(err as Error).message})` }
  }
}
