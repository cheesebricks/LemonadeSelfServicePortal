#!/usr/bin/env python3
"""
Debug Test Runner - Step 2
Debug output parsing issues
"""

import json
import re

def debug_test_case(case_number):
    """Debug a specific test case"""
    print(f"🔍 Debugging Test Case {case_number}")
    print("=" * 50)
    
    try:
        with open('HUMAN_VERIFICATION_TESTS.md', 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print("❌ File not found")
        return
    
    # Find the specific test case
    test_blocks = re.split(r'## Test Case \d+', content)
    if case_number < len(test_blocks):
        block = test_blocks[case_number]
        print(f"Raw block length: {len(block)}")
        print(f"First 200 chars: {block[:200]}")
        
        # Look for output section
        lines = block.strip().split('\n')
        print(f"\nTotal lines: {len(lines)}")
        
        for i, line in enumerate(lines):
            if '**Generated Output**:' in line:
                print(f"\n🎯 Found output marker at line {i}: {line}")
                print(f"Next few lines:")
                for j in range(i+1, min(i+6, len(lines))):
                    print(f"  {j}: '{lines[j]}'")
                break
        else:
            print("❌ No output marker found")
            
    else:
        print(f"❌ Test case {case_number} not found")

def main():
    """Debug specific test cases"""
    print("🚀 Debug Test Runner - Step 2")
    print("=" * 40)
    
    # Debug a few test cases
    for case_num in [37, 39, 42]:
        debug_test_case(case_num)
        print("\n" + "-" * 50 + "\n")

if __name__ == "__main__":
    main()
