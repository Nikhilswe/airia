// AIrIA — attachment text extraction
// Turns an attached file into prompt-ready text so the model reasons about the
// contents rather than the filename. Anything we can't read is reported as
// unread, never silently dropped — a model told nothing will invent something.

import * as FileSystem from 'expo-file-system/legacy'
import type { AttachmentHint } from '@airia/types'

/** Keep a single document from crowding the whole context window. */
const MAX_CHARS_PER_DOC = 12_000

const TEXT_EXTS = /\.(txt|md|markdown|csv|tsv|json|jsonl|ya?ml|toml|ini|env|log|xml|html?|css|scss|sql|patch|diff|gradle|properties)$/i
const CODE_EXTS = /\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go|java|cpp|cc|c|h|hpp|rb|swift|kt|kts|cs|php|sh|bash|zsh|dockerfile)$/i
const TEXT_MIMES = /^(text\/|application\/(json|xml|x-yaml|x-sh|x-python|javascript|typescript|sql))/i
const PDF_RE = /(^application\/pdf$)|(\.pdf$)/i

export interface ExtractedAttachment {
  filename: string
  /** Extracted body, already truncated. Null when extraction wasn't possible. */
  text: string | null
  /** Why extraction failed, for an honest note in the prompt. */
  reason?: string
  truncated: boolean
}

function isTextLike(a: AttachmentHint): boolean {
  const name = a.filename ?? ''
  return TEXT_EXTS.test(name) || CODE_EXTS.test(name)
    || (!!a.mimeType && TEXT_MIMES.test(a.mimeType))
}

function isPdf(a: AttachmentHint): boolean {
  return PDF_RE.test(a.mimeType ?? '') || PDF_RE.test(a.filename ?? '')
}

function truncate(text: string): { text: string; truncated: boolean } {
  // Strip NULs and normalise line endings; both survive some encodings.
  const clean = text.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trimEnd()
  if (clean.length <= MAX_CHARS_PER_DOC) return { text: clean, truncated: false }
  return { text: clean.slice(0, MAX_CHARS_PER_DOC), truncated: true }
}

async function extractPdf(uri: string): Promise<string> {
  // unpdf ships a pdfjs build with no native dependency, but it expects a
  // fairly complete JS runtime — hence the caller's try/catch.
  const { extractText, getDocumentProxy } = await import('unpdf')
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  })
  const binary = globalThis.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const pdf = await getDocumentProxy(bytes)
  const { text } = await extractText(pdf, { mergePages: true })
  return Array.isArray(text) ? text.join('\n\n') : text
}

export async function extractAttachment(a: AttachmentHint): Promise<ExtractedAttachment> {
  const filename = a.filename ?? 'attachment'
  if (!a.uri) return { filename, text: null, reason: 'no local copy', truncated: false }

  try {
    if (isTextLike(a)) {
      const raw = await FileSystem.readAsStringAsync(a.uri)
      const { text, truncated } = truncate(raw)
      return { filename, text, truncated }
    }

    if (isPdf(a)) {
      const raw = await extractPdf(a.uri)
      if (!raw.trim()) {
        return { filename, text: null, reason: 'no selectable text (likely a scan)', truncated: false }
      }
      const { text, truncated } = truncate(raw)
      return { filename, text, truncated }
    }

    return { filename, text: null, reason: 'unsupported file type', truncated: false }
  } catch (err) {
    return {
      filename,
      text: null,
      reason: `could not be read (${(err as Error).message})`,
      truncated: false,
    }
  }
}

/**
 * Builds the document block appended to the user's prompt. Returns an empty
 * string when there are no file attachments to describe.
 */
export async function buildAttachmentContext(attachments?: AttachmentHint[]): Promise<string> {
  const files = attachments?.filter(a => a.type === 'file') ?? []
  if (!files.length) return ''

  const results = await Promise.all(files.map(extractAttachment))
  const blocks = results.map(r => {
    if (r.text === null) {
      return `[Attached: ${r.filename} — contents ${r.reason}. Do not guess what it contains.]`
    }
    const note = r.truncated ? ' (truncated)' : ''
    return `[Attached: ${r.filename}${note}]\n${r.text}`
  })

  return `\n\n${blocks.join('\n\n')}`
}
