#!/usr/bin/env python3
"""
Fixed Test Runner - Step 3
Fixed output parsing logic with improved validation
"""

import json
import re
import os

def parse_test_cases(md_file_path):
    """Parse test cases with fixed output parsing"""
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
    """Parse a single test case with fixed output parsing"""
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
        
        # Get output content - FIXED: Extract from same line
        elif '**Generated Output**:' in line:
            # Extract content from the same line after the marker
            output_marker = '**Generated Output**:'
            if output_marker in line:
                output_content = line.split(output_marker)[1].strip()
                # Remove quotes if present
                if output_content.startswith('"') and output_content.endswith('"'):
                    output_content = output_content[1:-1]
            break
    
    if not content_type or not input_data:
        return None
    
    return {
        'case_number': case_number,
        'content_type': content_type,
        'input': input_data,
        'output': output_content
    }

def run_validation(test_case):
    """Run validation checks with improved logic for microcopy"""
    issues = []
    
    # Check if output exists
    if not test_case['output'].strip():
        issues.append("No output content")
        return issues
    
    # Content type specific checks
    if test_case['content_type'] == 'microcopy':
        ui_context = test_case['input'].get('uiContext', '').lower()
        intent = test_case['input'].get('intent', '').lower()
        output_text = test_case['output'].lower().strip()
        
        if ui_context == 'button':
            word_count = len(test_case['output'].split())
            if word_count > 5:
                issues.append(f"Button too long: {word_count} words")
            
            # For buttons, check if the output is a reasonable representation of the intent
            # Simple button text like "Next" for intent "next" is valid
            if intent in ['next', 'submit', 'save', 'back', 'agree', 'decline']:
                # These are common button patterns - check if output is reasonable
                if intent == 'next' and output_text not in ['next', 'continue', 'proceed']:
                    issues.append(f"Button mismatch: intent '{intent}' should produce 'Next' or similar")
                elif intent == 'submit' and output_text not in ['submit', 'send', 'confirm']:
                    issues.append(f"Button mismatch: intent '{intent}' should produce 'Submit' or similar")
                elif intent == 'save' and output_text not in ['save', 'store', 'keep']:
                    issues.append(f"Button mismatch: intent '{intent}' should produce 'Save' or similar")
                elif intent == 'back' and output_text not in ['back', 'previous', 'return']:
                    issues.append(f"Button mismatch: intent '{intent}' should produce 'Back' or similar")
                elif intent == 'agree' and output_text not in ['agree', 'accept', 'yes']:
                    issues.append(f"Button mismatch: intent '{intent}' should produce 'Agree' or similar")
                elif intent == 'decline' and output_text not in ['decline', 'reject', 'no']:
                    issues.append(f"Button mismatch: intent '{intent}' should produce 'Decline' or similar")
            else:
                # For other intents, check keyword relevance
                input_words = [word for word in re.findall(r'\b\w+\b', intent) if len(word) >= 3]
                if input_words:
                    word_matches = sum(1 for word in input_words if word in output_text)
                    if word_matches < 1:
                        issues.append(f"Button content drift: no keywords from intent match")
        
        elif ui_context == 'error':
            # Errors should be empathetic and helpful
            if len(test_case['output'].split()) > 15:
                issues.append(f"Error message too long: {len(test_case['output'].split())} words")
            
            # Check if error message is relevant to the intent
            input_words = [word for word in re.findall(r'\b\w+\b', intent) if len(word) >= 3]
            if input_words:
                word_matches = sum(1 for word in input_words if word in output_text)
                if word_matches < 1:
                    issues.append(f"Error content drift: no keywords from intent match")
        
        elif ui_context == 'tooltip':
            # Tooltips should be helpful and contextual
            if len(test_case['output'].split()) > 15:
                issues.append(f"Tooltip too long: {len(test_case['output'].split())} words")
            
            # Check if tooltip content is relevant to the intent
            input_words = [word for word in re.findall(r'\b\w+\b', intent) if len(word) >= 3]
            if input_words:
                word_matches = sum(1 for word in input_words if word in output_text)
                if word_matches < 1:
                    issues.append(f"Tooltip content drift: no keywords from intent match")
    
    elif test_case['content_type'] == 'internal_comms':
        channel = test_case['input'].get('channel', '').lower()
        if channel == 'slack':
            lines = test_case['output'].split('\n')
            if len(lines) > 3:
                issues.append(f"Slack too long: {len(lines)} lines")
        
        # Check content relevance for internal comms
        title = test_case['input'].get('title', '').lower()
        key_update = test_case['input'].get('key_update', '').lower()
        input_text = f"{title} {key_update}"
        output_text = test_case['output'].lower()
        
        input_words = [word for word in re.findall(r'\b\w+\b', input_text) if len(word) >= 3]
        if input_words:
            word_matches = sum(1 for word in input_words if word in output_text)
            if word_matches < 2:
                issues.append(f"Content drift: only {word_matches} keywords match")
    
    elif test_case['content_type'] == 'press_release':
        # Check content relevance for press releases
        headline = test_case['input'].get('headline', '').lower()
        key_message = test_case['input'].get('key_message', '').lower()
        input_text = f"{headline} {key_message}"
        output_text = test_case['output'].lower()
        
        input_words = [word for word in re.findall(r'\b\w+\b', input_text) if len(word) >= 3]
        if input_words:
            word_matches = sum(1 for word in input_words if word in output_text)
            if word_matches < 2:
                issues.append(f"Content drift: only {word_matches} keywords match")
    
    return issues

def main():
    """Main execution"""
    print("🚀 Fixed Test Runner - Step 3 (Improved Validation)")
    print("=" * 50)
    
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
    
    # Run validation on all cases
    print(f"\n🧪 Running validation on all cases:")
    total_issues = 0
    
    for test_case in test_cases:
        print(f"\nCase {test_case['case_number']}: {test_case['content_type']}")
        print(f"  Input: {test_case['input']}")
        print(f"  Output: {test_case['output'][:100]}{'...' if len(test_case['output']) > 100 else ''}")
        
        issues = run_validation(test_case)
        if issues:
            print(f"  ❌ Issues: {', '.join(issues)}")
            total_issues += len(issues)
        else:
            print(f"  ✅ No issues detected")
    
    print(f"\n📊 Final Summary:")
    print(f"Total test cases: {len(test_cases)}")
    print(f"Total issues found: {total_issues}")
    
    # Calculate success rate
    successful_cases = sum(1 for tc in test_cases if not run_validation(tc))
    success_rate = (successful_cases / len(test_cases)) * 100
    print(f"Success rate: {success_rate:.1f}%")
    
    # Breakdown by content type
    print(f"\n📈 Success Rate by Content Type:")
    for content_type in type_counts:
        type_cases = [tc for tc in test_cases if tc['content_type'] == content_type]
        type_successful = sum(1 for tc in type_cases if not run_validation(tc))
        type_success_rate = (type_successful / len(type_cases)) * 100
        print(f"  {content_type}: {type_success_rate:.1f}% ({type_successful}/{len(type_cases)})")

if __name__ == "__main__":
    main()
