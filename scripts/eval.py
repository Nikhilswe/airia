"""
AIrIA — eval.py
MMLU regression evaluation script.
Scores a local Ollama model on a hardcoded 20-question MMLU subset
(mix of STEM and humanities) and compares against a baseline score.
Fails if the new score regresses beyond --threshold (default 2%).
Outputs a single JSON result line to stdout.
"""

import argparse
import json
import sys
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Hardcoded 20-question MMLU subset
# Format: { "question": str, "choices": [A, B, C, D], "answer": "A"|"B"|"C"|"D" }
# Source categories: STEM (physics, math, biology, CS) + humanities (history, philosophy)
# ---------------------------------------------------------------------------

MMLU_SUBSET: list[dict] = [
    # ── STEM — Physics ──────────────────────────────────────────────────────
    {
        "question": "What is the SI unit of electric charge?",
        "choices": ["Ampere", "Coulomb", "Volt", "Farad"],
        "answer": "B",
    },
    {
        "question": "Which law states that energy cannot be created or destroyed?",
        "choices": [
            "Newton's first law",
            "Ohm's law",
            "First law of thermodynamics",
            "Boyle's law",
        ],
        "answer": "C",
    },
    {
        "question": "The speed of light in a vacuum is approximately:",
        "choices": ["3×10^6 m/s", "3×10^8 m/s", "3×10^10 m/s", "3×10^12 m/s"],
        "answer": "B",
    },
    # ── STEM — Mathematics ──────────────────────────────────────────────────
    {
        "question": "What is the derivative of sin(x)?",
        "choices": ["−sin(x)", "cos(x)", "−cos(x)", "tan(x)"],
        "answer": "B",
    },
    {
        "question": "The value of log₂(8) is:",
        "choices": ["2", "3", "4", "8"],
        "answer": "B",
    },
    {
        "question": "Which of the following is a prime number?",
        "choices": ["51", "57", "61", "91"],
        "answer": "C",
    },
    # ── STEM — Biology ──────────────────────────────────────────────────────
    {
        "question": "Which organelle is responsible for ATP synthesis in eukaryotes?",
        "choices": ["Nucleus", "Ribosome", "Mitochondria", "Golgi apparatus"],
        "answer": "C",
    },
    {
        "question": "DNA replication is described as semi-conservative. This means:",
        "choices": [
            "Each new DNA molecule contains two new strands",
            "Each new DNA molecule contains one old and one new strand",
            "Both new DNA molecules contain only old strands",
            "Only one copy of DNA is made",
        ],
        "answer": "B",
    },
    {
        "question": "Which base pairs with adenine in DNA?",
        "choices": ["Guanine", "Cytosine", "Thymine", "Uracil"],
        "answer": "C",
    },
    # ── STEM — Computer Science ─────────────────────────────────────────────
    {
        "question": "Which data structure operates on a LIFO (last-in, first-out) basis?",
        "choices": ["Queue", "Stack", "Linked list", "Heap"],
        "answer": "B",
    },
    {
        "question": "The worst-case time complexity of quicksort is:",
        "choices": ["O(n)", "O(n log n)", "O(n²)", "O(log n)"],
        "answer": "C",
    },
    {
        "question": "In TCP/IP, which layer is responsible for end-to-end communication?",
        "choices": ["Network layer", "Data link layer", "Transport layer", "Application layer"],
        "answer": "C",
    },
    # ── Humanities — World History ──────────────────────────────────────────
    {
        "question": "The Treaty of Westphalia (1648) ended which conflict?",
        "choices": [
            "The Hundred Years' War",
            "The Thirty Years' War",
            "The Wars of the Roses",
            "The Seven Years' War",
        ],
        "answer": "B",
    },
    {
        "question": "Who was the first Emperor of a unified China?",
        "choices": ["Kublai Khan", "Wu Zetian", "Qin Shi Huang", "Sun Yat-sen"],
        "answer": "C",
    },
    {
        "question": "The French Revolution began in which year?",
        "choices": ["1776", "1789", "1799", "1815"],
        "answer": "B",
    },
    # ── Humanities — Philosophy ─────────────────────────────────────────────
    {
        "question": "Immanuel Kant's categorical imperative is primarily a theory of:",
        "choices": ["Aesthetics", "Epistemology", "Ethics", "Metaphysics"],
        "answer": "C",
    },
    {
        "question": "Which philosopher wrote 'Meditations on First Philosophy'?",
        "choices": ["John Locke", "René Descartes", "Baruch Spinoza", "David Hume"],
        "answer": "B",
    },
    {
        "question": "Utilitarianism holds that the right action is the one that:",
        "choices": [
            "Follows a universal moral rule",
            "Maximizes overall happiness or utility",
            "Fulfils one's duty regardless of consequences",
            "Expresses virtue of character",
        ],
        "answer": "B",
    },
    # ── Mixed ────────────────────────────────────────────────────────────────
    {
        "question": "What does HTTP stand for?",
        "choices": [
            "HyperText Transfer Protocol",
            "High Transfer Text Protocol",
            "HyperText Transit Protocol",
            "Hyperlink Transfer Text Protocol",
        ],
        "answer": "A",
    },
    {
        "question": "The Pythagorean theorem states that in a right triangle a² + b² equals:",
        "choices": ["a + b", "c", "c²", "2c"],
        "answer": "C",
    },
]

