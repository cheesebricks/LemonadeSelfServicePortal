# Data Flow Diagram: User Request to Output Generation

## System Overview

This diagram shows the complete data flow from when a user submits a content generation request until they receive the final output.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Input    │    │   UI Layer      │    │   Main.js       │
│                 │    │                 │    │                 │
│ • Content Type  │───▶│ • Form Validation│───▶│ • Event Handler │
│ • Parameters    │    │ • Parameter     │    │ • Log Streaming │
│ • Generate      │    │   Collection    │    │ • Result Display│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Orchestrator  │    │   Policy.js     │    │   Corpus.js     │
│                 │    │                 │    │                 │
│ • Pipeline      │◀───│ • Content       │◀───│ • Reference     │
│   Orchestration │    │   Policies      │    │   Selection     │
│ • Parameter     │    │ • Requirements  │    │ • JSON Loading  │
│   Normalization │    │ • Tone Traits   │    │ • Matching      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Prompts.js    │    │   LLM Client    │    │   Guardrail.js  │
│                 │    │                 │    │                 │
│ • System Prompt │───▶│ • OpenAI API    │───▶│ • TRS Scoring   │
│ • User Prompt   │    │   Call          │    │ • Rules Check   │
│ • Context       │    │ • Response      │    │ • Lexicon Check │
│   Requirements  │    │   Processing    │    │ • Critic Score  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Util.js       │    │   Feedback DB   │    │   KPI Tracking  │
│                 │    │                 │    │                 │
│ • Output        │───▶│ • Run Storage   │───▶│ • Performance   │
│   Shaping       │    │ • Feedback      │    │   Metrics       │
│ • Text          │    │   Collection    │    │ • Success Rates │
│   Sanitization  │    │ • CSV Export    │    │ • TRS Trends    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Detailed Step-by-Step Flow

### 1. User Input Phase
```
User fills form → UI validation → Parameter collection
```
- User selects content type (microcopy, press_release, internal_comms)
- User fills required parameters (intent, audience, channel, etc.)
- UI validates required fields and format
- Form data is collected and structured

### 2. Request Processing Phase
```
Main.js → Orchestrator → Policy loading → Corpus selection
```
- **Main.js**: Receives form submission, clears previous results, shows loading
- **Orchestrator**: Initializes pipeline, normalizes parameters
- **Policy.js**: Loads content-specific policies, requirements, and tone traits
- **Corpus.js**: Selects relevant reference examples based on content type and parameters

### 3. Prompt Generation Phase
```
Policy + Corpus → Prompts.js → LLM Client
```
- **Prompts.js**: Constructs system and user prompts using:
  - Content type requirements
  - Selected corpus references
  - User parameters
  - Tone traits
  - Lexicon preferences/bans
- **LLM Client**: Sends formatted prompt to OpenAI API

### 4. Content Generation Phase
```
OpenAI API → Response processing → Output shaping
```
- **OpenAI API**: Generates content based on prompt
- **LLM Client**: Processes raw API response
- **Util.js**: Shapes and sanitizes output:
  - Removes scaffolding/prefaces
  - Applies context-specific formatting
  - Enforces length limits
  - Cleans up punctuation

### 5. Quality Assessment Phase
```
Generated content → Guardrail.js → TRS Scoring
```
- **Guardrail.js**: Performs TRS (Tone, Relevance, Style) scoring:
  - **Rules Score**: Checks format, length, requirements (40 points)
  - **Lexicon Score**: Evaluates preferred/banned words (20 points)
  - **Critic Score**: AI-powered quality assessment (40 points)
- Total TRS score calculated (0-100)
- Verdict assigned: pass (≥80), borderline (≥72), fail (<72)

### 6. Result Delivery Phase
```
Scored content → UI display → Feedback collection
```
- **Main.js**: Displays generated content and TRS score
- **UI**: Shows result with Like/Yikes feedback buttons
- **Feedback DB**: Stores run data and user feedback
- **KPI Tracking**: Updates performance metrics

### 7. Enhanced Retry & Improvement System
```
FAIL/BORDERLINE → Smart Feedback → LLM Revision → Best Result Selection
```
- **Retry Triggers**: FAIL (<72) OR BORDERLINE (72-79) verdicts
- **Smart Feedback Analysis**: 
  - Rules Score Issues: Content-specific format guidance
  - Lexicon Score Issues: Brand word usage feedback  
  - Critic Score Issues: Context-aware quality improvements
- **Stop Conditions**: PASS achieved OR 6 attempts OR 5-second timeout
- **Best Result Tracking**: Always returns highest TRS score across all attempts
- **Iterative Improvement**: Uses targeted feedback to guide LLM revisions

## Data Storage and Persistence

### Local Storage
- **Browser Storage**: User preferences, recent runs, feedback
- **Session Data**: Current run state, temporary results

### File System (Development)
- **Test Results**: JSON files with detailed run data
- **Analysis Reports**: Human-readable test summaries
- **Feedback Export**: CSV files for analysis

## Key Components Interaction

### Policy System
- Defines content type requirements
- Specifies tone traits (witty, empathetic, clear)
- Sets TRS thresholds
- Configures lexicon preferences

### Corpus System
- Loads reference examples from JSON files
- Matches examples based on content type and parameters
- Provides style guidance without content copying

### Guardrail System
- Ensures content quality and brand compliance
- Provides detailed scoring breakdown
- Enables automatic retry logic
- Maintains consistent evaluation standards

## Performance Metrics

### Timing
- **Total Generation Time**: 1.5-3 seconds average
- **API Call Time**: 0.5-1.5 seconds
- **Processing Time**: 0.1-0.5 seconds

### Quality Metrics
- **TRS Pass Rate**: 90-95% across content types
- **User Satisfaction**: Tracked via Like/Yikes feedback
- **Retry Rate**: 15-25% for FAIL/BORDERLINE cases
- **Improvement Success**: 80-90% of retries show TRS score improvement

## Error Handling

### API Failures
- Automatic retry with exponential backoff
- Fallback to cached responses
- User notification of issues

### Validation Errors
- Real-time form validation
- Clear error messages
- Parameter normalization

### Content Issues
- TRS scoring identifies quality problems
- Automatic retry for low-scoring content
- Manual feedback collection for improvement
