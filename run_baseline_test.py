#!/usr/bin/env python3
"""
Performance baseline test runner for Lemonade Self-Service Portal

This script runs a quick baseline test using the browser_runner.py to establish
performance metrics for the content generation pipeline.

Usage:
    python run_baseline_test.py

Requirements:
    pip install playwright
    python -m playwright install chromium
"""

import subprocess
import sys
import os
from datetime import datetime

def main():
    print("🚀 Lemonade Self-Service Portal - Performance Baseline Test")
    print("=" * 60)
    
    # Check if playwright is installed
    try:
        import playwright
        print("✅ Playwright is installed")
    except ImportError:
        print("❌ Playwright not found. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "playwright"], check=True)
        print("✅ Playwright installed")
    
    # Check if browser is installed
    try:
        subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], 
                      capture_output=True, check=True)
        print("✅ Chromium browser is available")
    except subprocess.CalledProcessError:
        print("❌ Installing Chromium browser...")
        subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
        print("✅ Chromium browser installed")
    
    # Create output directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = f"baseline_test_{timestamp}"
    os.makedirs(out_dir, exist_ok=True)
    
    print(f"\n📊 Running baseline test...")
    print(f"📁 Results will be saved to: {out_dir}")
    
    # Run the browser test with conservative settings
    cmd = [
        sys.executable, "browser_runner.py",
        "--url", "http://localhost:8001/index.html",
        "--include", "microcopy,internal_comms,press_release",
        "--replicates", "1",
        "--batch_size", "6",
        "--batch_pause_ms", "30000",
        "--delay_ms", "2000",
        "--jitter_ms", "500",
        "--out_dir", out_dir,
        "--tag", "baseline",
        "--headful",  # Show browser for debugging
        "--no_console"  # Reduce noise
    ]
    
    print(f"\n🔧 Command: {' '.join(cmd)}")
    print("\n" + "=" * 60)
    
    try:
        result = subprocess.run(cmd, check=True)
        print("\n" + "=" * 60)
        print("✅ Baseline test completed successfully!")
        print(f"📁 Check results in: {out_dir}")
        
        # Show summary if available
        summary_file = os.path.join(out_dir, f"summary_{timestamp}_baseline.json")
        if os.path.exists(summary_file):
            import json
            with open(summary_file, 'r') as f:
                summary = json.load(f)
            
            print(f"\n📈 Performance Summary:")
            print(f"   Total runs: {summary.get('total_runs', 0)}")
            print(f"   Pass rate: {summary.get('pass', 0)}/{summary.get('total_runs', 0)}")
            print(f"   Average TRS: {summary.get('avg_trs', 0)}")
            print(f"   Average duration: {summary.get('avg_duration_ms', 0)}ms")
            print(f"   429 errors: {summary.get('429s', 0)}")
            
            # Show breakdown by type
            print(f"\n📊 By Content Type:")
            for content_type, stats in summary.get('by_type', {}).items():
                total = stats.get('count', 0)
                pass_count = stats.get('pass', 0)
                pass_rate = (pass_count / total * 100) if total > 0 else 0
                print(f"   {content_type}: {pass_count}/{total} ({pass_rate:.1f}% pass)")
        
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Test failed with exit code: {e.returncode}")
        return 1
    except KeyboardInterrupt:
        print(f"\n⏹️ Test interrupted by user")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
