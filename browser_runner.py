#!/usr/bin/env python3
# browser_runner.py — Portal E2E runner with batching & smart pacing (strong-type aware).
#
# Usage example (LOCAL PAGE):
#   python browser_runner.py \
#     --url "http://localhost:8001/index.html" \
#     --endpoint "https://<your-worker>/v1" \
#     --model "llama3-8b-8192" \
#     --include microcopy,internal_comms,press_release \
#     --replicates 1 \
#     --batch_size 12 --batch_pause_ms 90000 \
#     --delay_ms 1500 --jitter_ms 400 \
#     --min_interval_ms 1400 --tries 1 \
#     --out_dir runs_local --tag e2e-portal
#
# Requirements:
#   pip install playwright
#   python -m playwright install chromium

import argparse, json, os, sys, time, uuid, random, builtins
from datetime import datetime
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse
from playwright.sync_api import sync_playwright

# ---------------- utils ----------------
def now_iso():
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

def snooze(ms):
    time.sleep(max(0, ms) / 1000.0)

def with_query(url, params):
    u = urlparse(url)
    q = parse_qs(u.query)
    for k, v in params.items():
        q[k] = [str(v)]
    new_q = urlencode({k: v[0] for k, v in q.items()})
    return urlunparse((u.scheme, u.netloc, u.path, u.params, new_q, u.fragment))

# ---------------- strong-type default cases ----------------
def cases_strong_type():
    # Microcopy — CTA + Error + Tooltip (no locale field)
    micro_button = [
        {"uiContext":"button","surface":"button","intent":"verify code"},
        {"uiContext":"button","surface":"button","intent":"confirm details"},
        {"uiContext":"button","surface":"button","intent":"resend_code"},
        {"uiContext":"button","surface":"button","intent":"upload file"},
        {"uiContext":"button","surface":"button","intent":"pay now"},
        {"uiContext":"button","surface":"button","intent":"back"},
        {"uiContext":"button","surface":"button","intent":"next"},
        {"uiContext":"button","surface":"button","intent":"submit"},
        {"uiContext":"button","surface":"button","intent":"save"},
        {"uiContext":"button","surface":"button","intent":"agree"},
        {"uiContext":"button","surface":"button","intent":"decline"},
    ]
    micro_error = [
        {"uiContext":"error","surface":"error","intent":"server offline"},
        {"uiContext":"error","surface":"error","intent":"rate_limited"},
        {"uiContext":"error","surface":"error","intent":"maintenance_window"},
        {"uiContext":"error","surface":"error","intent":"dns_error"},
        {"uiContext":"error","surface":"error","intent":"timeout_error"},
        {"uiContext":"error","surface":"error","intent":"server error"},
    ]
    micro_tooltip = [
        {"uiContext":"tooltip","surface":"tooltip","intent":"explain coverage limit"},
        {"uiContext":"tooltip","surface":"tooltip","intent":"why we need this info"},
        {"uiContext":"tooltip","surface":"tooltip","intent":"password rules"},
    ]
    microcopy = micro_button + micro_error + micro_tooltip

    # Internal Comms — Slack & Email (no audience field)
    internal = [
        {"channel":"Slack","title":"roadmap sync moved","key_update":"product roadmap sync moved to Tuesdays 11:00"},
        {"channel":"Slack","title":"db maintenance","key_update":"analytics warehouse maintenance Friday 22:00-23:00 UTC"},
        {"channel":"Slack","title":"phishing drills","key_update":"phishing simulation next week; report suspicious emails"},
        {"channel":"Slack","title":"office policy refresh","key_update":"quiet rooms first-come; new booking rules apply"},
        {"channel":"Email","title":"holiday coverage","key_update":"reduced coverage on national holiday; escalation as usual"},
        {"channel":"Email","title":"design crit changes","key_update":"weekly crit now pairs; submit figs by EOD Monday"},
        {"channel":"Email","title":"company event","key_update":"all-hands offsite confirmed for next month, details soon"},
    ]

    # PR / External — explicit audience (no region field)
    pr = [
        {"audience":"press","headline":"Lemonade reports strong Q2 growth","key_message":"accelerating growth with healthy underwriting and expense discipline"},
        {"audience":"press","headline":"Lemonade renews reinsurance program","key_message":"supports growth while reducing earnings volatility"},
        {"audience":"customers","headline":"Pet Wellness expands in EU","key_message":"simpler care and instant everything for your furry family"},
        {"audience":"customers","headline":"Faster claim decisions","key_message":"more customers get paid in minutes with zero paperwork"},
        {"audience":"investors","headline":"Q2 2025 results posted","key_message":"growth, underwriting health, and continued operating efficiency"},
        {"audience":"investors","headline":"Unit economics update","key_message":"loss ratio trends and disciplined growth across geos"},
    ]
    return microcopy, internal, pr

