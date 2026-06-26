import cairosvg
import os

OUT = "/home/claude/airia/design/mocks"
os.makedirs(OUT, exist_ok=True)

AMBER   = "#BA7517"
AMBER_D = "#854F0B"
AMBER_L = "#FAEEDA"
AMBER_B = "#EF9F27"
AMBER_T = "#412402"
AMBER_S = "#633806"
BG      = "#FFFFFF"
BG2     = "#F7F6F3"
BG3     = "#F0EFE9"
TEXT    = "#1A1A18"
TEXT2   = "#6B6A64"
TEXT3   = "#9B9A94"
BORDER  = "rgba(0,0,0,0.12)"
BORDERL = "rgba(0,0,0,0.07)"
RADIUS  = "12"
RADIUS_S= "8"

def svg_wrap(content, w=800, h=600, title="AIrIA Mock"):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <defs>
    <style>
      text {{ font-family: "DejaVu Sans", sans-serif; }}
    </style>
  </defs>
  <rect width="{w}" height="{h}" fill="{BG2}" rx="0"/>
  {content}
</svg>'''

def card(x, y, w, h, fill=BG, stroke=BORDERL, rx=RADIUS):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="0.75"/>'

def label(x, y, text, size=13, fill=TEXT, weight="normal", anchor="start"):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{weight}" text-anchor="{anchor}">{text}</text>'

def pill(x, y, w, h, text, bg, fg, rx="20"):
    return f'''<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{bg}"/>
  <text x="{x+w//2}" y="{y+h//2+4}" font-size="11" fill="{fg}" text-anchor="middle">{text}</text>'''

def orb(cx, cy, r, fill=AMBER_L, stroke=AMBER_B, sw=1.5):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/><text x="{cx}" y="{cy+7}" font-size="{r}" fill="{AMBER_S}" text-anchor="middle">✦</text>'

def bubble_ai(x, y, w, lines, fill=AMBER_L, fg=AMBER_T):
    lh = 18
    h = len(lines) * lh + 20
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4 12 12 12" fill="{fill}" stroke="{AMBER_B}" stroke-width="0.5"/>'
    for i, ln in enumerate(lines):
        out += f'<text x="{x+12}" y="{y+18+i*lh}" font-size="12" fill="{fg}">{ln}</text>'
    return out, h

def bubble_user(x, y, w, lines, fill=AMBER, fg="#FFFFFF"):
    lh = 18
    h = len(lines) * lh + 20
    rx = w
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill}"/>'
    for i, ln in enumerate(lines):
        out += f'<text x="{x+12}" y="{y+18+i*lh}" font-size="12" fill="{fg}">{ln}</text>'
    return out, h

def trust_bar(x, y, w, pct, label_text, level_text):
    filled = int((w - 140) * pct)
    return f'''
  {card(x, y, w, 36, fill=BG, stroke=BORDERL, rx="8")}
  <text x="{x+12}" y="{y+22}" font-size="11" fill="{TEXT2}">{label_text}</text>
  <rect x="{x+110}" y="{y+15}" width="{w-260}" height="4" rx="2" fill="{BG3}"/>
  <rect x="{x+110}" y="{y+15}" width="{filled}" height="4" rx="2" fill="{AMBER}"/>
  <text x="{x+w-12}" y="{y+22}" font-size="11" fill="{AMBER}" text-anchor="end">{level_text}</text>
