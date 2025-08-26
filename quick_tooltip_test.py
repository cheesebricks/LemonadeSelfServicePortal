#!/usr/bin/env python3
"""
Quick test of tooltip improvements - test the most problematic cases
"""

import requests
import json
import time

# Test the most problematic tooltip cases from human verification
PROBLEMATIC_TOOLTIP_CASES = [
    {
        "name": "Data Privacy (was very long)",
        "params": {
            "type": "microcopy",
            "uiContext": "tooltip",
            "surface": "tooltip",
            "intent": "data privacy"
        }
    },
    {
        "name": "Claim Process (was too long)",
        "params": {
            "type": "microcopy", 
            "uiContext": "tooltip",
            "surface": "tooltip",
            "intent": "claim process"
        }
    },
    {
        "name": "Deductible Explanation (was marketing-heavy)",
        "params": {
            "type": "microcopy",
            "uiContext": "tooltip", 
            "surface": "tooltip",
            "intent": "deductible explanation"
        }
    },
    {
        "name": "Password Rules (was borderline)",
        "params": {
            "type": "microcopy",
            "uiContext": "tooltip",
            "surface": "tooltip",
            "intent": "password rules"
        }
    }
]

def test_tooltip_case(case):
    """Test a single tooltip case"""
    print(f"\n🧪 Testing: {case['name']}")
    print(f"📝 Intent: {case['params']['intent']}")
    
    try:
        # Make request to the app
        response = requests.post(
            'http://localhost:8001/generate',
            json=case['params'],
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            output = result.get('output', 'No output')
            trs = result.get('trs', 'No TRS')
            
            # Analyze the result
            word_count = len(output.split())
            char_count = len(output)
            sentence_count = len([s for s in output.split('.') if s.strip()])
            
            print(f"📝 Output: {output}")
            print(f"📊 TRS: {trs}")
            print(f"📈 Analysis: {word_count} words, {char_count} chars, {sentence_count} sentences")
            
            # Check if it meets our new criteria
            is_concise = word_count <= 15 and sentence_count <= 1
            status = "✅ IMPROVED" if is_concise else "⚠️ STILL TOO LONG"
            print(f"🎯 {status}")
            
            return {
                "name": case['name'],
                "intent": case['params']['intent'],
                "output": output,
                "trs": trs,
                "word_count": word_count,
                "char_count": char_count,
                "sentence_count": sentence_count,
                "is_concise": is_concise
            }
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return {"name": case['name'], "error": f"HTTP {response.status_code}"}
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return {"name": case['name'], "error": str(e)}

def main():
    print("🚀 Quick Tooltip Improvement Test")
    print("=" * 50)
    
    results = []
    
    for case in PROBLEMATIC_TOOLTIP_CASES:
        result = test_tooltip_case(case)
        results.append(result)
        time.sleep(1)  # Small delay between requests
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 SUMMARY")
    print("=" * 50)
    
    successful = [r for r in results if 'error' not in r]
    improved = [r for r in successful if r.get('is_concise', False)]
    
    print(f"✅ Successful tests: {len(successful)}/{len(PROBLEMATIC_TOOLTIP_CASES)}")
    print(f"🎯 Improved (concise): {len(improved)}/{len(successful)}")
    
    if successful:
        avg_words = sum(r['word_count'] for r in successful) / len(successful)
        avg_chars = sum(r['char_count'] for r in successful) / len(successful)
        print(f"📏 Average words: {avg_words:.1f}")
        print(f"📏 Average characters: {avg_chars:.1f}")
    
    # Save results
    with open('quick_tooltip_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"💾 Results saved to quick_tooltip_results.json")

if __name__ == "__main__":
    main()
