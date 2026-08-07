# Using AIrIA

A guide to the mobile app. For setup and architecture, see the [README](../README.md).

## First run

Tap **Get started** and you land in a conversation. On first launch the app checks
whether a model is on the device; if none is, it prompts you to download one
(Gemma 3 1B, ~806 MB). That download is required before the first reply — nothing
is sent to a server, so the model has to be local.

The header shows the current conversation title, and beneath it a dot and the
active model. Green means ready.

## Talking to it

Type and send. Replies stream in as they generate.

Inference runs on your device, so speed depends on your hardware and the model
size. A 1B model is quick; the 3B vision model is noticeably slower, especially
its first reply after loading.

## Attachments

Tap **⊕** to the left of the input:

- **Photo** — pick from your library. Images are converted to JPEG and scaled to
  1024px before inference.
- **Document** — pick any file. Text, Markdown, CSV, JSON, YAML, and source-code
  files have their contents read into the prompt.

**PDFs are not readable yet.** They still route correctly, but their text cannot
be extracted on-device, so the reply will say the contents could not be read
rather than guess at them. Slide decks and spreadsheets are in the same position.
For anything in a PDF today, screenshot the page and attach it as a photo — the
vision model reads it directly.

Attachments appear as a chip above the input, with a thumbnail for images. Tap
**✕** on a chip to remove it. Once sent, the attachment stays visible in the
transcript above your message, so the conversation still reads correctly later.

## Understanding the tags under a reply

Each reply carries two small tags:

```
◉ vision    Qwen 2.5 VL 3B (Q4)
```

The first is the **capability** the router chose — `◉ vision`, `‹› code`, or
`◇ reason`. The second is the **model that actually answered**.

Usually they agree. When they don't, you get an explicit note:

> Routed to **vision**, but Qwen 2.5 VL 3B (Q4) isn't downloaded — answered with
> Gemma 3 1B (Q4).  **[Download Qwen 2.5 VL 3B (Q4)]**

**Read this note when it appears.** It means the reply came from a model that
wasn't suited to the question. For an image, that is significant: a text-only
model cannot see your picture, and will describe something plausible and entirely
invented rather than admit it. Tapping Download fixes it for subsequent turns.

The same honesty applies to documents. If a file's text couldn't be extracted, the
model is told so explicitly, so it should decline to guess rather than fabricate
contents.

## Feedback

Under each reply: **▲** good, **▼** bad, **↻** regenerate, **⎘** copy.

These aren't only for you. Thumbs and regenerations are stored as preference pairs
for later fine-tuning. Settings → **Training** shows progress toward the threshold
where a tuning run becomes worthwhile; the counter turns accent-coloured on
arrival. Fine-tuning itself runs on desktop, not the phone.

## Conversations

The **☰** button opens the sidebar with your conversation history. Conversations
are titled from your first message. Everything is stored locally.

## Settings

The **⚙** button opens settings.

**Theme** — six palettes: Dawn, Midnight, Forest, Ocean, Rose, Slate.

**Tier** — which engine serves replies. `on-device` runs locally. Other tiers can
point at a server.

**Ollama endpoint** — if you run [Ollama](https://ollama.com) on a machine on the
same Wi-Fi, put its address here (e.g. `http://192.168.1.50:11434`) to use larger
models than the phone can hold. Leave it blank to stay fully on-device.

If Ollama is configured but unreachable, replies fall back to the on-device model
rather than failing.

**Models** — download, switch between, and inspect models. Each row shows size,
context window, and minimum RAM. **Active** marks the loaded one; **Use** switches
to an already-downloaded model; **Download** fetches a new one.

You do not have to manage this manually — the router loads what each question
needs, provided it's downloaded. Downloading a model is really about granting a
capability, not choosing a default.

### Which models to download

| If you want to… | Download |
|---|---|
| Just chat | Gemma 3 1B — the default, enough on its own |
| Ask about screenshots and photos | Qwen 2.5 VL 3B (+845 MB projector) |
| Get help with code | Qwen 2.5 Coder 1.5B |

Vision is the largest download because a vision model needs both weights and a
separate projector. Check free space before starting it.

## Troubleshooting

**Replies mention a model I didn't expect.** That's the fallback note doing its
job — the router wanted a model that isn't downloaded. Tap the Download button in
the note.

**An image reply is wrong or invented.** Check the tags. If the model shown isn't
the vision model, it never saw the image. Download the vision model.

**A document reply says the contents couldn't be read.** Expected for PDFs, slide
decks, and spreadsheets — on-device text extraction for those isn't implemented,
and the app says so rather than inventing contents. Screenshot the page and
attach it as a photo instead. Text, Markdown, CSV, JSON, YAML, and source files
should all read correctly.

**Everything is slow.** Expected for larger models on-device, and worst on the
first reply after a model loads. Smaller models are much faster; the router will
still use a big model when the question needs one.