'''

def wordmark(x, y, size=18):
    return f'''<text x="{x}" y="{y}" font-size="{size}" fill="{TEXT}" font-weight="500">air</text>
  <text x="{x+int(size*1.65)}" y="{y}" font-size="{size}" fill="{AMBER_D}" font-weight="500">IA</text>'''

# ─────────────────────────────────────────────
# MOCK 1 - Onboarding / Tier Selection
# ─────────────────────────────────────────────
def mock_onboarding():
    W, H = 800, 620
    content = []

    # outer card
    content.append(card(40, 30, W-80, H-60, fill=BG, rx=RADIUS))
    # wordmark
    content.append(wordmark(W//2 - 22, 80))
    # progress dots
    content.append(f'<rect x="{W//2-24}" y="96" width="20" height="5" rx="2.5" fill="{AMBER}"/>')
    content.append(f'<circle cx="{W//2+4}" cy="98" r="3" fill="{BG3}"/>')
    content.append(f'<circle cx="{W//2+16}" cy="98" r="3" fill="{BG3}"/>')
    # headline
    content.append(label(W//2, 132, "How do you want AIrIA to grow with you?", 17, TEXT, "500", "middle"))
    content.append(label(W//2, 152, "AIrIA learns from every conversation. Choose how that learning happens.", 12, TEXT2, "normal", "middle"))

    # tier cards
    tier_x = [72, 292, 512]
    tiers = [
        ("Local", "ti-cpu", "Trains on your own", "hardware. Everything", "stays on your machine.", "RTX 4080+ needed", AMBER_L, AMBER_S, False),
        ("Cloud",  "ti-cloud", "We handle training.", "Your data stays isolated", "- never shared.", "Pay per training run", "#E1F5EE", "#085041", True),
        ("Free",   "ti-sparkles", "Chat freely. Receive", "curated updates we", "research and push.", "Always free", BG3, TEXT2, False),
    ]
    for i, (name, icon, l1, l2, l3, badge, ibg, ifg, selected) in enumerate(tiers):
        tx = tier_x[i]
        sw = "2" if selected else "0.75"
        sc = AMBER if selected else BORDERL
        content.append(f'<rect x="{tx}" y="172" width="208" height="260" rx="{RADIUS}" fill="{BG}" stroke="{sc}" stroke-width="{sw}"/>')
        # icon circle
        content.append(f'<rect x="{tx+16}" y="192" width="36" height="36" rx="8" fill="{ibg}"/>')
        content.append(f'<text x="{tx+34}" y="217" font-size="18" fill="{ifg}" text-anchor="middle">●</text>')
        content.append(label(tx+16, 250, name, 14, TEXT, "500"))
        content.append(label(tx+16, 270, l1, 11, TEXT2))
        content.append(label(tx+16, 285, l2, 11, TEXT2))
        content.append(label(tx+16, 300, l3, 11, TEXT2))
        content.append(f'<rect x="{tx+16}" y="314" width="120" height="20" rx="10" fill="{ibg}"/>')
        content.append(f'<text x="{tx+76}" y="328" font-size="10" fill="{ifg}" text-anchor="middle">{badge}</text>')
        # perks
        perks = ["Full privacy" if i==0 else ("No hardware needed" if i==1 else "No setup needed"),
                 "Fastest inference" if i==0 else ("Private fine-tunes" if i==1 else "Curated improvements"),
                 "No subscription" if i==0 else ("Same power as local" if i==1 else "No personal training")]
        for j, pk in enumerate(perks):
            col = AMBER if (i < 2 or j < 2) else TEXT3
            content.append(f'<text x="{tx+16}" y="{354+j*18}" font-size="11" fill="{col}">v  {pk}</text>')

    # CTA
    content.append(f'<rect x="272" y="456" width="256" height="40" rx="8" fill="{AMBER}"/>')
    content.append(label(400, 481, "Continue with Cloud ->", 13, "#FFFFFF", "500", "middle"))
    content.append(label(W//2, 512, "You can switch tiers anytime from settings", 11, TEXT3, "normal", "middle"))

    return svg_wrap("\n".join(content), W, H, "AIrIA Onboarding")

# ─────────────────────────────────────────────
# MOCK 2 - Chat Interface
# ─────────────────────────────────────────────
def mock_chat():
    W, H = 800, 580
    content = []

    # sidebar
    content.append(card(40, 30, 190, H-60, fill=BG, rx=RADIUS))
    content.append(wordmark(56, 68))
    content.append(f'<rect x="56" y="80" width="158" height="30" rx="6" fill="{BG3}" stroke="{BORDERL}" stroke-width="0.75"/>')
    content.append(label(76, 100, "+ New conversation", 12, TEXT2))

    content.append(label(56, 132, "TODAY", 9, TEXT3, "500"))
    items = [("Planning my week", True), ("Writing a cover letter", False), ("Python debugging", False)]
    for i, (t, active) in enumerate(items):
        y = 144 + i*30
        if active:
            content.append(f'<rect x="40" y="{y-14}" width="190" height="26" fill="{BG2}"/>')
            content.append(f'<rect x="40" y="{y-14}" width="3" height="26" fill="{AMBER}"/>')
        content.append(label(60, y+4, t, 12, TEXT if active else TEXT2))

    content.append(label(56, 252, "YESTERDAY", 9, TEXT3, "500"))
    for i, t in enumerate(["Morning journaling", "React hooks", "Book recs"]):
        content.append(label(60, 270+i*26, t, 12, TEXT2))

    # sidebar bottom
    content.append(f'<line x1="40" y1="{H-90}" x2="230" y2="{H-90}" stroke="{BORDERL}" stroke-width="0.75"/>')
    content.append(label(56, H-68, "Next skill at 25 chats", 10, TEXT2))
    content.append(f'<rect x="56" y="{H-58}" width="130" height="4" rx="2" fill="{BG3}"/>')
    content.append(f'<rect x="56" y="{H-58}" width="88" height="4" rx="2" fill="{AMBER}"/>')
    content.append(f'<rect x="56" y="{H-46}" width="140" height="22" rx="11" fill="{AMBER_L}"/>')
    content.append(label(80, H-31, "Cloud . active", 11, AMBER_S))

    # main area header
    content.append(card(246, 30, W-286, H-60, fill=BG, rx=RADIUS))
    content.append(f'<line x1="246" y1="76" x2="{W-46}" y2="76" stroke="{BORDERL}" stroke-width="0.75"/>')
    content.append(label(266, 60, "Planning my week", 14, TEXT, "500"))
    content.append(label(266, 72, "17 messages . fine-tuned 3 days ago", 10, TEXT3))

    # messages
    my = 100
    # user msg
    content.append(f'<circle cx="{W-80}" cy="{my+12}" r="13" fill="{BG3}" stroke="{BORDERL}" stroke-width="0.75"/>')
    content.append(label(W-80, my+17, "N", 11, TEXT2, "500", "middle"))
    content.append(f'<rect x="340" y="{my}" width="350" height="50" rx="12 4 12 12" fill="{AMBER}"/>')
    content.append(label(354, my+20, "I want to plan this week properly.", 12, "#fff"))
    content.append(label(354, my+38, "Big presentation Thursday.", 12, "#fff"))
    my += 66

    # ai msg
    content.append(f'<circle cx="266" cy="{my+12}" r="13" fill="{AMBER_L}" stroke="{AMBER_B}" stroke-width="0.75"/>')
    content.append(label(266, my+17, "✦", 11, AMBER_S, "normal", "middle"))
    content.append(f'<rect x="286" y="{my}" width="380" height="68" rx="4 12 12 12" fill="{AMBER_L}" stroke="{AMBER_B}" stroke-width="0.5"/>')
    content.append(label(300, my+20, "Thursday is close - but that's workable. Let's", 12, AMBER_T))
    content.append(label(300, my+38, "break it down so it doesn't feel like one giant", 12, AMBER_T))
    content.append(label(300, my+56, "thing. What's the presentation about?", 12, AMBER_T))
    my += 84
    # feedback row
    for i, (ic, lbl) in enumerate([("↑","Helpful"), ("↓",""), ("⧉",""), ("↺","Retry")]):
        fx = 286 + i*76
        content.append(f'<rect x="{fx}" y="{my}" width="{66 if lbl else 28}" height="22" rx="11" fill="{"#FAEEDA" if i==0 else BG}" stroke="{"#EF9F27" if i==0 else BORDERL}" stroke-width="0.75"/>')
        content.append(label(fx + (8 if i>0 else 10), my+15, f"{ic}{" "+lbl if lbl else ""}", 11, AMBER_S if i==0 else TEXT2))
    my += 36

    # user msg 2
    content.append(f'<circle cx="{W-80}" cy="{my+12}" r="13" fill="{BG3}" stroke="{BORDERL}" stroke-width="0.75"/>')
    content.append(label(W-80, my+17, "N", 11, TEXT2, "500", "middle"))
    content.append(f'<rect x="386" y="{my}" width="304" height="32" rx="12 4 12 12" fill="{AMBER}"/>')
    content.append(label(400, my+21, "Fintech client. Scattered notes, no structure.", 12, "#fff"))
    my += 48

    # ai msg 2
    content.append(f'<circle cx="266" cy="{my+12}" r="13" fill="{AMBER_L}" stroke="{AMBER_B}" stroke-width="0.75"/>')
    content.append(label(266, my+17, "✦", 11, AMBER_S, "normal", "middle"))
    content.append(f'<rect x="286" y="{my}" width="380" height="86" rx="4 12 12 12" fill="{AMBER_L}" stroke="{AMBER_B}" stroke-width="0.5"/>')
    content.append(label(300, my+20, "Good - scattered notes are enough to start.", 12, AMBER_T))
    content.append(label(300, my+38, "Today: brain dump. Tomorrow: structure it.", 12, AMBER_T))
    content.append(label(300, my+56, "Wednesday: slides. Thursday morning:", 12, AMBER_T))
    content.append(label(300, my+74, "one run-through. Want to start now?", 12, AMBER_T))

    # input
    content.append(f'<rect x="266" y="{H-80}" width="{W-316}" height="40" rx="10" fill="{BG}" stroke="{AMBER}" stroke-width="1"/>')
    content.append(label(284, H-55, "Reply to AIrIA...", 12, TEXT3))
    content.append(f'<rect x="{W-86}" y="{H-74}" width="28" height="28" rx="6" fill="{AMBER}"/>')
    content.append(label(W-72, H-55, "↑", 14, "#fff", "500", "middle"))

    return svg_wrap("\n".join(content), W, H, "AIrIA Chat Interface")

# ─────────────────────────────────────────────
# MOCK 3 - Settings & Model Status
# ─────────────────────────────────────────────
def mock_settings():
    W, H = 800, 600
    content = []

    content.append(card(40, 30, W-80, H-60, fill=BG, rx=RADIUS))
    # header
    content.append(f'<rect x="40" y="30" width="{W-80}" height="46" rx="12 12 0 0" fill="{BG}" stroke="{BORDERL}" stroke-width="0.75"/>')
    content.append(f'<line x1="40" y1="76" x2="{W-40}" y2="76" stroke="{BORDERL}" stroke-width="0.75"/>')
    content.append(label(64, 59, "⚙  Settings", 14, TEXT, "500"))

    # nav
    nav_items = [("Model", True), ("Preferences", False), ("Adapters", False), ("Privacy", False), ("Notifications", False)]
    content.append(f'<rect x="40" y="76" width="150" height="{H-106}" fill="{BG}" stroke="{BORDERL}" stroke-width="0.5"/>')
    for i, (nm, active) in enumerate(nav_items):
        ny = 100 + i*36
        if active:
            content.append(f'<rect x="40" y="{ny-14}" width="150" height="28" fill="{BG2}"/>')
            content.append(f'<rect x="40" y="{ny-14}" width="3" height="28" fill="{AMBER}"/>')
        content.append(label(62, ny+5, nm, 13, TEXT if active else TEXT2))

    cx = 206
    cw = W - cx - 46
    cy = 90

    # Tier switcher
    content.append(label(cx, cy+10, "YOUR TIER", 9, TEXT3, "500"))
    for i, (tn, ibg, ifg, sel) in enumerate([
        ("Local", AMBER_L, AMBER_S, False),
        ("Cloud", "#E1F5EE", "#085041", True),
        ("Free", BG3, TEXT2, False)
    ]):
        tx2 = cx + i*(cw//3 + 4)
        tw2 = cw//3 - 4
        sw2 = "2" if sel else "0.75"
        sc2 = AMBER if sel else BORDERL
        content.append(f'<rect x="{tx2}" y="{cy+18}" width="{tw2}" height="64" rx="8" fill="{BG}" stroke="{sc2}" stroke-width="{sw2}"/>')
        content.append(f'<rect x="{tx2+10}" y="{cy+26}" width="28" height="28" rx="6" fill="{ibg}"/>')
        content.append(label(tx2+10, cy+56, tn, 12, TEXT, "500"))
        content.append(label(tx2+10, cy+70, "Pay per run" if i==1 else ("Own hardware" if i==0 else "Always free"), 10, TEXT3))
    cy += 100

    # Active model
    content.append(label(cx, cy+2, "ACTIVE MODEL", 9, TEXT3, "500"))
    content.append(card(cx, cy+12, cw, 106, fill=BG, stroke=BORDERL, rx="8"))
    content.append(label(cx+14, cy+32, "Gemma 3 12B . your fine-tune v4", 13, TEXT, "500"))
    content.append(f'<rect x="{cx+cw-100}" y="{cy+18}" width="88" height="20" rx="10" fill="#E1F5EE"/>')
    content.append(label(cx+cw-56, cy+31, "● Running", 11, "#085041", "normal", "middle"))
    content.append(label(cx+14, cy+50, "Last fine-tuned 3 days ago . 847 preference pairs", 11, TEXT2))
    content.append(label(cx+14, cy+65, "Hosted on A100 40GB . avg latency 210ms", 11, TEXT2))
    for i, (val, lbl2) in enumerate([("847","Pairs collected"), ("4","Fine-tune runs"), ("+3.1%","Eval improvement")]):
        sx = cx+14 + i*(cw-28)//3
        content.append(f'<rect x="{sx}" y="{cy+78}" width="{(cw-28)//3-8}" height="34" rx="6" fill="{BG2}"/>')
        content.append(label(sx+10, cy+95, val, 14, TEXT, "500"))
        content.append(label(sx+10, cy+108, lbl2, 9, TEXT3))
    cy += 128

    # Training
    content.append(label(cx, cy+2, "TRAINING", 9, TEXT3, "500"))
    content.append(card(cx, cy+12, cw, 64, fill=BG, stroke=BORDERL, rx="8"))
    content.append(label(cx+14, cy+30, "Next fine-tune", 13, TEXT, "500"))
    content.append(label(cx+14, cy+46, "153 new pairs since last run . threshold is 50", 11, TEXT2))
    content.append(f'<rect x="{cx+cw-110}" y="{cy+22}" width="96" height="30" rx="6" fill="{AMBER}"/>')
    content.append(label(cx+cw-62, cy+41, "Train now", 12, "#fff", "500", "middle"))
    content.append(f'<rect x="{cx+14}" y="{cy+62}" width="{cw-28}" height="4" rx="2" fill="{BG3}"/>')
    content.append(f'<rect x="{cx+14}" y="{cy+62}" width="{cw-28}" height="4" rx="2" fill="{AMBER}"/>')
    cy += 88

    # Feedback signals
    content.append(label(cx, cy+2, "FEEDBACK SIGNALS", 9, TEXT3, "500"))
    content.append(card(cx, cy+12, cw, 108, fill=BG, stroke=BORDERL, rx="8"))
    signals = [("Thumbs up / down", "Explicit signal - high weight", True),
               ("Retry detection", "Regenerating = implicit dislike", True),
               ("Copy detection", "Copying = implicit like", True),
               ("Edit detection", "Editing my message = implicit dislike", False)]
    for i, (nm2, desc, on) in enumerate(signals):
        ry = cy+30 + i*22
        if i > 0: content.append(f'<line x1="{cx+14}" y1="{ry-6}" x2="{cx+cw-14}" y2="{ry-6}" stroke="{BORDERL}" stroke-width="0.5"/>')
        content.append(label(cx+14, ry+2, nm2, 12, TEXT))
        content.append(label(cx+14, ry+14, desc, 10, TEXT3))
        tog_bg = AMBER if on else BG3
        content.append(f'<rect x="{cx+cw-50}" y="{ry-2}" width="32" height="18" rx="9" fill="{tog_bg}"/>')
        tx3 = cx+cw-22 if on else cx+cw-48
        content.append(f'<circle cx="{tx3}" cy="{ry+7}" r="7" fill="white"/>')

    return svg_wrap("\n".join(content), W, H, "AIrIA Settings")

# ─────────────────────────────────────────────
# MOCK 4 - Relationship Arc (4 acts as one image)
# ─────────────────────────────────────────────
def mock_arc():
    W, H = 800, 680
    content = []

    content.append(f'<rect width="{W}" height="{H}" fill="{BG2}"/>')

    # title
    content.append(label(40, 36, "AIrIA - The relationship arc", 16, TEXT, "500"))
    content.append(label(40, 54, "How the interface and personality evolve as trust builds", 12, TEXT2))

    acts = [
        ("ACT 1", "First open", "Stranger - quiet and warm", 5),
        ("ACT 2", "First chat", "Acquaintance - paying attention", 30),
        ("ACT 3", "Coming back", "Familiar - picks up the thread", 62),
        ("ACT 4", "First insight", "Knows you - the oh wow moment", 92),
    ]

    card_w = (W - 80 - 24) // 4
    for i, (act, moment, trust_desc, trust_pct) in enumerate(acts):
        ax = 40 + i*(card_w + 8)
        ay = 70
        content.append(card(ax, ay, card_w, H-110, fill=BG, stroke=BORDERL, rx=RADIUS))

        # act badge
        content.append(f'<rect x="{ax+10}" y="{ay+10}" width="46" height="18" rx="9" fill="{AMBER_L}"/>')
        content.append(label(ax+33, ay+23, act, 9, AMBER_S, "500", "middle"))
        content.append(label(ax+10, ay+42, moment, 13, TEXT, "500"))
        content.append(label(ax+10, ay+58, trust_desc, 10, TEXT2))

        # trust bar
        bar_w = card_w - 20
        filled_w = int(bar_w * trust_pct / 100)
        content.append(f'<rect x="{ax+10}" y="{ay+68}" width="{bar_w}" height="3" rx="1.5" fill="{BG3}"/>')
        content.append(f'<rect x="{ax+10}" y="{ay+68}" width="{filled_w}" height="3" rx="1.5" fill="{AMBER}"/>')

        # orb - grows with trust
        orb_r = 18 + i*4
        orb_sw = 0.5 + i*0.5
        content.append(f'<circle cx="{ax+card_w//2}" cy="{ay+104}" r="{orb_r}" fill="{AMBER_L}" stroke="{AMBER}" stroke-width="{orb_sw}"/>')
        content.append(label(ax+card_w//2, ay+110, "✦", orb_r-4, AMBER_S, "normal", "middle"))

        # per-act content
        ty = ay + 138
        if i == 0:
            content.append(f'<rect x="{ax+10}" y="{ty}" width="{card_w-20}" height="52" rx="6" fill="{AMBER_L}" stroke="{AMBER_B}" stroke-width="0.5"/>')
            content.append(label(ax+18, ty+18, "Hey. I'm AIrIA.", 12, AMBER_T, "500"))
            content.append(label(ax+18, ty+34, "I'm not here to answer", 11, AMBER_S))
            content.append(label(ax+18, ty+48, "questions. To know you.", 11, AMBER_S))
            ty += 62
            content.append(f'<rect x="{ax+10}" y="{ty}" width="{card_w-20}" height="40" rx="6" fill="{BG2}" stroke="{BORDERL}" stroke-width="0.75"/>')
            content.append(label(ax+18, ty+16, "What's something you've", 11, TEXT2))
            content.append(label(ax+18, ty+30, "been thinking about lately?", 11, TEXT2))
            ty += 52
            content.append(label(ax+10, ty+14, "✦ No form. No tier picker.", 10, TEXT3))
            content.append(label(ax+10, ty+28, "   One real question.", 10, TEXT3))
        elif i == 1:
            content.append(f'<rect x="{ax+10}" y="{ty}" width="{card_w-20}" height="36" rx="4 10 10 10" fill="{AMBER_L}" stroke="{AMBER_B}" stroke-width="0.5"/>')
            content.append(label(ax+18, ty+16, "Thursday's soon - but", 11, AMBER_T))
            content.append(label(ax+18, ty+30, "we can make it work.", 11, AMBER_T))
            ty += 46
            content.append(f'<rect x="{ax+10}" y="{ty}" width="{card_w-20}" height="36" rx="4 10 10 10" fill="{AMBER_L}" stroke="{AMBER_B}" stroke-width="0.5"/>')
            content.append(label(ax+18, ty+16, "Is procrastinating on this", 11, AMBER_T))
            content.append(label(ax+18, ty+30, "unusual for you?", 11, AMBER_T))
            ty += 48
            content.append(f'<rect x="{ax+10}" y="{ty}" width="{card_w-20}" height="20" rx="10" fill="{AMBER_L}" stroke="{AMBER_B}" stroke-width="0.5"/>')
            content.append(label(ax+18, ty+14, "👁  AIrIA is paying attention", 10, AMBER_S))
        elif i == 2:
            content.append(f'<rect x="{ax+10}" y="{ty}" width="{card_w-20}" height="38" rx="6 6 0 0" fill="{AMBER_L}" stroke="{AMBER_B}" stroke-width="0.5"/>')
            content.append(label(ax+18, ty+16, "Good morning, Nikhil.", 12, AMBER_T, "500"))
            content.append(label(ax+18, ty+30, "How did the brain dump go?", 11, AMBER_S))
            ty += 48
            content.append(f'<rect x="{ax+10}" y="{ty}" width="{card_w-20}" height="46" rx="6" fill="{BG2}" stroke="{BORDERL}" stroke-width="0.75"/>')
            content.append(label(ax+18, ty+16, "Thread: Week planning", 11, TEXT, "500"))
            content.append(label(ax+18, ty+30, "Yesterday . 14 exchanges", 10, TEXT3))
            content.append(label(ax+18, ty+42, "Action plan saved", 10, AMBER_S))
        elif i == 3:
            content.append(f'<rect x="{ax+10}" y="{ty}" width="{card_w-20}" height="100" rx="6" fill="{AMBER_L}" stroke="{AMBER_B}" stroke-width="1"/>')
            content.append(label(ax+18, ty+16, "AIRIA NOTICED", 9, AMBER_D, "500"))
            content.append(label(ax+18, ty+32, 'Every time you come to', 11, AMBER_T))
            content.append(label(ax+18, ty+46, "me with something creative,", 11, AMBER_T))
            content.append(label(ax+18, ty+60, "you start by saying you're", 11, AMBER_T))
            content.append(label(ax+18, ty+74, "not sure. But your first", 11, AMBER_T))
            content.append(label(ax+18, ty+88, 'draft is usually the best.', 11, AMBER_T))
            ty += 110
            for j, lbl3 in enumerate(["That's true","Not quite","Tell me more"]):
                bw = card_w - 20
                content.append(f'<rect x="{ax+10}" y="{ty+j*26}" width="{bw}" height="20" rx="10" fill="{"#BA7517" if j==0 else BG2}" stroke="{"#BA7517" if j==0 else BORDERL}" stroke-width="0.75"/>')
                content.append(label(ax+card_w//2, ty+j*26+14, lbl3, 10, "#fff" if j==0 else TEXT2, "normal", "middle"))

    return svg_wrap("\n".join(content), W, H, "AIrIA Relationship Arc")

# ─────────────────────────────────────────────
# MOCK 5 - Theme Picker
# ─────────────────────────────────────────────
def mock_themes():
    W, H = 800, 420
    content = []
    content.append(card(40, 30, W-80, H-60, fill=BG, rx=RADIUS))
    content.append(label(60, 64, "Choose your theme", 16, TEXT, "500"))
    content.append(label(60, 82, "Pick a mood. Switch anytime from settings.", 12, TEXT2))

    themes = [
        ("Dawn",     AMBER,   AMBER_L,  AMBER_S,  "default"),
        ("Midnight", "#534AB7","#26215C","#CECBF6",""),
        ("Forest",   "#3B6D11","#EAF3DE","#27500A",""),
        ("Ocean",    "#185FA5","#E6F1FB","#0C447C",""),
        ("Rose",     "#993556","#FBEAF0","#72243E",""),
        ("Slate",    "#444441","#F1EFE8","#2C2C2A",""),
    ]
    card_w2 = (W - 80 - 50) // 6
    for i, (name, acc, bg_l, fg_d, tag) in enumerate(themes):
        tx = 40 + i*(card_w2+10)
        sel = i == 0
        sw3 = "2" if sel else "0.75"
        sc3 = AMBER if sel else BORDERL
        content.append(f'<rect x="{tx}" y="100" width="{card_w2}" height="240" rx="10" fill="{BG}" stroke="{sc3}" stroke-width="{sw3}"/>')
        # preview area
        content.append(f'<rect x="{tx}" y="100" width="{card_w2}" height="150" rx="10 10 0 0" fill="{bg_l}"/>')
        # mini sidebar strip
        content.append(f'<rect x="{tx}" y="100" width="20" height="150" rx="10 0 0 0" fill="{acc}" opacity="0.2"/>')
        for j in range(3):
            content.append(f'<rect x="{tx+4}" y="{118+j*18}" width="12" height="4" rx="2" fill="{acc}" opacity="{0.9 if j==0 else 0.4}"/>')
        # bubbles
        content.append(f'<rect x="{tx+28}" y="118" width="{card_w2-44}" height="22" rx="4 10 10 10" fill="{bg_l}" stroke="{acc}" stroke-width="0.75"/>')
        content.append(f'<rect x="{tx+28}" y="148" width="{card_w2-60}" height="18" rx="10 4 10 10" fill="{acc}"/>')
        content.append(f'<rect x="{tx+28}" y="174" width="{card_w2-44}" height="22" rx="4 10 10 10" fill="{bg_l}" stroke="{acc}" stroke-width="0.75"/>')
        # wordmark preview
        content.append(label(tx+8, 270, "air", 13, TEXT, "500"))
        content.append(label(tx+30, 270, "IA", 13, acc, "500"))
        # name
        content.append(label(tx+8, 290, name, 12, TEXT, "500"))
        if tag:
            content.append(label(tx+8, 306, tag, 10, TEXT3))
        # swatch
        content.append(f'<circle cx="{tx+8+8}" cy="326" r="8" fill="{acc}"/>')
        content.append(f'<circle cx="{tx+28}" cy="326" r="8" fill="{bg_l}" stroke="{acc}" stroke-width="1"/>')

    return svg_wrap("\n".join(content), W, H, "AIrIA Theme Picker")

mocks = {
    "01_onboarding":  mock_onboarding(),
    "02_chat":        mock_chat(),
    "03_settings":    mock_settings(),
    "04_arc":         mock_arc(),
    "05_themes":      mock_themes(),
}

for name, svg in mocks.items():
    out_path = f"{OUT}/{name}.png"
    cairosvg.svg2png(bytestring=svg.encode(), write_to=out_path, output_width=800, dpi=144)
    print(f"v {name}.png")

print("\nAll mocks generated.")
