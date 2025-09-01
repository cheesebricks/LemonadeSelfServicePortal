# Enhanced Test Runner for Content Quality Validation

This enhanced test runner automatically validates your 33 test cases from `HUMAN_VERIFICATION_TESTS.md` for content quality issues including content drift, channel misalignment, and format compliance.

## 🚀 Features

- **Automated Issue Detection**: No scoring, just issue identification
- **LLM Integration**: Uses Groq API for content relevance validation
- **Selective Testing**: Run all tests or specific test cases
- **Comprehensive Reports**: Markdown reports with detailed tables
- **Content Type Aware**: Handles internal comms, press releases, and microcopy properly

## 📋 Issue Types Detected

### 1. Content Drift
- **Description**: Output does not address the input request
- **Detection**: Keyword matching + LLM validation
- **Severity**: High

### 2. Channel Misalignment  
- **Description**: Output format doesn't match requested channel/context
- **Examples**: 
  - Slack output with email formatting
  - Press release without headline/key message keywords
  - Microcopy exceeding length limits
- **Severity**: Medium

### 3. Dual Channel Output
- **Description**: Output contains content for multiple channels
- **Examples**: "Slack: message... Email: message..."
- **Severity**: High

### 4. Format Non-Compliance
- **Description**: Output doesn't meet format requirements
- **Examples**: Button >5 words, tooltip >1 sentence
- **Severity**: Low

## 🛠️ Setup

### 1. Install Dependencies
```bash
pip install requests
```

### 2. Set Groq API Key
```bash
export GROQ_API_KEY="your_groq_api_key_here"
```

**Note**: If no API key is set, LLM validation will be skipped but automated checks will still run.

### 3. Ensure Test File Exists
Make sure `HUMAN_VERIFICATION_TESTS.md` is in the same directory.

## 🎯 Usage

### Run All Tests
```bash
python3 enhanced_test_runner.py
# When prompted, enter 'y' or 'yes'
```

### Run Selective Tests
```bash
python3 enhanced_test_runner.py
# When prompted, enter specific case numbers: 1,3,5
```

### Run Specific Test Cases
```bash
python3 enhanced_test_runner.py
# Enter: 1,2,3,4,5
```

## 📊 Output

### Console Output
```
🚀 Starting Enhanced Test Suite
============================================================
🎯 Running all 33 test cases

🧪 Testing Case 1: internal_comms
   Input: {'channel': 'Slack', 'title': 'God joins as CEO', 'key_update': 'new CEO...'}
   ✅ No issues detected

🧪 Testing Case 2: press_release  
   Input: {'headline': 'Product Launch', 'key_message': 'new features...'}
   ❌ Found 1 issues
      • content_drift: Output does not directly address input request
```

### Markdown Report
The runner generates `enhanced_test_report.md` with:

- **Summary**: Total tests, success rate, issue breakdown
- **Detailed Results**: Each test case with input, output, and detected issues
- **LLM Validation**: When available, shows relevance assessment
- **Issue Tables**: Structured view of all detected problems

## 🔍 Example Report Structure

```markdown
# Enhanced Test Report

## Summary
- **Total Tests:** 33
- **Tests with Issues:** 8  
- **Success Rate:** 75.8%

## Issue Breakdown
| Issue Type | Count |
|-------------|-------|
| Content Drift | 3 |
| Channel Misalignment | 2 |
| Dual Channel Output | 1 |
| Format Non Compliance | 2 |

## Detailed Test Results

### Test Case 1: Internal Comms
| Field | Value |
|-------|-------|
| Content Type | internal_comms |
| Channel | Slack |
| Title | God joins as CEO |
| Key Update | new CEO, will make changes... |
| Output | Welcome God joins as CEO! new CEO... |

#### ✅ No Issues Detected
```

## ⚙️ Configuration

Edit `test_config.py` to adjust:

- **Validation Thresholds**: Minimum keyword matches, max lengths
- **Severity Levels**: Issue importance assignments  
- **Content Type Rules**: Specific validation logic for each type

## 🧪 Testing Strategy

### 1. Initial Run
Run all 33 tests to establish baseline:
```bash
python3 enhanced_test_runner.py
# Enter: y
```

### 2. Focus on Issues
Run only tests with detected issues:
```bash
python3 enhanced_test_runner.py  
# Enter specific case numbers from report
```

### 3. Validate Fixes
After making changes, re-run problematic tests to verify fixes.

## 🔧 Troubleshooting

### Common Issues

**"No test cases found"**
- Ensure `HUMAN_VERIFICATION_TESTS.md` exists and is readable
- Check file format matches expected structure

**"LLM validation failed"**
- Verify `GROQ_API_KEY` is set correctly
- Check internet connection and API availability
- Review API rate limits

**"Error parsing test case"**
- Check markdown formatting in test file
- Ensure consistent structure across all test cases

### Debug Mode
Add debug prints to `enhanced_test_runner.py` by modifying the parsing functions.

## 📈 Expected Results

### Before Fixes
- **Content Drift**: 30-40% of cases
- **Channel Misalignment**: 20-30% of cases
- **Dual Channel Output**: 10-20% of cases

### After Fixes  
- **Content Drift**: <10% of cases
- **Channel Misalignment**: <5% of cases
- **Dual Channel Output**: <2% of cases

## 🎯 Next Steps

1. **Run Initial Test**: Establish baseline with all 33 cases
2. **Review Issues**: Focus on high-severity problems first
3. **Implement Fixes**: Address content drift and channel alignment
4. **Re-test**: Validate improvements with selective testing
5. **Iterate**: Continue until success rate >90%

## 📞 Support

For issues or questions:
1. Check the console output for error messages
2. Review the generated markdown report
3. Verify test file format and API configuration
4. Run selective tests to isolate problems

---

**Happy Testing! 🧪✨**
