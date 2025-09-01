# Content Type Analysis: Content Drift & Relevance Issues

## Overview
This analysis examines each content type for potential issues similar to the "GOD hired as Co-CEO" problem where the system generated completely irrelevant content.

## 1. MICROCOPY

### ✅ **Strengths**
- **Intent-specific requirements**: Each intent has specific preferred verbs
- **UI context awareness**: Different requirements for button, error, tooltip
- **Strong validation**: Must include intent-specific verbs or gets -6 penalty

### ⚠️ **Potential Issues**
- **Intent drift**: If LLM ignores the specific intent, could generate generic content
- **Context confusion**: Button text might become too verbose despite 5-word limit
- **Semantic matching**: "pay now" vs "pay" - could miss intent variations

### 🔍 **Risk Assessment: LOW**
- Strong intent enforcement through lexicon scoring
- Clear word limits and penalties
- Specific UI context requirements

---

## 2. INTERNAL COMMS

### ✅ **Strengths**
- **Keyword enforcement**: Requires ≥2 keywords from title+key_update
- **Channel-specific formatting**: Clear Slack vs Email distinction
- **Semantic matching**: Enhanced keyword recognition (dogs → dog-free)

### ⚠️ **Potential Issues**
- **Title inclusion**: Previously had unwanted title headers in Slack (FIXED)
- **Generic messaging**: Could drift into company boilerplate instead of specific updates
- **Keyword dilution**: Might include keywords but lose context

### 🔍 **Risk Assessment: MEDIUM**
- Good keyword enforcement but could still generate generic content
- Channel formatting issues (now fixed)
- Potential for corporate speak instead of specific announcements

---

## 3. PRESS RELEASE

### 🚨 **CRITICAL ISSUES IDENTIFIED**

#### **Content Drift Problem**
- **Weak prompt requirements**: Only required 1 keyword (now fixed to 2-3)
- **Generic feedback**: Retry system said "use professional tone" instead of "include specific announcement details"
- **No content relevance enforcement**: Could generate any insurance-related content

#### **Specific Example: "GOD hired as Co-CEO"**
- **Requested**: God, Co-CEO, haven/hell, life insurance, damnation
- **Generated**: Generic AI platform partnership content
- **Root Cause**: System lost focus on specific announcement

#### **Audience-Specific Issues**
- **Press audience**: Might generate generic corporate speak
- **Customer audience**: Could drift into marketing fluff
- **Investor audience**: Might lose specific financial details

### 🔍 **Risk Assessment: HIGH** (Now being addressed)

---

## 4. SYSTEMIC ISSUES ACROSS ALL TYPES

### 🚨 **Common Problems**

#### **1. Generic Feedback in Retry System**
- **Problem**: Feedback like "use professional tone" doesn't address content relevance
- **Impact**: Each retry moves further from original request
- **Solution**: Content-specific feedback with keyword requirements

#### **2. Weak Content Relevance Enforcement**
- **Problem**: TRS scoring focuses on style over substance
- **Impact**: High-scoring but irrelevant content
- **Solution**: Enhanced critic scoring with strict relevance requirements

#### **3. Corpus Reference Mismatch**
- **Problem**: References might not match the specific request
- **Impact**: LLM learns wrong style/content patterns
- **Solution**: Better reference selection and validation

#### **4. Prompt Template Weakness**
- **Problem**: Vague requirements like "include keywords"
- **Impact**: LLM interprets requirements loosely
- **Solution**: Specific, actionable requirements with examples

---

## 5. RECOMMENDED FIXES BY PRIORITY

### 🔴 **CRITICAL (Fix Immediately)**

#### **Press Release Content Relevance**
- ✅ **DONE**: Enhanced prompt requirements
- ✅ **DONE**: Stricter TRS scoring (≥2 keywords, bigger penalties)
- ✅ **DONE**: Enhanced critic scoring with strict relevance
- ✅ **DONE**: Better retry feedback system

### 🟡 **HIGH (Fix Soon)**

#### **Internal Comms Content Focus**
- **Enhance prompt**: "Focus on the specific update, not general company information"
- **Add validation**: Check that content directly addresses title/key_update
- **Improve feedback**: "Include specific details from your announcement"

#### **Microcopy Intent Preservation**
- **Enhance validation**: Ensure generated content matches intent exactly
- **Add examples**: Show what good vs bad intent matching looks like
- **Improve scoring**: Penalize content that doesn't address the specific intent

### 🟢 **MEDIUM (Fix When Possible)**

#### **Corpus Reference Quality**
- **Validate references**: Ensure they match the specific request context
- **Add relevance scoring**: Rate how well references match the current request
- **Improve selection**: Better matching algorithms for reference selection

#### **System-Wide Content Validation**
- **Add content relevance checks**: Verify output actually addresses the input
- **Implement content drift detection**: Flag when content moves away from request
- **Enhanced logging**: Track content relevance metrics

---

## 6. TESTING STRATEGY

### **High-Risk Test Cases**

#### **Press Release**
1. **Specific announcement**: "GOD hired as Co-CEO" (should include God, Co-CEO, haven/hell)
2. **Financial news**: "Q4 earnings $2.5M" (should include specific numbers)
3. **Product launch**: "New pet insurance for dragons" (should include dragons, pet insurance)

#### **Internal Comms**
1. **Specific policy**: "No dogs in office" (should include dogs, office, policy)
2. **Event announcement**: "Team lunch Friday 12pm" (should include team, lunch, Friday, 12pm)
3. **System update**: "Maintenance window 2-4am" (should include maintenance, 2-4am)

#### **Microcopy**
1. **Specific intent**: "pay now" (should generate payment-related content)
2. **Error context**: "file upload failed" (should address upload, failure, solution)
3. **Tooltip purpose**: "why we need this info" (should explain the specific need)

---

## 7. SUCCESS METRICS

### **Content Relevance**
- **Keyword inclusion**: ≥90% of requests include required keywords
- **Content drift**: <5% of outputs lose focus on original request
- **Generic content**: <2% of outputs are generic boilerplate

### **User Satisfaction**
- **Relevance score**: Users rate content relevance ≥8/10
- **Retry reduction**: <10% of requests need retries due to content drift
- **Feedback quality**: Retry feedback addresses specific content issues

---

## 8. IMPLEMENTATION TIMELINE

### **Phase 1 (Immediate)**
- ✅ Press release content relevance fixes
- ✅ Enhanced TRS scoring
- ✅ Better retry feedback

### **Phase 2 (Next Week)**
- Internal comms content focus improvements
- Microcopy intent preservation enhancements
- Content drift detection system

### **Phase 3 (Next Month)**
- Corpus reference quality improvements
- System-wide content validation
- Advanced content relevance metrics

---

## Conclusion

The "GOD hired as Co-CEO" issue revealed a **systemic content relevance problem** that affects all content types to varying degrees. While microcopy has strong intent enforcement, internal comms and press releases are vulnerable to content drift and generic generation.

The fixes implemented for press releases should serve as a template for improving content relevance across all types. The key is **stronger prompt requirements**, **stricter content validation**, and **better retry feedback** that focuses on content relevance rather than just style improvements.
