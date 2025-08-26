# Testing Guide - Lemonade Self-Service Portal

This guide covers how to set up and run automated tests for the content generation portal.

## Quick Start

### 1. Start the Server
```bash
python3 -m http.server 8001
```

### 2. Run Baseline Test (Recommended)
```bash
python run_baseline_test.py
```

This will:
- ✅ Install Playwright automatically
- 🚀 Run 33 test cases with rate limiting
- 📊 Generate detailed analysis automatically
- 📋 Provide comprehensive summary

### 3. Manual Testing Options

#### Run All Tests
```bash
python browser_runner.py --url http://localhost:8001/index.html
```

#### Run Specific Content Types
```bash
python browser_runner.py --url http://localhost:8001/index.html --include microcopy,internal_comms
```

#### Custom Parameters
```bash
python browser_runner.py \
  --url http://localhost:8001/index.html \
  --batch-size 5 \
  --delay-between-cases 3 \
  --delay-between-batches 15 \
  --output-dir my_test_results
```

## Test Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--url` | Required | Portal URL (use `http://localhost:8001/index.html`) |
| `--include` | All types | Content types to test: `microcopy`, `internal_comms`, `press_release` |
| `--batch-size` | 11 | Number of cases per batch |
| `--delay-between-cases` | 2 | Seconds between individual cases |
| `--delay-between-batches` | 20 | Seconds between batches (rate limiting) |
| `--output-dir` | Auto-generated | Directory for results |
| `--verbose` | False | Show detailed console output |

## Test Cases

### Microcopy (20 cases)
- Button CTAs: upload, download, submit, confirm, etc.
- Form actions: save, cancel, edit, delete
- Navigation: back, next, continue, finish

### Internal Comms (7 cases)
- Slack messages for policy updates, announcements
- Email communications for team changes, processes

### Press Release (6 cases)
- External announcements for press, customers, investors
- Different tones based on audience

## Results Analysis

### Automatic Analysis
Every test run now automatically generates:

1. **Detailed Analysis File** (`detailed_test_analysis_YYYYMMDD_HHMMSS.txt`)
   - Complete breakdown of each test case
   - Request parameters sent
   - Corpus references selected
   - Full prompts (SYSTEM + USER) sent to LLM
   - Generated results
   - TRS scoring breakdown

2. **Summary JSON** (`test_summary_YYYYMMDD_HHMMSS.json`)
   - Structured data for programmatic analysis
   - High-level statistics
   - Case-by-case data

3. **Raw Results** (in output directory)
   - Individual test case JSON files
   - Console logs with verbose output
   - Performance metrics

### Manual Analysis
If you need to analyze existing results:

```bash
python analyze_test_results.py <results_file.jsonl>
```

## Understanding Results

### Success Metrics
- **Success Rate**: Percentage of tests that completed successfully
- **TRS Score**: Quality score (0-100) based on rules, lexicon, and critic
- **Duration**: Response time in milliseconds

### TRS Scoring Breakdown
- **Rules** (40 points): Adherence to content policies
- **Lexicon** (20 points): Use of preferred/banned words
- **Critic** (40 points): Overall quality assessment

### Expected Performance
- **Success Rate**: >95% (typically 100%)
- **Average TRS**: >80 (typically 85-90)
- **Duration**: 1-3 seconds per case

## Troubleshooting

### Common Issues

#### Server Not Running
```
❌ Server is not running on localhost:8001
```
**Solution**: Start the server with `python3 -m http.server 8001`

#### Playwright Installation Issues
```
❌ Error installing Playwright
```
**Solution**: The script will automatically install Playwright and Chromium

#### Rate Limiting
```
429 Too Many Requests
```
**Solution**: The baseline test includes built-in delays. For manual tests, increase delays:
```bash
python browser_runner.py --delay-between-cases 5 --delay-between-batches 30
```

#### Port Already in Use
```
OSError: [Errno 48] Address already in use
```
**Solution**: Use a different port or stop the existing server

### Debug Mode
For detailed debugging, run with verbose output:
```bash
python browser_runner.py --verbose --headful
```

## Performance Baseline

The baseline test (`run_baseline_test.py`) establishes performance metrics:

- **33 test cases** across all content types
- **Rate limiting** with 2s between cases, 20s between batches
- **Automatic analysis** generation
- **Comprehensive reporting**

Run this regularly to track performance over time and catch regressions.

## Continuous Integration

For CI/CD pipelines:

```bash
# Install dependencies
pip install playwright
python -m playwright install chromium

# Start server (background)
python3 -m http.server 8001 &
SERVER_PID=$!

# Wait for server
sleep 3

# Run tests
python run_baseline_test.py

# Cleanup
kill $SERVER_PID
```

## File Structure

```
LemonadeSelfServicePortal/
├── browser_runner.py          # Main test runner
├── run_baseline_test.py       # Automated baseline test
├── analyze_test_results.py    # Results analysis script
├── TESTING.md                 # This guide
├── baseline_test_YYYYMMDD_HHMMSS/  # Test results
│   ├── runs_YYYYMMDD_HHMMSS.jsonl  # Raw results
│   └── console_logs/          # Detailed logs
├── detailed_test_analysis_YYYYMMDD_HHMMSS.txt  # Auto-generated analysis
└── test_summary_YYYYMMDD_HHMMSS.json           # Auto-generated summary
```
