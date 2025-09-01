# Enhanced Test Report

**Generated:** 2025-09-01 14:05:49

## Summary

- **Total Tests:** 9
- **Tests with Issues:** 9
- **Success Rate:** 0.0%

## Issue Breakdown

| Issue Type | Count |
|-------------|-------|
| Content Drift | 4 |
| Channel Misalignment | 7 |
| Dual Channel Output | 0 |
| Format Non Compliance | 0 |
| Llm Validation Failed | 0 |

## Detailed Test Results

### Test Case 37: Press_Release

| Field | Value |
|-------|-------|
| Content Type | press_release |
| Audience | customers |
| Headline | Improved customer support |
| Key Message | 24/7 chat support and faster response times |
| Output |  |

#### Issues Detected

| Type | Severity | Description | Method |
|------|----------|-------------|---------|
| Content Drift | high | Output does not directly address input request | automated_keyword_check |
| Channel Misalignment | medium | Output format does not match requested channel/context | automated_format_check |

---

### Test Case 39: Press_Release

| Field | Value |
|-------|-------|
| Content Type | press_release |
| Audience | investors |
| Headline | Unit economics update |
| Key Message | loss ratio trends and disciplined growth across geos |
| Output |  |

#### Issues Detected

| Type | Severity | Description | Method |
|------|----------|-------------|---------|
| Content Drift | high | Output does not directly address input request | automated_keyword_check |
| Channel Misalignment | medium | Output format does not match requested channel/context | automated_format_check |

---

### Test Case 42: Internal_Comms

| Field | Value |
|-------|-------|
| Content Type | internal_comms |
| Channel | Slack |
| Title | db maintenance |
| Key Update | analytics warehouse maintenance Friday 22:00-23:00 UTC |
| Output |  |

#### Issues Detected

| Type | Severity | Description | Method |
|------|----------|-------------|---------|
| Content Drift | high | Output does not directly address input request | automated_keyword_check |

---

### Test Case 44: Internal_Comms

| Field | Value |
|-------|-------|
| Content Type | internal_comms |
| Channel | Slack |
| Title | office policy refresh |
| Key Update | quiet rooms first-come; new booking rules apply |
| Output |  |

#### Issues Detected

| Type | Severity | Description | Method |
|------|----------|-------------|---------|
| Content Drift | high | Output does not directly address input request | automated_keyword_check |

---

### Test Case 46: Internal_Comms

| Field | Value |
|-------|-------|
| Content Type | internal_comms |
| Channel | Email |
| Title | holiday coverage |
| Key Update | reduced coverage on national holiday; escalation as usual |
| Output |  Due to the upcoming national holiday, we'll have reduced coverage in place. However, our escalation... |

#### Issues Detected

| Type | Severity | Description | Method |
|------|----------|-------------|---------|
| Channel Misalignment | medium | Output format does not match requested channel/context | automated_format_check |

---

### Test Case 47: Internal_Comms

| Field | Value |
|-------|-------|
| Content Type | internal_comms |
| Channel | Email |
| Title | design crit changes |
| Key Update | weekly crit now pairs; submit figs by EOD Monday |
| Output |  We've made some changes to our design crit process. Going forward, our weekly crit sessions will no... |

#### Issues Detected

| Type | Severity | Description | Method |
|------|----------|-------------|---------|
| Channel Misalignment | medium | Output format does not match requested channel/context | automated_format_check |

---

### Test Case 48: Internal_Comms

| Field | Value |
|-------|-------|
| Content Type | internal_comms |
| Channel | Email |
| Title | company event |
| Key Update | all-hands offsite confirmed for next month, details soon |
| Output |  Great news! Our all-hands offsite has been confirmed for next month. We're excited to bring the tea... |

#### Issues Detected

| Type | Severity | Description | Method |
|------|----------|-------------|---------|
| Channel Misalignment | medium | Output format does not match requested channel/context | automated_format_check |

---

### Test Case 49: Internal_Comms

| Field | Value |
|-------|-------|
| Content Type | internal_comms |
| Channel | Email |
| Title | benefits update |
| Key Update | health insurance options updated; enrollment period opens next week |
| Output |  We're excited to announce that our health insurance options have been updated, and the enrollment p... |

#### Issues Detected

| Type | Severity | Description | Method |
|------|----------|-------------|---------|
| Channel Misalignment | medium | Output format does not match requested channel/context | automated_format_check |

---

### Test Case 50: Internal_Comms

| Field | Value |
|-------|-------|
| Content Type | internal_comms |
| Channel | Email |
| Title | security training |
| Key Update | mandatory security training due by end of month; check your inbox |
| Output |  This is a reminder that mandatory security training is due by the end of the month. Please check yo... |

#### Issues Detected

| Type | Severity | Description | Method |
|------|----------|-------------|---------|
| Channel Misalignment | medium | Output format does not match requested channel/context | automated_format_check |

---