def expand_cases(include_str, replicates):
    include = [s.strip().lower() for s in include_str.split(",") if s.strip()]
    # Synonyms
    norm = []
    for t in include:
        if t in ("internal", "internal_comms", "internal-communications"): norm.append("internal_comms")
        elif t in ("pr","press","press_release","external","pr_external"): norm.append("press_release")
        else: norm.append("microcopy")
    include = list(dict.fromkeys(norm))  # unique, preserve order

    mc, ic, pr = cases_strong_type()

    all_cases = []
    if "microcopy" in include:
        for _ in range(replicates):
            for p in mc: all_cases.append(("microcopy", p))
    if "internal_comms" in include:
        for _ in range(replicates):
            for p in ic: all_cases.append(("internal_comms", p))
    if "press_release" in include:
        for _ in range(replicates):
            for p in pr: all_cases.append(("press_release", p))

    random.shuffle(all_cases)
    return all_cases

# ---------------- page-side evaluate ----------------
PAGE_EVAL = """ async ([typeName, params]) => {
  const m = await import('/src/orchestrator.js');
  if (!window.__testLog) window.__testLog = [];
  const report = await m.runPipeline({
    type: typeName,
    params,
    onLog: (line) => { try { window.__testLog.push(line); } catch{} }
  });
  const logs = window.__testLog.slice(-60);
  return { report, _logs: logs };
} """

def is_429(report):
    if not report or report.get("ok"): return False
    err = (report.get("error") or "").lower()
    return "429" in err or "rate limit" in err or "too many requests" in err

