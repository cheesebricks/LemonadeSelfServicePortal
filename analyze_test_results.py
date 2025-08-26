#!/usr/bin/env python3
"""
Test Results Analyzer - Lemonade Self-Service Portal

This script analyzes the browser test results and extracts detailed information
about requests, references, prompts, and results into a readable format.

Usage:
    python analyze_test_results.py [results_file]
"""

import json
import sys
import os
from datetime import datetime

def extract_prompt_from_logs(logs):
    """Extract the actual prompt sent to the LLM from the logs."""
    system_prompt = ""
    user_prompt = ""
    in_system = False
    in_user = False
    
    for log in logs:
        if "🔎 Prompt #1 — SYSTEM" in log:
            in_system = True
            in_user = False
            continue
        elif "🔎 Prompt #1 — USER" in log:
            in_system = False
            in_user = True
            continue
        elif in_system and ("🔎 Prompt #1 — USER" in log or "🧠 Generating" in log or "✅ Model" in log):
            in_system = False
        elif in_user and ("🧠 Generating" in log or "✅ Model" in log):
            in_user = False
        elif in_system:
            system_prompt += log + "\n"
        elif in_user:
            user_prompt += log + "\n"
    
    if system_prompt or user_prompt:
        return f"SYSTEM PROMPT:\n{system_prompt.strip()}\n\nUSER PROMPT:\n{user_prompt.strip()}"
    else:
        return "No prompt found in logs"

def extract_references_from_logs(logs):
    """Extract the selected corpus references from the logs."""
    refs = []
    for log in logs:
        if "📎 Refs selected:" in log:
            # Extract reference lines
            lines = log.split('\n')
            for line in lines:
                if '•' in line and '—' in line:
                    refs.append(line.strip())
    return refs

def extract_result_from_report(report):
    """Extract the final result from the report."""
    if not report or not report.get('ok'):
        return report.get('error', 'No result available')
    
    return report.get('result', 'No result in report')

def extract_scoring_from_report(report):
    """Extract scoring information from the report."""
    if not report or not report.get('scoring'):
        return "No scoring available"
    
    scoring = report['scoring']
    return {
        'trs': scoring.get('trs', 'N/A'),
        'verdict': scoring.get('verdict', 'N/A'),
        'breakdown': scoring.get('breakdown', {})
    }

def format_test_case(case_data, index):
    """Format a single test case into readable text."""
    output = []
    output.append(f"{'='*80}")
    output.append(f"TEST CASE #{index + 1}")
    output.append(f"{'='*80}")
    
    # Basic info
    output.append(f"Type: {case_data['type']}")
    output.append(f"Parameters: {json.dumps(case_data['params'], indent=2)}")
    output.append(f"Duration: {case_data['duration_ms']}ms")
    output.append(f"Success: {case_data['ok']}")
    output.append("")
    
    # References
    refs = extract_references_from_logs(case_data.get('console_tail', []))
    if refs:
        output.append("SELECTED REFERENCES:")
        for ref in refs:
            output.append(f"  {ref}")
        output.append("")
    
    # Prompt
    prompt = extract_prompt_from_logs(case_data.get('console_tail', []))
    if prompt:
        output.append("PROMPT SENT TO LLM:")
        output.append("-" * 40)
        output.append(prompt)
        output.append("")
    
    # Result
    result = extract_result_from_report(case_data.get('report', {}))
    output.append("GENERATED RESULT:")
    output.append("-" * 40)
    output.append(result)
    output.append("")
    
    # Scoring
    scoring = extract_scoring_from_report(case_data.get('report', {}))
    if isinstance(scoring, dict):
        output.append("SCORING:")
        output.append("-" * 40)
        output.append(f"TRS Score: {scoring['trs']}")
        output.append(f"Verdict: {scoring['verdict']}")
        if scoring.get('breakdown'):
            breakdown = scoring['breakdown']
            output.append(f"Rules: {breakdown.get('rules', {}).get('score', 'N/A')}/40")
            output.append(f"Lexicon: {breakdown.get('lexicon', {}).get('score', 'N/A')}/20")
            output.append(f"Critic: {breakdown.get('critic', {}).get('score', 'N/A')}/40")
    else:
        output.append(f"SCORING: {scoring}")
    
    output.append("")
    output.append("")
    return "\n".join(output)

