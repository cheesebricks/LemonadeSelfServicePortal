#!/usr/bin/env python3
"""
Baseline Test Runner - Lemonade Self-Service Portal

This script runs the browser tests with predefined baseline settings and
automatically generates detailed analysis reports.

Usage:
    python run_baseline_test.py
"""

import subprocess
import sys
import os
import json
from datetime import datetime

def install_playwright():
    """Install Playwright and Chromium if not already installed."""
    print("🔧 Installing Playwright...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "playwright"], 
                      check=True, capture_output=True)
        print("✅ Playwright installed successfully")
        
        print("🔧 Installing Chromium browser...")
        subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], 
                      check=True, capture_output=True)
        print("✅ Chromium installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error installing Playwright: {e}")
        return False
    return True

def run_baseline_test():
    """Run the baseline test with predefined settings."""
    print("🚀 Starting baseline test...")
    
    # Create output directory with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = f"baseline_test_{timestamp}"
    
    # Run the browser test
    cmd = [
        sys.executable, "browser_runner.py",
        "--url", "http://localhost:8001/index.html",
        "--batch-size", "11",
        "--delay-between-cases", "2",
        "--delay-between-batches", "20",
        "--output-dir", output_dir,
        "--verbose"
    ]
    
    print(f"📋 Running command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print("✅ Baseline test completed successfully")
        return output_dir
    except subprocess.CalledProcessError as e:
        print(f"❌ Test failed: {e}")
        print(f"STDOUT: {e.stdout}")
        print(f"STDERR: {e.stderr}")
        return None

def run_analysis(results_file):
    """Run the analysis script on the test results."""
    print("📊 Generating detailed analysis...")
    
    try:
        result = subprocess.run([
            sys.executable, "analyze_test_results.py", results_file
        ], check=True, capture_output=True, text=True)
        
        print("✅ Analysis completed successfully")
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Analysis failed: {e}")
        print(f"STDOUT: {e.stdout}")
        print(f"STDERR: {e.stderr}")
        return False

def print_summary(output_dir):
    """Print a summary of the test results."""
    print("\n" + "="*60)
    print("📋 TEST SUMMARY")
    print("="*60)
    
    # Find the results file
    results_file = None
    for file in os.listdir(output_dir):
        if file.endswith('.jsonl'):
            results_file = os.path.join(output_dir, file)
            break
    
    if not results_file:
        print("❌ No results file found")
        return
    
    # Count test cases
    case_count = 0
    success_count = 0
    total_trs = 0
    trs_count = 0
    
    with open(results_file, 'r') as f:
        for line in f:
            if line.strip():
                case = json.loads(line)
                case_count += 1
                if case.get('ok'):
                    success_count += 1
                
                # Extract TRS score
                trs = case.get('report', {}).get('scoring', {}).get('trs')
                if isinstance(trs, (int, float)):
                    total_trs += trs
                    trs_count += 1
    
    print(f"📁 Results directory: {output_dir}")
    print(f"📊 Total test cases: {case_count}")
    print(f"✅ Successful cases: {success_count}")
    print(f"❌ Failed cases: {case_count - success_count}")
    print(f"📈 Success rate: {(success_count/case_count*100):.1f}%" if case_count > 0 else "N/A")
    
    if trs_count > 0:
        avg_trs = total_trs / trs_count
        print(f"🎯 Average TRS score: {avg_trs:.2f}")
    
    # List generated files
    print("\n📄 Generated files:")
    for file in os.listdir(output_dir):
        file_path = os.path.join(output_dir, file)
        if os.path.isfile(file_path):
            size = os.path.getsize(file_path)
            print(f"  - {file} ({size} bytes)")
    
    # Check for analysis files
    analysis_files = [f for f in os.listdir('.') if f.startswith('detailed_test_analysis_') and f.endswith('.txt')]
    if analysis_files:
        latest_analysis = max(analysis_files)
        size = os.path.getsize(latest_analysis)
        print(f"  - {latest_analysis} ({size} bytes)")
    
    summary_files = [f for f in os.listdir('.') if f.startswith('test_summary_') and f.endswith('.json')]
    if summary_files:
        latest_summary = max(summary_files)
        size = os.path.getsize(latest_summary)
        print(f"  - {latest_summary} ({size} bytes)")

def main():
    """Main function to run the complete baseline test workflow."""
    print("🎯 Lemonade Self-Service Portal - Baseline Test Runner")
    print("="*60)
    
    # Check if server is running
    print("🔍 Checking if server is running on localhost:8001...")
    try:
        import urllib.request
        urllib.request.urlopen("http://localhost:8001", timeout=5)
        print("✅ Server is running")
    except:
        print("❌ Server is not running on localhost:8001")
        print("Please start the server with: python3 -m http.server 8001")
        return
    
    # Install Playwright if needed
    if not install_playwright():
        return
    
    # Run the baseline test
    output_dir = run_baseline_test()
    if not output_dir:
        return
    
    # Find the results file
    results_file = None
    for file in os.listdir(output_dir):
        if file.endswith('.jsonl'):
            results_file = os.path.join(output_dir, file)
            break
    
    if not results_file:
        print("❌ No results file found for analysis")
        return
    
    # Run analysis
    if run_analysis(results_file):
        print("\n🎉 Complete! Test results and detailed analysis generated.")
    else:
        print("\n⚠️  Tests completed but analysis failed.")
    
    # Print summary
    print_summary(output_dir)
    
    print("\n📖 Next steps:")
    print("  - Review the detailed analysis file for insights")
    print("  - Check the test summary JSON for programmatic analysis")
    print("  - Examine individual test cases in the results directory")

if __name__ == "__main__":
    main()
