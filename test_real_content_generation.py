#!/usr/bin/env python3
"""
Real Content Generation Test Suite
Tests the actual running application for content drift, channel alignment, and quality
"""

import json
import time
import requests
from typing import Dict, List, Any
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select

class RealContentTester:
    def __init__(self):
        self.base_url = "http://localhost:8001"
        self.driver = None
        self.test_results = []
        
    def setup_driver(self):
        """Setup Chrome driver for testing"""
        try:
            options = webdriver.ChromeOptions()
            options.add_argument('--headless')  # Run in background
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            
            self.driver = webdriver.Chrome(options=options)
            self.driver.get(self.base_url)
            
            # Wait for page to load
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.ID, "content-type-selector"))
            )
            
            print("✅ Browser setup complete")
            return True
            
        except Exception as e:
            print(f"❌ Browser setup failed: {str(e)}")
            return False
    
    def teardown_driver(self):
        """Clean up browser driver"""
        if self.driver:
            self.driver.quit()
    
    def run_test_case(self, test_case: Dict[str, Any]) -> Dict[str, Any]:
        """Run a single test case using the actual UI"""
        print(f"\n🧪 Testing: {test_case['name']}")
        print(f"   Type: {test_case['type']}")
        print(f"   Input: {test_case['input']}")
        
        try:
            # Navigate to the correct content type
            self.select_content_type(test_case['type'])
            
            # Fill in the form based on content type
            self.fill_form(test_case['type'], test_case['input'])
            
            # Generate content
            content = self.generate_content()
            
            # Analyze the generated content
            analysis = self.analyze_real_content(test_case, content)
            
            test_result = {
                'test_case': test_case,
                'generated_content': content,
                'analysis': analysis,
                'passed': analysis['overall_pass']
            }
            
            self.test_results.append(test_result)
            
            # Print results
            status = "✅ PASS" if test_result['passed'] else "❌ FAIL"
            print(f"   Result: {status}")
            print(f"   Score: {analysis['score']}/100")
            print(f"   Issues: {', '.join(analysis['issues']) if analysis['issues'] else 'None'}")
            print(f"   Generated: {content[:100]}...")
            
            return test_result
            
        except Exception as e:
            print(f"   Error: {str(e)}")
            return {'error': str(e), 'passed': False}
    
    def select_content_type(self, content_type: str):
        """Select the content type in the UI"""
        try:
            selector = Select(self.driver.find_element(By.ID, "content-type-selector"))
            
            if content_type == 'internal_comms':
                selector.select_by_value('internal_comms')
            elif content_type == 'press_release':
                selector.select_by_value('press_release')
            elif content_type == 'microcopy':
                selector.select_by_value('microcopy')
            
            time.sleep(1)  # Wait for form to update
            
        except Exception as e:
            print(f"Warning: Could not select content type: {str(e)}")
    
    def fill_form(self, content_type: str, input_data: Dict[str, Any]):
        """Fill in the form fields based on content type"""
        try:
            if content_type == 'internal_comms':
                # Fill channel selector
                channel_selector = Select(self.driver.find_element(By.ID, "channel-selector"))
                channel_selector.select_by_value(input_data['channel'].lower())
                
                # Fill title
                title_field = self.driver.find_element(By.ID, "title-input")
                title_field.clear()
                title_field.send_keys(input_data['title'])
                
                # Fill key update
                key_update_field = self.driver.find_element(By.ID, "key-update-input")
                key_update_field.clear()
                key_update_field.send_keys(input_data['key_update'])
                
            elif content_type == 'press_release':
                # Fill audience selector
                audience_selector = Select(self.driver.find_element(By.ID, "audience-selector"))
                audience_selector.select_by_value(input_data.get('audience', 'press'))
                
                # Fill headline
                headline_field = self.driver.find_element(By.ID, "headline-input")
                headline_field.clear()
                headline_field.send_keys(input_data['headline'])
                
                # Fill key message
                key_message_field = self.driver.find_element(By.ID, "key-message-input")
                key_message_field.clear()
                key_message_field.send_keys(input_data['key_message'])
                
            elif content_type == 'microcopy':
                # Fill UI context selector
                ui_context_selector = Select(self.driver.find_element(By.ID, "ui-context-selector"))
                ui_context_selector.select_by_value(input_data['uiContext'])
                
                # Fill intent
                intent_field = self.driver.find_element(By.ID, "intent-input")
                intent_field.clear()
                intent_field.send_keys(input_data['intent'])
            
            time.sleep(0.5)  # Wait for form to update
            
        except Exception as e:
            print(f"Warning: Could not fill form: {str(e)}")
    
    def generate_content(self) -> str:
        """Click generate button and wait for content"""
        try:
            # Click generate button
            generate_btn = self.driver.find_element(By.ID, "generate-button")
            generate_btn.click()
            
            # Wait for content to appear
            WebDriverWait(self.driver, 30).until(
                EC.presence_of_element_located((By.ID, "generated-content"))
            )
            
            # Get the generated content
            content_element = self.driver.find_element(By.ID, "generated-content")
            content = content_element.text.strip()
            
            return content
            
        except Exception as e:
            print(f"Warning: Could not generate content: {str(e)}")
            return "Error generating content"
    
    def analyze_real_content(self, test_case: Dict[str, Any], content: str) -> Dict[str, Any]:
        """Analyze the real generated content for quality issues"""
        issues = []
        score = 100
        
        # Test 1: Content Relevance (No Drift)
        if not self.check_real_content_relevance(test_case, content):
            issues.append("Content drift detected")
            score -= 30
        
        # Test 2: Channel Alignment
        if not self.check_real_channel_alignment(test_case, content):
            issues.append("Channel misalignment")
            score -= 25
        
        # Test 3: Single Channel Output
        if not self.check_real_single_channel(test_case, content):
            issues.append("Multiple channel output")
            score -= 25
        
        # Test 4: Format Compliance
        if not self.check_real_format_compliance(test_case, content):
            issues.append("Format non-compliance")
            score -= 20
        
        overall_pass = score >= 70
        
        return {
            'score': max(0, score),
            'issues': issues,
            'overall_pass': overall_pass,
            'tests': {
                'content_relevance': self.check_real_content_relevance(test_case, content),
                'channel_alignment': self.check_real_channel_alignment(test_case, content),
                'single_channel': self.check_real_single_channel(test_case, content),
                'format_compliance': self.check_real_format_compliance(test_case, content)
            }
        }
    
    def check_real_content_relevance(self, test_case: Dict[str, Any], content: str) -> bool:
        """Check if real content stays relevant to original request"""
        content_lower = content.lower()
        
        if test_case['type'] == 'internal_comms':
            title = test_case['input']['title'].lower()
            key_update = test_case['input']['key_update'].lower()
            
            # Check for key elements from the original request
            title_words = [word for word in title.split() if len(word) > 2]
            update_words = [word for word in key_update.split() if len(word) > 2]
            
            title_matches = sum(1 for word in title_words if word in content_lower)
            update_matches = sum(1 for word in update_words if word in content_lower)
            
            # Should have at least some matches from both title and update
            return title_matches >= 1 and update_matches >= 2
        
        elif test_case['type'] == 'press_release':
            headline = test_case['input']['headline'].lower()
            key_message = test_case['input']['key_message'].lower()
            
            headline_words = [word for word in headline.split() if len(word) > 2]
            message_words = [word for word in key_message.split() if len(word) > 2]
            
            headline_matches = sum(1 for word in headline_words if word in content_lower)
            message_matches = sum(1 for word in message_words if word in content_lower)
            
            return headline_matches >= 1 and message_matches >= 1
        
        elif test_case['type'] == 'microcopy':
            intent = test_case['input']['intent'].lower()
            intent_words = [word for word in intent.split() if len(word) > 2]
            
            intent_matches = sum(1 for word in intent_words if word in content_lower)
            return intent_matches >= 1
        
        return True
    
    def check_real_channel_alignment(self, test_case: Dict[str, Any], content: str) -> bool:
        """Check if real content format matches the specified channel"""
        if test_case['type'] == 'internal_comms':
            channel = test_case['input']['channel']
            
            if channel == 'Slack':
                # Slack should be short (1-2 lines), no formal email elements
                lines = content.split('\n')
                has_email_elements = any([
                    'dear' in content.lower(),
                    'best regards' in content.lower(),
                    'sincerely' in content.lower(),
                    len(lines) > 3  # More than 3 lines suggests email format
                ])
                
                return not has_email_elements and len(lines) <= 3
                
            elif channel == 'Email':
                # Email should have title and body structure
                lines = content.split('\n')
                has_title = len(lines) >= 2 and lines[0].strip()  # First line should be title
                has_body = len(lines) >= 3  # Should have title + blank + body
                
                return has_title and has_body
        
        return True
    
    def check_real_single_channel(self, test_case: Dict[str, Any], content: str) -> bool:
        """Check if real output is for single channel only"""
        content_lower = content.lower()
        
        # Check for dual-channel indicators
        dual_channel_indicators = [
            'slack:', 'email:', 'dear team', 'best regards', 'sincerely',
            'we\'re excited to announce', 'we\'re thrilled to announce',
            'we are excited to announce', 'we are thrilled to announce'
        ]
        
        # Count how many channel-specific elements appear
        channel_elements = sum(1 for indicator in dual_channel_indicators 
                             if indicator in content_lower)
        
        # Should have minimal channel-specific elements
        return channel_elements <= 1
    
    def check_real_format_compliance(self, test_case: Dict[str, Any], content: str) -> bool:
        """Check if real content follows format requirements"""
        if test_case['type'] == 'microcopy':
            ui_context = test_case['input'].get('uiContext', 'button')
            
            if ui_context == 'button':
                # Button should be ≤5 words
                word_count = len(content.split())
                return word_count <= 5
            
            elif ui_context == 'tooltip':
                # Tooltip should be ≤1 sentence
                sentence_count = content.count('.') + content.count('!') + content.count('?')
                return sentence_count <= 1
        
        return True
    
    def run_test_suite(self) -> Dict[str, Any]:
        """Run the complete test suite"""
        print("🚀 Starting Real Content Generation Test Suite")
        print("=" * 60)
        
        if not self.setup_driver():
            print("❌ Cannot proceed without browser setup")
            return {'error': 'Browser setup failed'}
        
        try:
            test_cases = self.get_test_cases()
            
            for test_case in test_cases:
                self.run_test_case(test_case)
                time.sleep(2)  # Delay between tests
            
            return self.generate_report()
            
        finally:
            self.teardown_driver()
    
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
        
        print("\n" + "=" * 60)
        print("📊 REAL CONTENT GENERATION TEST REPORT")
        print("=" * 60)
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
    tester = RealContentTester()
    
    try:
        report = tester.run_test_suite()
        
        if 'error' in report:
            print(f"❌ Test suite failed: {report['error']}")
            exit(1)
        
        # Save detailed report
        with open('real_content_test_report.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📄 Detailed report saved to: real_content_test_report.json")
        
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
