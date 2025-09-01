#!/usr/bin/env python3
"""
Basic Test Runner - Step 1
Simple parsing and basic validation
"""

import json
import re
import os

def parse_test_cases(md_file_path):
    """Basic parsing of test cases"""
    print(f"📖 Parsing: {md_file_path}")
    
    try:
        with open(md_file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ File not found: {md_file_path}")
        return []
    
    # Split into test cases
    test_blocks = re.split(r'## Test Case \d+', content)
    test_cases = []
    
    print(f"Found {len(test_blocks)-1} test blocks")
    
    for i, block in enumerate(test_blocks[1:], 1):
        try:
            test_case = parse_single_test(block, i)
            if test_case:
                test_cases.append(test_case)
                print(f"✅ Parsed case {i}: {test_case['content_type']}")
        except Exception as e:
            print(f"⚠️  Error in case {i}: {str(e)}")
            continue
    
    return test_cases

def parse_single_test(block, case_number):
    """Parse a single test case"""
    lines = block.strip().split('\n')
    
    # Extract basic info
    content_type = None
    input_data = {}
    output_content = ""
    
    for line in lines:
        line = line.strip()
        
        # Get content type
        if '**Type**:' in line:
            content_type = line.split('**Type**:')[1].strip()
        
        # Get input parameters
        elif '**Input Parameters**:' in line:
            json_start = lines.index(line) + 1
            json_lines = []
            for j in range(json_start, len(lines)):
                if lines[j].strip().startswith('**') or lines[j].strip().startswith('---'):
                    break
                json_lines.append(lines[j].strip())
            
            # Clean and parse JSON
            json_str = ''.join(json_lines)
            if '}' in json_str:
                json_str = json_str[:json_str.rfind('}') + 1]
            json_str = re.sub(r'\s+', ' ', json_str).strip()
            if not json_str.startswith('{'):
                json_str = '{' + json_str
            
            try:
                input_data = json.loads(json_str)
            except json.JSONDecodeError as e:
                print(f"   JSON error in case {case_number}: {str(e)}")
                return None
        
        # Get output content
        elif '**Generated Output**:' in line:
            output_start = lines.index(line) + 1
            output_lines = []
            for j in range(output_start, len(lines)):
                if lines[j].strip().startswith('**') or lines[j].strip().startswith('---'):
                    break
                output_lines.append(lines[j].strip())
            output_content = '\n'.join(output_lines)
            break
    
    if not content_type or not input_data:
        return None
    
    return {
        'case_number': case_number,
        'content_type': content_type,
        'input': input_data,
        'output': output_content
    }

def run_basic_validation(test_case):
    """Basic validation checks"""
    issues = []
    
    # Check if output exists
    if not test_case['output'].strip():
        issues.append("No output content")
    
    # Check content type specific rules
    if test_case['content_type'] == 'microcopy':
        ui_context = test_case['input'].get('uiContext', '').lower()
        if ui_context == 'button':
            word_count = len(test_case['output'].split())
            if word_count > 5:
                issues.append(f"Button too long: {word_count} words")
    
    return issues

def main():
    """Main execution"""
    print("🚀 Basic Test Runner - Step 1")
    print("=" * 40)
    
    # Parse test cases
    test_cases = parse_test_cases('HUMAN_VERIFICATION_TESTS.md')
    
    if not test_cases:
        print("❌ No test cases found")
        return
    
    print(f"\n📊 Summary:")
    print(f"Total test cases: {len(test_cases)}")
    
    # Count by type
    type_counts = {}
    for tc in test_cases:
        content_type = tc['content_type']
        type_counts[content_type] = type_counts.get(content_type, 0) + 1
    
    print("\nContent type breakdown:")
    for content_type, count in type_counts.items():
        print(f"  {content_type}: {count}")
    
    # Run basic validation on first few cases
    print(f"\n🧪 Basic validation (first 3 cases):")
    for i, test_case in enumerate(test_cases[:3]):
        print(f"\nCase {test_case['case_number']}: {test_case['content_type']}")
        print(f"  Input: {test_case['input']}")
        print(f"  Output: {test_case['output'][:100]}{'...' if len(test_case['output']) > 100 else ''}")
        
        issues = run_basic_validation(test_case)
        if issues:
            print(f"  Issues: {', '.join(issues)}")
        else:
            print(f"  ✅ No issues detected")

if __name__ == "__main__":
    main()
