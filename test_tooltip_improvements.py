#!/usr/bin/env python3
"""
Test tooltip improvements by running the specific tooltip test cases
from the human verification tests to see if they're more concise now.
"""

import asyncio
import json
import time
from playwright.async_api import async_playwright

# Tooltip test cases from HUMAN_VERIFICATION_TESTS.md
TOOLTIP_TEST_CASES = [
    {
        "test_case": 21,
        "type": "microcopy",
        "uiContext": "tooltip",
        "surface": "tooltip", 
        "intent": "password rules"
    },
    {
        "test_case": 22,
        "type": "microcopy",
        "uiContext": "tooltip",
        "surface": "tooltip",
        "intent": "explain coverage limit"
    },
    {
        "test_case": 23,
        "type": "microcopy", 
        "uiContext": "tooltip",
        "surface": "tooltip",
        "intent": "why we need this info"
    },
    {
        "test_case": 24,
        "type": "microcopy",
        "uiContext": "tooltip", 
        "surface": "tooltip",
        "intent": "phone number purpose"
    },
    {
        "test_case": 25,
        "type": "microcopy",
        "uiContext": "tooltip",
        "surface": "tooltip",
        "intent": "upload requirements"
    },
    {
        "test_case": 26,
        "type": "microcopy",
        "uiContext": "tooltip",
        "surface": "tooltip", 
        "intent": "payment security"
    },
    {
        "test_case": 27,
        "type": "microcopy",
        "uiContext": "tooltip",
        "surface": "tooltip",
        "intent": "data privacy"
    },
    {
        "test_case": 28,
        "type": "microcopy",
        "uiContext": "tooltip",
        "surface": "tooltip",
        "intent": "claim process"
    },
    {
        "test_case": 29,
        "type": "microcopy",
        "uiContext": "tooltip",
        "surface": "tooltip",
        "intent": "policy explanation"
    },
    {
        "test_case": 30,
        "type": "microcopy",
        "uiContext": "tooltip",
        "surface": "tooltip",
        "intent": "deductible explanation"
    }
]

async def test_tooltip_case(page, test_case):
    """Test a single tooltip case and return results"""
    print(f"\n🧪 Testing Tooltip Case {test_case['test_case']}: {test_case['intent']}")
    
    # Navigate to the app
    await page.goto('http://localhost:8001/index.html')
    await page.wait_for_load_state('networkidle')
    
    # Select microcopy type
    await page.select_option('select[name="type"]', 'microcopy')
    await page.wait_for_timeout(500)
    
    # Fill in the form
    await page.select_option('select[name="uiContext"]', 'tooltip')
    await page.fill('input[name="surface"]', test_case['surface'])
    await page.fill('input[name="intent"]', test_case['intent'])
    
    # Submit the form
    await page.click('button[type="submit"]')
    
    # Wait for results
    await page.wait_for_selector('.result', timeout=10000)
    
    # Extract results
    result_text = await page.text_content('.result')
    trs_score = await page.text_content('.trs-score')
    
    # Clean up the result text
    result_text = result_text.strip()
    if result_text.startswith('Generated:'):
        result_text = result_text.replace('Generated:', '').strip()
    
    print(f"📝 Output: {result_text}")
    print(f"📊 TRS: {trs_score}")
    
    # Analyze the result
    word_count = len(result_text.split())
    char_count = len(result_text)
    sentence_count = len([s for s in result_text.split('.') if s.strip()])
    
    print(f"📈 Analysis: {word_count} words, {char_count} chars, {sentence_count} sentences")
    
    return {
        "test_case": test_case['test_case'],
        "intent": test_case['intent'],
        "output": result_text,
        "trs": trs_score,
        "word_count": word_count,
        "char_count": char_count,
        "sentence_count": sentence_count
    }

async def main():
    """Run all tooltip test cases"""
    print("🚀 Testing Tooltip Improvements")
    print("=" * 50)
    
    results = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        for test_case in TOOLTIP_TEST_CASES:
            try:
                result = await test_tooltip_case(page, test_case)
                results.append(result)
                
                # Small delay between tests
                await asyncio.sleep(2)
                
            except Exception as e:
                print(f"❌ Error in test case {test_case['test_case']}: {e}")
                results.append({
                    "test_case": test_case['test_case'],
                    "intent": test_case['intent'],
                    "error": str(e)
                })
        
        await browser.close()
    
    # Print summary
    print("\n" + "=" * 50)
    print("📊 TOOLTIP IMPROVEMENTS SUMMARY")
    print("=" * 50)
    
    successful_results = [r for r in results if 'error' not in r]
    
    if successful_results:
        avg_words = sum(r['word_count'] for r in successful_results) / len(successful_results)
        avg_chars = sum(r['char_count'] for r in successful_results) / len(successful_results)
        avg_sentences = sum(r['sentence_count'] for r in successful_results) / len(successful_results)
        
        print(f"✅ Successful tests: {len(successful_results)}/{len(TOOLTIP_TEST_CASES)}")
        print(f"📏 Average words: {avg_words:.1f}")
        print(f"📏 Average characters: {avg_chars:.1f}")
        print(f"📏 Average sentences: {avg_sentences:.1f}")
        
        print("\n📋 Detailed Results:")
        for result in successful_results:
            status = "✅" if result['sentence_count'] <= 1 and result['word_count'] <= 15 else "⚠️"
            print(f"{status} Case {result['test_case']}: {result['word_count']}w, {result['char_count']}c, {result['sentence_count']}s")
            print(f"   Intent: {result['intent']}")
            print(f"   Output: {result['output']}")
            print()
    
    # Save results to file
    with open('tooltip_improvement_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"💾 Results saved to tooltip_improvement_results.json")

if __name__ == "__main__":
    asyncio.run(main())
