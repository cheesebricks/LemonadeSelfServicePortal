# Phase 2 Test Plan: Content Relevance Improvements

## Overview
This test plan validates the Phase 2 fixes for content relevance across all content types, focusing on preventing content drift and generic generation.

## 🧪 **Test Categories**

### **1. INTERNAL COMMS - Content Focus Tests**

#### **Test Case: "No Dogs in Office"**
- **Input**: Title: "no dogs", Key Update: "no dogs in office they scare the devops"
- **Expected**: Message focuses on dogs, office, devops team, not generic company policy
- **Success Criteria**: 
  - Contains "dogs", "office", "devops" or semantic variations
  - No generic corporate messaging
  - Directly addresses the specific policy change

#### **Test Case: "Team Lunch Friday"**
- **Input**: Title: "team lunch", Key Update: "team lunch Friday 12pm in cafeteria"
- **Expected**: Message focuses on lunch, Friday, 12pm, cafeteria
- **Success Criteria**:
  - Contains specific time and location details
  - No generic team building language
  - Directly announces the specific event

#### **Test Case: "System Maintenance"**
- **Input**: Title: "maintenance window", Key Update: "system maintenance 2-4am tonight"
- **Expected**: Message focuses on maintenance, 2-4am, tonight
- **Success Criteria**:
  - Contains specific timing details
  - No generic system update language
  - Directly announces the specific maintenance

### **2. MICROCOPY - Intent Preservation Tests**

#### **Test Case: "Pay Now" Button**
- **Input**: Intent: "pay", UI Context: "button"
- **Expected**: Button text directly related to payment
- **Success Criteria**:
  - Contains payment-related words (pay, checkout, complete)
  - Not generic (click here, learn more)
  - Clearly indicates payment action

#### **Test Case: "File Upload Failed" Error**
- **Input**: Intent: "upload_docs", UI Context: "error"
- **Expected**: Error message addresses file upload failure
- **Success Criteria**:
  - Mentions file upload or document submission
  - Not generic error message
  - Suggests specific solution for upload issue

#### **Test Case: "Why We Need This Info" Tooltip**
- **Input**: Intent: "help", UI Context: "tooltip"
- **Expected**: Tooltip explains why specific information is needed
- **Success Criteria**:
  - Addresses the specific question about information need
  - Not generic help text
  - Explains the specific purpose

### **3. PRESS RELEASE - Content Relevance Tests**

#### **Test Case: "GOD hired as Co-CEO"**
- **Input**: Headline: "GOD hired as Co-CEO", Key Message: "new Co-CEO, open new market in haven and hell for life insurance and damnation reduced"
- **Expected**: Content includes God, Co-CEO, haven/hell, life insurance, damnation
- **Success Criteria**:
  - Contains at least 3 keywords from headline/key message
  - No generic insurance content
  - Directly addresses the specific announcement

#### **Test Case: "Q4 Earnings $2.5M"**
- **Input**: Headline: "Q4 earnings", Key Message: "Q4 earnings $2.5M, 15% growth"
- **Expected**: Content includes Q4, earnings, $2.5M, 15%, growth
- **Success Criteria**:
  - Contains specific financial numbers
  - No generic financial language
  - Directly reports the specific earnings

#### **Test Case: "New Pet Insurance for Dragons"**
- **Input**: Headline: "new pet insurance", Key Message: "new pet insurance for dragons, fire-breathing coverage"
- **Expected**: Content includes dragons, pet insurance, fire-breathing
- **Success Criteria**:
  - Contains specific dragon-related content
  - No generic pet insurance language
  - Directly announces the specific product

## 🔍 **Test Execution**

### **Step 1: Manual Testing**
1. Open the portal at `http://localhost:8001`
2. Test each content type with the specific test cases
3. Verify output relevance and keyword inclusion
4. Check TRS scores for content relevance

### **Step 2: Automated Testing**
1. Use the existing test runner with the new test cases
2. Verify that content drift is detected and penalized
3. Check that retry feedback addresses content relevance
4. Validate that generic content gets low TRS scores

### **Step 3: Edge Case Testing**
1. Test with minimal input (very short title/key update)
2. Test with ambiguous input (could be interpreted multiple ways)
3. Test with technical jargon input
4. Test with emotional/controversial input

## 📊 **Success Metrics**

### **Content Relevance**
- **Keyword Inclusion**: ≥90% of outputs contain required keywords
- **Content Drift**: <5% of outputs lose focus on original request
- **Generic Content**: <2% of outputs are generic boilerplate

### **TRS Scoring Accuracy**
- **Relevant Content**: Should score ≥70 TRS
- **Generic Content**: Should score ≤50 TRS
- **Content Drift**: Should be detected and penalized

### **Retry System Effectiveness**
- **Content Focus**: Retry feedback should address content relevance
- **Improvement**: Subsequent attempts should improve content relevance
- **Convergence**: System should converge on relevant content

## 🚨 **Expected Improvements**

### **Before Phase 2**
- Internal comms could drift into corporate boilerplate
- Microcopy could generate generic content not matching intent
- Press releases could lose focus on specific announcements
- TRS scoring focused on style over substance

### **After Phase 2**
- Internal comms maintain focus on specific updates
- Microcopy preserves intent and context
- Press releases stay relevant to announcements
- TRS scoring detects and penalizes content drift

## 🔧 **Test Setup**

### **Local Testing**
```bash
# Start local server
python3 -m http.server 8001

# Open browser to http://localhost:8001
# Test each content type with the test cases above
```

### **Cloud Testing**
- Test on the live portal: https://lemonade-portal.pages.dev/
- Compare results with local version
- Verify fixes are deployed

## 📝 **Test Results Template**

```
Test Case: [Name]
Content Type: [microcopy/internal_comms/press_release]
Input: [Details]
Output: [Generated content]
TRS Score: [Score]
Keywords Found: [List of keywords found]
Content Relevance: [Good/Bad/Borderline]
Notes: [Observations about content quality]
```

## 🎯 **Next Steps After Testing**

1. **Analyze Results**: Identify any remaining content drift issues
2. **Fine-tune Scoring**: Adjust TRS thresholds if needed
3. **Enhance Prompts**: Further strengthen content requirements
4. **Deploy to Production**: Push improvements to live portal
5. **Monitor Performance**: Track content relevance metrics over time

---

## Conclusion

This test plan validates that Phase 2 fixes successfully address the systemic content relevance issues identified in the analysis. The key improvements are:

- **Stronger prompt requirements** that demand specific content
- **Enhanced TRS scoring** that detects content drift
- **Better retry feedback** that focuses on content relevance
- **Content-specific validation** across all content types

Success in these tests will confirm that the system now generates relevant, focused content that directly addresses user requests rather than generic boilerplate.