OLLAMA_BASE = "http://localhost:11434"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="AIrIA MMLU regression evaluation against an Ollama model"
    )
    parser.add_argument(
        "--model",
        required=True,
        help="Ollama model name (e.g. gemma3:4b)",
    )
    parser.add_argument(
        "--baseline-score",
        type=float,
        required=True,
        help="Previous accuracy score (0.0–1.0) to compare against",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.02,
        help="Maximum allowed regression as a fraction (default: 0.02 = 2%%)",
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Ollama interaction
# ---------------------------------------------------------------------------

def query_ollama(model: str, prompt: str) -> str:
    """POST a single-turn chat message to Ollama and return the text reply."""
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{OLLAMA_BASE}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read())
    return body["message"]["content"]


def extract_answer(response: str) -> str | None:
    """
    Parse a single letter answer (A/B/C/D) from the model's response.
    Looks for the first occurrence of a standalone A, B, C, or D.
    """
    import re
    # Match "Answer: B", "(B)", "B)", "B." or a bare capital letter
    pattern = re.compile(r"\b([ABCD])\b")
    match = pattern.search(response)
    return match.group(1) if match else None


def build_prompt(q: dict) -> str:
    choices_text = "\n".join(
        f"{label}. {text}"
        for label, text in zip("ABCD", q["choices"])
    )
    return (
        f"{q['question']}\n\n"
        f"{choices_text}\n\n"
        "Reply with only the letter of the correct answer (A, B, C, or D)."
    )


# ---------------------------------------------------------------------------
# Evaluation loop
# ---------------------------------------------------------------------------

def evaluate(model: str) -> float:
    correct = 0
    for item in MMLU_SUBSET:
        prompt = build_prompt(item)
        try:
            response = query_ollama(model, prompt)
            predicted = extract_answer(response)
        except Exception:
            # Count failures as wrong
            predicted = None

        if predicted == item["answer"]:
            correct += 1

    return correct / len(MMLU_SUBSET)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()

    try:
        new_score = evaluate(args.model)
    except urllib.error.URLError as exc:
        print(json.dumps({
            "passed": False,
            "error": f"Cannot reach Ollama at {OLLAMA_BASE}: {exc}",
        }))
        sys.exit(1)
    except Exception as exc:
        print(json.dumps({"passed": False, "error": str(exc)}))
        sys.exit(1)

    delta = new_score - args.baseline_score
    passed = delta >= -args.threshold

    print(json.dumps({
        "passed": passed,
        "baseline": round(args.baseline_score, 4),
        "new_score": round(new_score, 4),
        "delta": round(delta, 4),
        "threshold": args.threshold,
        "model": args.model,
    }))

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
