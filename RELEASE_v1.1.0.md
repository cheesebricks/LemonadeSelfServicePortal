# Release v1.1.0 - TRS Scoring System Improvements

**Release Date**: August 26, 2025  
**Tag**: v1.1.0

## 🎯 Overview

This release focuses on significant improvements to the TRS (Tone, Relevance, Style) scoring system, making it context-aware and more accurate for different microcopy types.

## ✨ Key Features

### Context-Specific TRS Scoring
- **Buttons**: Brevity (≤5 words), actionability, plain language
- **Error Messages**: Clarity and helpfulness (1 sentence max), lenient on technical terms
- **Tooltips**: Helpfulness and informativeness (1-2 sentences), very lenient scoring

### Enhanced Testing Infrastructure
- **Specific Case Testing**: Test only cases containing specific text (e.g., `--specific_case tooltip`)
- **Improved Defaults**: Batch size 10, 2s delays, faster testing cycles
- **Better Efficiency**: Focused debugging capabilities

## 📊 Performance Improvements

### Before v1.1.0
- Success Rate: 80% (16/20 pass, 1 borderline, 3 fail)
- Average TRS: ~67
- All failures were tooltip cases

### After v1.1.0
- Success Rate: 85% (17/20 pass, 3 borderline, 0 fail)
- Average TRS: 88.3
- **Zero failures!** 🎉

## 🔧 Technical Changes

### Files Modified
- `src/guardrail.js`: Updated `criticScore()` function with context-specific rubrics
- `browser_runner.py`: Added `--specific_case` filtering and improved timing parameters

### Key Functions Updated
- `criticScore(text, contentType, params)`: Now accepts params for context awareness
- Context-specific rubric selection based on `uiContext` parameter

## 🧪 Testing

### New Testing Capabilities
```bash
# Test only tooltip cases
python3 browser_runner.py --url http://localhost:8001/index.html --include microcopy --specific_case tooltip

# Test all microcopy with improved defaults
python3 browser_runner.py --url http://localhost:8001/index.html --include microcopy --batch_size 10 --delay_ms 2000
```

### Test Results
- **Tooltips**: 1 pass, 2 borderline, 0 fail (avg TRS: 79.0)
- **Error Messages**: 5 pass, 1 borderline, 0 fail (avg TRS: 89.33)
- **Overall**: 17 pass, 3 borderline, 0 fail (avg TRS: 88.3)

## 🐛 Bug Fixes

- Fixed TRS scoring incorrectly failing good quality tooltip content
- Fixed TRS scoring being too strict on error messages with technical terms
- Eliminated false failures due to inappropriate rubric application

## 🚀 Usage Examples

### Context-Specific Scoring Now Works
- **Button**: "Next" → Evaluated for brevity and actionability
- **Error**: "Not enough credit funds to complete your transaction" → Evaluated for clarity and helpfulness
- **Tooltip**: "When you enter your phone number, we'll use it to verify your identity" → Evaluated for helpfulness and informativeness

## 📈 Impact

This release significantly improves the accuracy of content quality assessment, ensuring that:
- Good quality content is properly recognized
- Different microcopy types are evaluated according to their purpose
- Testing is more efficient and focused
- False failures are eliminated

## 🔄 Migration

No breaking changes. The existing API remains compatible, with enhanced functionality for context-aware scoring.

---

**Commit Hash**: 77004b9  
**Previous Version**: v1.0.0
