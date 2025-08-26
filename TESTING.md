# Testing Guide - Lemonade Self-Service Portal

This document explains how to run performance and functionality tests for the content generation portal.

## Quick Start

### 1. Start the Development Server

```bash
# Start the portal on localhost:8001
python3 -m http.server 8001
```

### 2. Run Baseline Performance Test

```bash
# Run a quick baseline test (recommended for first-time setup)
python run_baseline_test.py
```

This will:
- Install Playwright if needed
- Run 24 test cases (8 each for microcopy, internal comms, press release)
- Show results in browser window
- Save detailed results to `baseline_test_YYYYMMDD_HHMMSS/`

## Manual Testing

### Browser Runner (Advanced)

For more control over testing parameters:

```bash
# Basic test run
python browser_runner.py \
  --url "http://localhost:8001/index.html" \
  --include "microcopy,internal_comms,press_release" \
  --replicates 1 \
  --headful

# Performance stress test
python browser_runner.py \
  --url "http://localhost:8001/index.html" \
  --include "microcopy" \
  --replicates 3 \
  --batch_size 20 \
  --delay_ms 1000 \
  --out_dir "stress_test" \
  --tag "stress"
```

### Parameters

- `--url`: Portal URL (default: localhost:8001)
- `--include`: Content types to test (microcopy, internal_comms, press_release)
- `--replicates`: How many times to run each test case
- `--batch_size`: Cases per batch before pausing
- `--delay_ms`: Delay between individual cases
- `--headful`: Show browser window (for debugging)
- `--out_dir`: Where to save results
- `--tag`: Label for this test run

## Test Cases

### Microcopy
- **Button CTAs**: verify code, confirm details, pay now, back, next, submit, save, agree, decline
- **Error messages**: server offline, rate limited, maintenance, DNS/timeout errors
- **Tooltips**: coverage limits, info explanations, password rules

### Internal Communications
- **Slack messages**: roadmap updates, maintenance notices, security drills, office policies
- **Email announcements**: holiday coverage, process changes, company events

### Press Releases / External
- **Press**: Q2 results, reinsurance updates
- **Customers**: product launches, feature improvements
- **Investors**: financial updates, unit economics

## Results Analysis

### Output Files

1. **`runs_YYYYMMDD_HHMMSS_tag.jsonl`**: Individual test results
   - Each line is a JSON object with test parameters, results, and logs
   - Use for detailed analysis and debugging

2. **`summary_YYYYMMDD_HHMMSS_tag.json`**: Aggregated statistics
   - Overall pass/fail rates
   - Average TRS scores
   - Performance metrics by content type
   - Duration statistics

### Key Metrics

- **TRS Score**: Tone, Relevance, Style (0-100, higher is better)
- **Pass Rate**: Percentage of tests that pass TRS scoring
- **Duration**: Time from request to completion
- **429 Errors**: Rate limiting incidents

### Interpreting Results

- **TRS 80+**: Excellent content quality
- **TRS 60-79**: Good content, minor issues
- **TRS <60**: Needs improvement
- **Pass Rate >90%**: System performing well
- **Pass Rate <70%**: May need prompt tuning

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Kill existing server
   pkill -f "python3 -m http.server"
   # Or use different port
   python3 -m http.server 8002
   ```

2. **Playwright not installed**
   ```bash
   pip install playwright
   python -m playwright install chromium
   ```

3. **CORS errors**
   - Ensure server is running on correct port
   - Check browser console for specific errors

4. **429 Rate Limiting**
   - Increase `--delay_ms` between requests
   - Reduce `--batch_size`
   - Add longer `--batch_pause_ms`

### Debug Mode

For detailed debugging:

```bash
python browser_runner.py \
  --url "http://localhost:8001/index.html?verbose=1" \
  --include "microcopy" \
  --replicates 1 \
  --headful \
  --no_console
```

This shows:
- Full prompts sent to LLM
- Selected corpus references
- TRS scoring details
- Error messages

## Performance Baseline

A typical baseline run should achieve:

- **Pass Rate**: >85%
- **Average TRS**: >70
- **Average Duration**: <5000ms
- **429 Errors**: <5%

If results are below these thresholds, consider:
- Adjusting prompts in `src/prompts.js`
- Updating corpus examples
- Tuning TRS scoring rules
- Optimizing LLM parameters
