"""
AIrIA — training_server.py
FastAPI server (localhost:8765) that orchestrates local model training and evaluation.
Called by the TypeScript LocalTrainer in airia-service.

Endpoints:
  GET  /health                    — liveness probe
  POST /train                     — start a DPO fine-tuning job
  GET  /train/{job_id}/status     — poll job progress
  POST /eval                      — run MMLU regression eval
  POST /swap                      — build an Ollama modelfile and run `ollama create`

DEV_MODE=1  — skips actual Unsloth training; completes in ~2 s with a mock adapter path.
              Use this to test the full TypeScript pipeline wiring without a GPU.
"""

import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Optional

# ---------------------------------------------------------------------------
# Guard imports
# ---------------------------------------------------------------------------
try:
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import JSONResponse
    from pydantic import BaseModel
    import uvicorn
except ImportError as _e:
    print(
        f"Missing dependency: {_e}. "
        "Please run: pip install fastapi uvicorn pydantic",
        file=sys.stderr,
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SCRIPTS_DIR = Path(__file__).parent.resolve()
TRAIN_SCRIPT = SCRIPTS_DIR / "train.py"
EVAL_SCRIPT  = SCRIPTS_DIR / "eval.py"

DEV_MODE: bool = os.getenv("DEV_MODE", "").lower() in ("1", "true", "yes")

if DEV_MODE:
    print("⚠️  DEV_MODE=1 — training is MOCKED. No actual fine-tuning will run.", flush=True)

# ---------------------------------------------------------------------------
# In-memory job store
# ---------------------------------------------------------------------------

_jobs: dict[str, dict[str, Any]] = {}
_jobs_lock = threading.Lock()


def _new_job() -> str:
    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {"status": "pending", "progress": 0.0, "output_dir": None, "error": None}
    return job_id


def _get_job(job_id: str) -> dict[str, Any]:
    with _jobs_lock:
        if job_id not in _jobs:
            raise KeyError(job_id)
        return dict(_jobs[job_id])


def _update_job(job_id: str, **kwargs: Any) -> None:
    with _jobs_lock:
        _jobs[job_id].update(kwargs)


# ---------------------------------------------------------------------------
# Background runners
# ---------------------------------------------------------------------------

def _run_training_real(job_id: str, pairs_path: str, base_model: str, output_dir: str, epochs: int) -> None:
    """Run train.py in a subprocess, stream JSON progress into the job store."""
    _update_job(job_id, status="running", progress=0.0)
    cmd = [
        sys.executable, str(TRAIN_SCRIPT),
        "--pairs", pairs_path,
        "--base-model", base_model,
        "--output-dir", output_dir,
        "--epochs", str(epochs),
    ]
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        for raw_line in proc.stdout:  # type: ignore[union-attr]
            line = raw_line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            if data.get("status") == "running":
                epoch = data.get("epoch") or 0
                _update_job(job_id, progress=min(epoch / max(epochs, 1), 0.99))
            elif data.get("status") == "done":
                _update_job(job_id, status="done", progress=1.0, output_dir=data.get("output_dir"))
                return
            elif data.get("status") == "error":
                _update_job(job_id, status="error", error=data.get("message", "Unknown error"))
                return
        proc.wait()
        if proc.returncode != 0:
            _update_job(job_id, status="error", error=f"train.py exited {proc.returncode}")
        else:
            current = _get_job(job_id)
            if current["status"] == "running":
                _update_job(job_id, status="done", progress=1.0, output_dir=output_dir)
    except Exception as exc:
        _update_job(job_id, status="error", error=str(exc))


def _run_training_mock(job_id: str, output_dir: str, epochs: int) -> None:
    """DEV_MODE: simulate training progress without touching a GPU."""
    _update_job(job_id, status="running", progress=0.0)
    steps = epochs * 4
    for i in range(steps):
        time.sleep(0.4)
        _update_job(job_id, progress=round((i + 1) / steps, 2))
    # Create a placeholder output dir so ModelManager swap check passes
    os.makedirs(output_dir, exist_ok=True)
    (Path(output_dir) / "adapter_mock.txt").write_text("DEV_MODE mock adapter — not real weights\n")
    _update_job(job_id, status="done", progress=1.0, output_dir=output_dir)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class TrainRequest(BaseModel):
    pairs_jsonl: str           # JSONL content sent by LocalTrainer (browser can't write files)
    base_model: str = "gemma3:4b"
    output_dir: str = "./models/airia-local-dev"
    epochs: int = 3


class EvalRequest(BaseModel):
    model: str
    baseline_model: Optional[str] = None
    baseline_score: float = 0.0
    threshold: float = 0.02


class SwapRequest(BaseModel):
    model_name: str
    adapter_path: str
    base_model: str = "gemma3:4b"


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="AIrIA Training Server", version="0.1.0")


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "dev_mode": DEV_MODE})


