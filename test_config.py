#!/usr/bin/env python3
"""
Configuration for Enhanced Test Runner
"""

import os

# Groq API Configuration
GROQ_API_KEY = os.getenv('GROQ_API_KEY')

# Test Configuration
DEFAULT_MODEL = 'llama-3.1-8b-instant'
API_TIMEOUT = 30
REQUEST_DELAY = 1  # seconds between test cases

# Validation Thresholds
MIN_KEYWORD_MATCHES = 2  # Minimum input words that must appear in output
MAX_BUTTON_WORDS = 5
MAX_TOOLTIP_SENTENCES = 1
MAX_SLACK_LINES = 3

# Issue Severity Levels
SEVERITY_LEVELS = {
    'content_drift': 'high',
    'channel_misalignment': 'medium', 
    'dual_channel_output': 'high',
    'format_non_compliance': 'low',
    'generic_content': 'medium'
}

# Content Type Validation Rules
VALIDATION_RULES = {
    'internal_comms': {
        'slack': {
            'max_lines': 3,
            'no_email_elements': True,
            'no_title_header': True
        },
        'email': {
            'has_title': True,
            'has_body': True,
            'min_lines': 3
        }
    },
    'press_release': {
        'min_headline_keywords': 1,
        'min_message_keywords': 1,
        'audience_specific': True
    },
    'microcopy': {
        'button': {
            'max_words': 5,
            'intent_match': True
        },
        'tooltip': {
            'max_sentences': 1,
            'helpful': True
        },
        'error': {
            'max_sentences': 1,
            'empathetic': True
        }
    }
}
