// AIrIA — AttachmentPreview
// Shows what the user attached to a turn. Images render as thumbnails so the
// transcript still makes sense on re-read; documents get a labelled card since
// there's nothing to show but the file itself.

import React from 'react'
import { View, Image, Text, StyleSheet } from 'react-native'
import type { AttachmentHint } from '@airia/types'
import type { ThemeColors } from './ThemeToken'
import { THEMES } from './ThemeToken'

interface AttachmentPreviewProps {
  attachments: AttachmentHint[]
  theme?: ThemeColors
  align?: 'left' | 'right'
}

function formatSize(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

function docIcon(a: AttachmentHint): string {
  const name = a.filename ?? ''
  if (/\.pdf$/i.test(name)) return 'PDF'
  if (/\.(pptx?|key)$/i.test(name)) return 'DECK'
  if (/\.(xlsx?|csv|numbers)$/i.test(name)) return 'SHEET'
  if (/\.(docx?|pages|rtf)$/i.test(name)) return 'DOC'
  if (/\.(txt|md)$/i.test(name)) return 'TXT'
  return 'FILE'
}

export function AttachmentPreview({
  attachments,
  theme = THEMES.dawn,
  align = 'right',
}: AttachmentPreviewProps) {
  if (!attachments.length) return null

  return (
    <View style={[styles.row, align === 'right' && styles.rowRight]}>
      {attachments.map((att, i) => {
        if (att.type === 'image' && att.uri) {
          return (
            <Image
              key={i}
              source={{ uri: att.uri }}
              style={[styles.thumb, { borderColor: theme.surfaceBorder }]}
              accessibilityLabel={att.filename ?? 'Attached image'}
            />
          )
        }

        const size = formatSize(att.sizeBytes)
        return (
          <View
            key={i}
            style={[styles.card, { borderColor: theme.surfaceBorder, backgroundColor: theme.bgCard }]}
          >
            <Text style={[styles.badge, { color: theme.accent, borderColor: theme.accentBorder }]}>
              {docIcon(att)}
            </Text>
            <View style={styles.cardText}>
              <Text
                numberOfLines={1}
                ellipsizeMode="middle"
                style={[styles.name, { color: theme.textSecondary }]}
              >
                {att.filename ?? 'Attachment'}
              </Text>
              {size && <Text style={[styles.size, { color: theme.textTertiary }]}>{size}</Text>}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 6,
    borderWidth: 1,
    resizeMode: 'cover',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: 240,
  },
  badge: {
    fontSize: 9,
    fontFamily: 'Menlo',
    letterSpacing: 0.5,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  cardText: {
    flexShrink: 1,
  },
  name: {
    fontSize: 12,
  },
  size: {
    fontSize: 10,
    marginTop: 1,
  },
})
