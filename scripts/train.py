"""
AIrIA — train.py
Unsloth QLoRA DPO fine-tuning script.
Reads preference pairs (chosen/rejected) from a JSONL file and fine-tunes
a base model using TRL's DPOTrainer with Unsloth acceleration.
Outputs are saved as LoRA adapter weights to --output-dir.
Progress is emitted as JSON lines to stdout for the training server to parse.
"""

import argparse
import json
import sys

# ---------------------------------------------------------------------------
# Guard imports — provide a clear installation hint if deps are missing.
# ---------------------------------------------------------------------------
try:
    from unsloth import FastLanguageModel
    from datasets import Dataset
    from trl import DPOTrainer, DPOConfig
    import torch
except ImportError as _import_err:
    print(
        json.dumps({
            "status": "error",
            "message": (
                f"Missing dependency: {_import_err}. "
                "Please run: pip install unsloth trl datasets torch"
            ),
        })
    )
    sys.exit(1)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="AIrIA QLoRA DPO fine-tuning with Unsloth + TRL"
    )
    parser.add_argument(
        "--pairs",
        required=True,
        help="Path to a JSONL file. Each line: {\"chosen\": \"...\", \"rejected\": \"...\"}",
    )
    parser.add_argument(
        "--base-model",
        default="unsloth/gemma-3-4b-it",
        help="HuggingFace / Unsloth model ID (default: unsloth/gemma-3-4b-it)",
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Directory to save adapter weights",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=3,
        help="Number of training epochs (default: 3)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=4,
        help="Per-device training batch size (default: 4)",
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_pairs(path: str) -> list[dict]:
    """Load preference pairs from a JSONL file."""
    pairs = []
    with open(path, "r", encoding="utf-8") as f:
        for lineno, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON on line {lineno}: {exc}") from exc
            if "chosen" not in record or "rejected" not in record:
                raise ValueError(
                    f"Line {lineno} must have 'chosen' and 'rejected' keys"
                )
            pairs.append(record)
    if not pairs:
        raise ValueError(f"No pairs found in {path}")
    return pairs


def build_dataset(pairs: list[dict]) -> Dataset:
    """Convert pairs list into a HuggingFace Dataset for DPOTrainer."""
    # DPOTrainer expects 'prompt', 'chosen', 'rejected' columns.
    # Since our pairs are full responses without an explicit prompt,
    # we use an empty prompt and treat chosen/rejected as full turns.
    return Dataset.from_list([
        {"prompt": "", "chosen": p["chosen"], "rejected": p["rejected"]}
        for p in pairs
    ])


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train(args: argparse.Namespace) -> None:
    # ── Load pairs ─────────────────────────────────────────────────────────
    try:
        pairs = load_pairs(args.pairs)
    except Exception as exc:
        print(json.dumps({"status": "error", "message": str(exc)}))
        sys.exit(1)

    dataset = build_dataset(pairs)

    # ── Load model + tokenizer via Unsloth ─────────────────────────────────
    try:
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=args.base_model,
            max_seq_length=2048,
            dtype=None,          # auto-detect (float16 / bfloat16)
            load_in_4bit=True,   # QLoRA 4-bit quantisation
        )
    except Exception as exc:
        print(json.dumps({"status": "error", "message": f"Model load failed: {exc}"}))
        sys.exit(1)

    # ── Attach LoRA adapters ────────────────────────────────────────────────
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,                     # LoRA rank
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_alpha=16,
        lora_dropout=0.0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=42,
    )

    # ── DPO config ─────────────────────────────────────────────────────────
    dpo_config = DPOConfig(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=4,
        learning_rate=5e-5,
        optim="adamw_8bit",
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        logging_steps=1,
        save_steps=50,
        save_total_limit=2,
        report_to="none",    # disable wandb / tensorboard by default
    )

    # ── Custom progress callback ────────────────────────────────────────────
    from transformers import TrainerCallback  # type: ignore[import]

    class JsonProgressCallback(TrainerCallback):
        def on_log(self, train_args, state, control, logs=None, **kwargs):  # type: ignore[override]
            if logs is None:
                return
            loss = logs.get("loss") or logs.get("train_loss")
            epoch = logs.get("epoch")
            if loss is not None:
                print(
                    json.dumps({
                        "status": "running",
                        "epoch": round(epoch, 2) if epoch is not None else None,
                        "loss": round(float(loss), 4),
                        "step": state.global_step,
                    }),
                    flush=True,
                )

    # ── Run trainer ────────────────────────────────────────────────────────
    trainer = DPOTrainer(
        model=model,
        ref_model=None,          # Unsloth handles the reference internally
        args=dpo_config,
        train_dataset=dataset,
        tokenizer=tokenizer,
        callbacks=[JsonProgressCallback()],
    )

    try:
        trainer.train()
    except Exception as exc:
        print(json.dumps({"status": "error", "message": f"Training failed: {exc}"}))
        sys.exit(1)

    # ── Save adapter weights ────────────────────────────────────────────────
    try:
        model.save_pretrained(args.output_dir)
        tokenizer.save_pretrained(args.output_dir)
    except Exception as exc:
        print(json.dumps({"status": "error", "message": f"Save failed: {exc}"}))
        sys.exit(1)

    print(json.dumps({"status": "done", "output_dir": args.output_dir}), flush=True)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    train(parse_args())