def analyze_results(results_file):
    """Analyze the test results file and create a detailed report."""
    if not os.path.exists(results_file):
        print(f"Error: Results file '{results_file}' not found.")
        return
    
    # Read the results
    cases = []
    with open(results_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                cases.append(json.loads(line))
    
    print(f"Analyzing {len(cases)} test cases from {results_file}")
    
    # Create detailed report
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"detailed_test_analysis_{timestamp}.txt"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("DETAILED TEST RESULTS ANALYSIS\n")
        f.write("=" * 80 + "\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Total Cases: {len(cases)}\n")
        f.write("=" * 80 + "\n\n")
        
        # Summary statistics
        f.write("SUMMARY STATISTICS\n")
        f.write("-" * 40 + "\n")
        
        by_type = {}
        success_count = 0
        total_trs = 0
        trs_count = 0
        
        for case in cases:
            case_type = case['type']
            if case_type not in by_type:
                by_type[case_type] = {'total': 0, 'success': 0, 'trs_sum': 0, 'trs_count': 0}
            
            by_type[case_type]['total'] += 1
            if case['ok']:
                success_count += 1
                by_type[case_type]['success'] += 1
            
            # Extract TRS score
            if case.get('report', {}).get('scoring', {}).get('trs'):
                trs = case['report']['scoring']['trs']
                if isinstance(trs, (int, float)):
                    total_trs += trs
                    trs_count += 1
                    by_type[case_type]['trs_sum'] += trs
                    by_type[case_type]['trs_count'] += 1
        
        f.write(f"Overall Success Rate: {success_count}/{len(cases)} ({success_count/len(cases)*100:.1f}%)\n")
        if trs_count > 0:
            f.write(f"Average TRS Score: {total_trs/trs_count:.2f}\n")
        f.write("\n")
        
        for case_type, stats in by_type.items():
            success_rate = stats['success']/stats['total']*100 if stats['total'] > 0 else 0
            avg_trs = stats['trs_sum']/stats['trs_count'] if stats['trs_count'] > 0 else 0
            f.write(f"{case_type.upper()}:\n")
            f.write(f"  Cases: {stats['total']}\n")
            f.write(f"  Success: {stats['success']}/{stats['total']} ({success_rate:.1f}%)\n")
            f.write(f"  Avg TRS: {avg_trs:.2f}\n")
            f.write("\n")
        
        f.write("=" * 80 + "\n\n")
        
        # Detailed case analysis
        f.write("DETAILED CASE ANALYSIS\n")
        f.write("=" * 80 + "\n\n")
        
        for i, case in enumerate(cases):
            case_text = format_test_case(case, i)
            f.write(case_text)
    
    print(f"Detailed analysis saved to: {output_file}")
    print(f"Total cases analyzed: {len(cases)}")
    
    # Also create a summary file
    summary_file = f"test_summary_{timestamp}.json"
    summary = {
        'generated_at': datetime.now().isoformat(),
        'total_cases': len(cases),
        'success_rate': success_count/len(cases) if cases else 0,
        'average_trs': total_trs/trs_count if trs_count > 0 else 0,
        'by_type': by_type,
        'cases': []
    }
    
    for case in cases:
        summary['cases'].append({
            'type': case['type'],
            'params': case['params'],
            'success': case['ok'],
            'duration_ms': case['duration_ms'],
            'trs': case.get('report', {}).get('scoring', {}).get('trs'),
            'verdict': case.get('report', {}).get('scoring', {}).get('verdict'),
            'result': extract_result_from_report(case.get('report', {}))
        })
    
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(f"Summary saved to: {summary_file}")

def main():
    if len(sys.argv) > 1:
        results_file = sys.argv[1]
    else:
        # Look for the most recent results file
        results_files = [f for f in os.listdir('.') if f.startswith('baseline_test_') and f.endswith('.jsonl')]
        if not results_files:
            print("No results files found. Please specify a results file:")
            print("python analyze_test_results.py <results_file>")
            return
        
        # Get the most recent file
        results_files.sort(reverse=True)
        results_file = results_files[0]
        print(f"Using most recent results file: {results_file}")
    
    analyze_results(results_file)

if __name__ == "__main__":
    main()
