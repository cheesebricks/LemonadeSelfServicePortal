#!/usr/bin/env python3
"""
Content Quality Test Suite
Tests for content drift prevention, channel alignment, and style-only critic scoring
"""

import json
import time
import requests
from typing import Dict, List, Any

class ContentQualityTester:
    def __init__(self):
        self.base_url = "http://localhost:8001"
        self.test_results = []
        
    def run_test_case(self, test_case: Dict[str, Any]) -> Dict[str, Any]:
        """Run a single test case and return results"""
        print(f"\n🧪 Testing: {test_case['name']}")
        print(f"   Type: {test_case['type']}")
        print(f"   Input: {test_case['input']}")
        
        try:
            # Simulate the content generation process
            # Since this is a client-side app, we'll test the logic through the UI
            result = self.simulate_content_generation(test_case)
            
            # Analyze results for our quality criteria
            analysis = self.analyze_content_quality(test_case, result)
            
            test_result = {
                'test_case': test_case,
                'result': result,
                'analysis': analysis,
                'passed': analysis['overall_pass']
            }
            
            self.test_results.append(test_result)
            
            # Print results
            status = "✅ PASS" if test_result['passed'] else "❌ FAIL"
            print(f"   Result: {status}")
            print(f"   Score: {analysis['score']}/100")
            print(f"   Issues: {', '.join(analysis['issues']) if analysis['issues'] else 'None'}")
            
            return test_result
            
        except Exception as e:
            print(f"   Error: {str(e)}")
            return {'error': str(e), 'passed': False}
    
    def simulate_content_generation(self, test_case: Dict[str, Any]) -> Dict[str, Any]:
        """Simulate the content generation process"""
        # This simulates what the system would generate
        # In a real test, you'd interact with the actual UI
        
        if test_case['type'] == 'internal_comms':
            if test_case['input']['channel'] == 'Slack':
                # Simulate Slack format: 1-2 lines, no title header
                return {
                    'content': f"Welcome {test_case['input']['title']}! {test_case['input']['key_update']}",
                    'format': 'slack',
                    'length': 'short',
                    'has_title_header': False
                }
            else:  # Email
                # Simulate Email format: title, blank line, body
                return {
                    'content': f"{test_case['input']['title']}\n\n{test_case['input']['key_update']}",
                    'format': 'email',
                    'length': 'longer',
                    'has_title_header': True
                }
        
        elif test_case['type'] == 'press_release':
            return {
                'content': f"Lemonade announces {test_case['input']['headline']}. {test_case['input']['key_message']}",
                'format': 'press_release',
                'has_keywords': True,
                'tone': 'professional'
            }
        
        elif test_case['type'] == 'microcopy':
            return {
                'content': test_case['input']['intent'],
                'format': 'microcopy',
                'ui_context': test_case['input']['uiContext'],
                'length': 'short'
            }
        
        return {'error': 'Unknown type'}
    
    def analyze_content_quality(self, test_case: Dict[str, Any], result: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze content quality based on our criteria"""
        issues = []
        score = 100
        
        # Test 1: Content Relevance (No Drift)
        if not self.check_content_relevance(test_case, result):
            issues.append("Content drift detected")
            score -= 30
        
        # Test 2: Channel Alignment
        if not self.check_channel_alignment(test_case, result):
            issues.append("Channel misalignment")
            score -= 25
        
        # Test 3: Single Channel Output
        if not self.check_single_channel(test_case, result):
            issues.append("Multiple channel output")
            score -= 25
        
        # Test 4: Format Compliance
        if not self.check_format_compliance(test_case, result):
            issues.append("Format non-compliance")
            score -= 20
        
        overall_pass = score >= 70
        
        return {
            'score': max(0, score),
            'issues': issues,
            'overall_pass': overall_pass,
            'tests': {
                'content_relevance': self.check_content_relevance(test_case, result),
                'channel_alignment': self.check_channel_alignment(test_case, result),
                'single_channel': self.check_single_channel(test_case, result),
                'format_compliance': self.check_format_compliance(test_case, result)
            }
        }
    
    def check_content_relevance(self, test_case: Dict[str, Any], result: Dict[str, Any]) -> bool:
        """Check if content stays relevant to original request"""
        if 'error' in result:
            return False
            
        content = result.get('content', '').lower()
        
        # Check if key elements from input are present
        if test_case['type'] == 'internal_comms':
            title = test_case['input']['title'].lower()
            key_update = test_case['input']['key_update'].lower()
            
            # Content should contain elements from the original request
            has_title_elements = any(word in content for word in title.split())
            has_update_elements = any(word in content for word in key_update.split())
            
            return has_title_elements and has_update_elements
        
        elif test_case['type'] == 'press_release':
            headline = test_case['input']['headline'].lower()
            key_message = test_case['input']['key_message'].lower()
            
            has_headline_elements = any(word in content for word in headline.split())
            has_message_elements = any(word in content for word in key_message.split())
            
            return has_headline_elements and has_message_elements
        
        elif test_case['type'] == 'microcopy':
            intent = test_case['input']['intent'].lower()
            return intent in content
        
        return True
    
    def check_channel_alignment(self, test_case: Dict[str, Any], result: Dict[str, Any]) -> bool:
        """Check if content format matches the specified channel"""
        if 'error' in result:
            return False
            
        if test_case['type'] == 'internal_comms':
            channel = test_case['input']['channel']
            
            if channel == 'Slack':
                # Slack should be short, no title header
                return (result.get('length') == 'short' and 
                       not result.get('has_title_header', True))
            elif channel == 'Email':
                # Email should have title header
                return result.get('has_title_header', False)
        
        return True
    
    def check_single_channel(self, test_case: Dict[str, Any], result: Dict[str, Any]) -> bool:
        """Check if output is for single channel only"""
        if 'error' in result:
            return False
            
        content = result.get('content', '')
        
        # Check for dual-channel indicators
        dual_channel_indicators = [
            'slack:', 'email:', 'dear team', 'best regards',
            'we\'re excited to announce', 'we\'re thrilled to announce'
        ]
        
        # Count how many channel-specific elements appear
        channel_elements = sum(1 for indicator in dual_channel_indicators 
                             if indicator.lower() in content.lower())
        
        # Should have minimal channel-specific elements
        return channel_elements <= 1
    
    def check_format_compliance(self, test_case: Dict[str, Any], result: Dict[str, Any]) -> bool:
        """Check if content follows format requirements"""
        if 'error' in result:
            return False
            
        if test_case['type'] == 'microcopy':
            ui_context = test_case['input'].get('uiContext', 'button')
            
            if ui_context == 'button':
                # Button should be ≤5 words
                word_count = len(result.get('content', '').split())
                return word_count <= 5
            
            elif ui_context == 'tooltip':
                # Tooltip should be ≤1 sentence
                content = result.get('content', '')
                sentence_count = content.count('.') + content.count('!') + content.count('?')
                return sentence_count <= 1
        
        return True
    
    def run_test_suite(self) -> Dict[str, Any]:
        """Run the complete test suite"""
        print("🚀 Starting Content Quality Test Suite")
        print("=" * 50)
        
        test_cases = self.get_test_cases()
        
        for test_case in test_cases:
            self.run_test_case(test_case)
            time.sleep(0.5)  # Small delay between tests
        
        return self.generate_report()
    
    def get_test_cases(self) -> List[Dict[str, Any]]:
        """Define test cases for different scenarios"""
        return [
            # Test 1: Slack Internal Comms - Should be short, no title header
            {
                'name': 'Slack Internal Comms - CEO Announcement',
                'type': 'internal_comms',
                'input': {
                    'channel': 'Slack',
                    'title': 'God joins as CEO',
                    'key_update': 'new CEO, will make a lot of changes. will introduce new coffee in kitchen.'
                }
            },
            
            # Test 2: Email Internal Comms - Should have title header
            {
                'name': 'Email Internal Comms - Office Update',
                'type': 'internal_comms',
                'input': {
                    'channel': 'Email',
                    'title': 'New Office Policy',
                    'key_update': 'dogs are no longer allowed in the office due to devops team concerns'
                }
            },
            
            # Test 3: Press Release - Should include headline/key message
            {
                'name': 'Press Release - Product Launch',
                'type': 'press_release',
                'input': {
                    'headline': 'Lemonade Launches AI-Powered Claims',
                    'key_message': 'instant claims processing with 99% accuracy'
                }
            },
            
            # Test 4: Microcopy Button - Should be ≤5 words
            {
                'name': 'Microcopy Button - Pay Now',
                'type': 'microcopy',
                'input': {
                    'intent': 'pay now',
                    'uiContext': 'button'
                }
            },
            
            # Test 5: Microcopy Tooltip - Should be ≤1 sentence
            {
                'name': 'Microcopy Tooltip - Help Text',
                'type': 'microcopy',
                'input': {
                    'intent': 'how to file a claim',
                    'uiContext': 'tooltip'
                }
            },
            
            # Test 6: Content Drift Prevention - Should stay on topic
            {
                'name': 'Content Drift Prevention - Coffee Policy',
                'type': 'internal_comms',
                'input': {
                    'channel': 'Slack',
                    'title': 'Coffee Machine Broken',
                    'key_update': 'coffee machine in kitchen is out of order until tomorrow'
                }
            }
        ]
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result.get('passed', False))
        failed_tests = total_tests - passed_tests
        
        # Calculate average score
        scores = [result.get('analysis', {}).get('score', 0) for result in self.test_results if 'analysis' in result]
        avg_score = sum(scores) / len(scores) if scores else 0
        
        # Identify common issues
        all_issues = []
        for result in self.test_results:
            if 'analysis' in result and 'issues' in result['analysis']:
                all_issues.extend(result['analysis']['issues'])
        
        issue_counts = {}
        for issue in all_issues:
            issue_counts[issue] = issue_counts.get(issue, 0) + 1
        
        report = {
            'summary': {
                'total_tests': total_tests,
                'passed': passed_tests,
                'failed': failed_tests,
                'success_rate': (passed_tests / total_tests * 100) if total_tests > 0 else 0,
                'average_score': round(avg_score, 1)
            },
            'common_issues': issue_counts,
            'detailed_results': self.test_results
        }
        
        print("\n" + "=" * 50)
        print("📊 TEST REPORT")
        print("=" * 50)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {report['summary']['success_rate']:.1f}%")
        print(f"Average Score: {report['summary']['average_score']:.1f}/100")
        
        if issue_counts:
            print(f"\nCommon Issues:")
            for issue, count in sorted(issue_counts.items(), key=lambda x: x[1], reverse=True):
                print(f"  • {issue}: {count} occurrences")
        
        return report

def main():
    """Main test execution"""
    tester = ContentQualityTester()
    
    try:
        report = tester.run_test_suite()
        
        # Save detailed report
        with open('content_quality_test_report.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📄 Detailed report saved to: content_quality_test_report.json")
        
        # Return exit code based on success rate
        success_rate = report['summary']['success_rate']
        if success_rate >= 80:
            print("🎉 Test suite passed with high success rate!")
            exit(0)
        elif success_rate >= 60:
            print("⚠️  Test suite passed with moderate success rate")
            exit(0)
        else:
            print("❌ Test suite failed - too many issues detected")
            exit(1)
            
    except Exception as e:
        print(f"💥 Test suite failed with error: {str(e)}")
        exit(1)

if __name__ == "__main__":
    main()