@app.post("/train")
def start_training(req: TrainRequest) -> JSONResponse:
    """
    Accept JSONL content, write to a temp file, and kick off training.
    Returns { "job_id": "..." } immediately.
    """
    if not req.pairs_jsonl.strip():
        raise HTTPException(status_code=400, detail="pairs_jsonl is empty")

    job_id = _new_job()
    _update_job(job_id, output_dir=req.output_dir)

    if DEV_MODE:
        thread = threading.Thread(
            target=_run_training_mock,
            args=(job_id, req.output_dir, req.epochs),
            daemon=True,
        )
    else:
        # Write JSONL to a temp file for train.py to read
        tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False)
        tmp.write(req.pairs_jsonl)
        tmp.close()
        thread = threading.Thread(
            target=_run_training_real,
            args=(job_id, tmp.name, req.base_model, req.output_dir, req.epochs),
            daemon=True,
        )

    thread.start()
    return JSONResponse({"job_id": job_id})


@app.get("/train/{job_id}/status")
def get_training_status(job_id: str) -> JSONResponse:
    try:
        job = _get_job(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    return JSONResponse({
        "status": job["status"],
        "progress": job["progress"],
        "output_dir": job.get("output_dir"),
        "error": job.get("error"),
    })


@app.post("/eval")
def run_eval(req: EvalRequest) -> JSONResponse:
    """
    Run MMLU regression eval. In DEV_MODE returns a mock pass immediately.
    """
    if DEV_MODE:
        return JSONResponse({
            "passed": True,
            "baseline": req.baseline_score or 0.72,
            "new_score": (req.baseline_score or 0.72) + 0.01,
            "delta": 0.01,
            "threshold": req.threshold,
            "model": req.model,
            "dev_mode": True,
        })

    cmd = [
        sys.executable, str(EVAL_SCRIPT),
        "--model", req.model,
        "--baseline-score", str(req.baseline_score),
        "--threshold", str(req.threshold),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Eval timed out")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Eval failed: {exc}")

    try:
        return JSONResponse(json.loads(result.stdout.strip()))
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Unexpected eval output: {result.stderr}")


@app.post("/swap")
def swap_model(req: SwapRequest) -> JSONResponse:
    """
    Build an Ollama Modelfile and register the model via `ollama create`.
    In DEV_MODE, skips ollama create (adapter is a mock placeholder).
    """
    if DEV_MODE:
        print(f"[DEV_MODE] Skipping ollama create for {req.model_name}", flush=True)
        return JSONResponse({"status": "ok", "model": req.model_name, "dev_mode": True})

    if not os.path.isdir(req.adapter_path):
        raise HTTPException(status_code=400, detail=f"adapter_path not found: {req.adapter_path}")

    modelfile_content = f"FROM {req.base_model}\nADAPTER {req.adapter_path}\n"
    with tempfile.NamedTemporaryFile(mode="w", suffix=".Modelfile", delete=False) as tmp:
        tmp.write(modelfile_content)
        modelfile_path = tmp.name

    try:
        result = subprocess.run(
            ["ollama", "create", req.model_name, "-f", modelfile_path],
            capture_output=True, text=True, timeout=300,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="ollama CLI not found in PATH")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="ollama create timed out")
    finally:
        os.unlink(modelfile_path)

    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=f"ollama create failed: {result.stderr.strip()}")

    return JSONResponse({"status": "ok", "model": req.model_name})


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")