# ---------------- main ----------------
def main():
    ap = argparse.ArgumentParser(description="Run strong-type E2E cases against the portal UI")
    ap.add_argument("--url", required=True, help="e.g., http://localhost:8001/index.html")
    ap.add_argument("--endpoint", default="")
    ap.add_argument("--model", default="")
    ap.add_argument("--replicates", type=int, default=1)
    ap.add_argument("--include", default="microcopy,internal_comms,press_release")
    ap.add_argument("--out_dir", default="runs_local")
    ap.add_argument("--tag", default="local")
    ap.add_argument("--headful", action="store_true")
    ap.add_argument("--no_console", action="store_true")

    # pacing & throttling
    ap.add_argument("--delay_ms", type=int, default=1500, help="delay between cases")
    ap.add_argument("--jitter_ms", type=int, default=400, help="random extra wait per case")
    ap.add_argument("--min_interval_ms", type=int, default=1400, help="passed to page as ?min_interval_ms")
    ap.add_argument("--tries", type=int, default=1, help="passed to page as ?tries (cap attempts)")

    # 429 handling
    ap.add_argument("--cooldown_after_n_429", type=int, default=2)
    ap.add_argument("--cooldown_ms", type=int, default=90000)

    # batching
    ap.add_argument("--batch_size", type=int, default=12, help="cases per batch before pausing")
    ap.add_argument("--batch_pause_ms", type=int, default=90000, help="pause between batches")

    args = ap.parse_args()
    include = [s.strip().lower() for s in args.include.split(",") if s.strip()]

    # Build URL once; navigate once
    base_url = args.url
    if args.endpoint: base_url = with_query(base_url, {"endpoint": args.endpoint.rstrip("/")})
    if args.model:    base_url = with_query(base_url, {"model": args.model})
    base_url = with_query(base_url, {"min_interval_ms": args.min_interval_ms, "tries": args.tries, "verbose": 1})

    os.makedirs(args.out_dir, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    runs_path = os.path.join(args.out_dir, f"runs_{ts}_{args.tag}.jsonl")
    summary_path = os.path.join(args.out_dir, f"summary_{ts}_{args.tag}.json")

    all_cases = expand_cases(args.include, args.replicates)
    total = len(all_cases)
    builtins.print(f"Total cases: {total}  include={args.include}  replicates={args.replicates}")
    if total == 0:
        builtins.print("No cases to run. Check --include.")
        return 1

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headful)
        ctx = browser.new_context(ignore_https_errors=True)
        page = ctx.new_page()

        if not args.no_console:
            def _log_console(msg):
                try:
                    builtins.print(f"[browser] {msg.type()}: {msg.text()}")
                except Exception:
                    try:
                        builtins.print("[browser]", msg.type(), msg.text())
                    except Exception:
                        pass
            page.on("console", _log_console)

        builtins.print(f"[nav] {base_url}")
        page.goto(base_url)

        batches = [all_cases[i:i+args.batch_size] for i in range(0, total, args.batch_size)]

        stats = {
            "created_at": now_iso(),
            "total_runs": 0, "pass": 0, "borderline": 0, "fail": 0,
            "by_type": {},
            "avg_trs": 0, "avg_duration_ms": 0,
            "429s": 0
        }
        trs_vals, dur_vals = [], []

        with open(runs_path, "w", encoding="utf-8") as f:
            run_idx = 0
            for bi, batch in enumerate(batches, start=1):
                builtins.print(f"\n=== Batch {bi}/{len(batches)} — {len(batch)} cases ===")
                consec_429 = 0

                for (typename, params) in batch:
                    run_idx += 1
                    rid = str(uuid.uuid4())[:8]
                    builtins.print(f"→ Run {run_idx}/{total} [{typename}] {params}")

                    t0 = time.time()
                    result = page.evaluate(PAGE_EVAL, [typename, params])
                    report, logs = result.get("report"), result.get("_logs", [])
                    duration_ms = int((time.time() - t0) * 1000)

                    row = {
                        "id": rid, "created_at": now_iso(), "type": typename, "params": params,
                        "duration_ms": duration_ms, "ok": bool(report and report.get("ok")),
                        "report": report, "console_tail": logs[-10:]
                    }
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")

                    stats["total_runs"] += 1
                    stats["by_type"].setdefault(typename, {"count":0,"pass":0,"borderline":0,"fail":0})
                    stats["by_type"][typename]["count"] += 1

                    verdict = ((report or {}).get("scoring") or {}).get("verdict")
                    trs = ((report or {}).get("scoring") or {}).get("trs")
                    if isinstance(trs, (int, float)): trs_vals.append(trs)
                    dur_vals.append(duration_ms)

                    if verdict in ("pass","borderline","fail"):
                        stats[verdict] += 1
                        stats["by_type"][typename][verdict] += 1
                    else:
                        stats["fail"] += 1
                        stats["by_type"][typename]["fail"] += 1

                    # 429 handling
                    def _is_429(rep):
                        if not rep or rep.get("ok"): return False
                        e = (rep.get("error") or "").lower()
                        return "429" in e or "rate limit" in e or "too many requests" in e

                    if _is_429(report):
                        stats["429s"] += 1
                        consec_429 += 1
                        builtins.print(f"   ⚠️ 429 detected ({consec_429} in a row)")
                        if consec_429 >= args.cooldown_after_n_429:
                            builtins.print(f"   ⏸ cooldown for {args.cooldown_ms}ms …")
                            snooze(args.cooldown_ms)
                            consec_429 = 0
                    else:
                        consec_429 = 0

                    # pacing between cases
                    delay = args.delay_ms + random.randint(0, args.jitter_ms)
                    snooze(delay)

                # pause between batches
                if bi < len(batches):
                    builtins.print(f"   ⏸ batch pause {args.batch_pause_ms}ms …")
                    snooze(args.batch_pause_ms)

        if trs_vals: stats["avg_trs"] = round(sum(trs_vals)/len(trs_vals), 2)
        if dur_vals: stats["avg_duration_ms"] = int(sum(dur_vals)/len(dur_vals))

        with open(summary_path, "w", encoding="utf-8") as s:
            json.dump(stats, s, indent=2)

        builtins.print(f"\nWrote {runs_path}")
        builtins.print(f"Wrote {summary_path}")
        browser.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
