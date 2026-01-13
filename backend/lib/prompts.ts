// =============================================================================
// System Prompts for Communication Analysis
// =============================================================================

const BASE_INSTRUCTIONS = `You are a communication analysis expert specializing in interpersonal dynamics, emotional intelligence, and professional communication.

CRITICAL RULES:
1. Respond with ONLY valid JSON - no explanations, no markdown, no prefixes
2. Base analysis STRICTLY on the provided message text - analyze what is actually written, not what you assume
3. Be specific and actionable in your analysis
4. When uncertain, err toward neutral interpretations
5. Focus on observable patterns in the message itself, not assumptions about intent
6. If context is provided, use it only to understand conversation flow - your analysis must reflect the actual current message`;

// -----------------------------------------------------------------------------
// Intent Analysis Prompt
// -----------------------------------------------------------------------------

export function buildIntentPrompt(message: string, context?: string): string {
  const contextSection = context
    ? `\nCONVERSATION CONTEXT:\n${context}\n`
    : '';

  return `${BASE_INSTRUCTIONS}

TASK: Analyze the communication intent of the following message.
${contextSection}
MESSAGE TO ANALYZE:
"${message}"

Identify three levels of intent:
- primary: The main stated purpose or request (what they explicitly want)
- secondary: The supporting goal or subtext (what else they're trying to achieve)
- implicit: The unstated emotional or relational goal (what they may not realize they're conveying)

CRITICAL RULES FOR INTENT FIELDS:
1. ALL three fields (primary, secondary, implicit) MUST be non-empty strings with at least 1 character
2. DO NOT return empty strings "" for any field
3. If the message is simple, still provide meaningful descriptions for each level
4. Each field must contain actual analysis, not placeholder text

Respond with this exact JSON structure:
{
  "primary": "description of primary intent",
  "secondary": "description of secondary intent",
  "implicit": "description of implicit intent"
}`;
}

// -----------------------------------------------------------------------------
// Tone Analysis Prompt
// -----------------------------------------------------------------------------

export function buildTonePrompt(message: string, context?: string): string {
  const contextSection = context
    ? `\nCONVERSATION CONTEXT:\n${context}\n`
    : '';

  return `${BASE_INSTRUCTIONS}

TASK: Analyze the emotional tone and sentiment of the following message.
${contextSection}
MESSAGE TO ANALYZE:
"${message}"

Provide:
- summary: A one-sentence overview of the overall tone (required, non-empty)
- emotions: Array of detected emotional signals (REQUIRED: must have at least 1 item, NEVER empty), each with:
  - text: The emotion label (e.g., "Frustrated", "Appreciative", "Anxious", "Neutral") - must be non-empty
  - sentiment: One of "positive", "neutral", or "negative" (required)
- details: Specific observations about word choice, phrasing, or patterns that reveal tone. Reference specific words or phrases from the message (required, non-empty)

CRITICAL RULES FOR EMOTIONS ARRAY:
1. The emotions array MUST contain at least 1 emotion object - NEVER return an empty array []
2. If you detect clear emotions, list them (e.g., "Frustrated", "Annoyed", "Impatient")
3. If you cannot detect clear emotions, you MUST still return at least one emotion: {"text": "Neutral", "sentiment": "neutral"}
4. The emotions array is NEVER allowed to be empty - always include at least one emotion

Respond with this exact JSON structure:
{
  "summary": "overall tone description",
  "emotions": [
    { "text": "Emotion1", "sentiment": "negative" },
    { "text": "Emotion2", "sentiment": "neutral" }
  ],
  "details": "detailed analysis with specific examples from the message"
}`;
}

// -----------------------------------------------------------------------------
// Impact Prediction Prompt
// -----------------------------------------------------------------------------

export function buildImpactPrompt(message: string, context?: string): string {
  const contextSection = context
    ? `\nCONVERSATION CONTEXT (for reference only - analyze the CURRENT message below):
${context}
\nIMPORTANT: The context above is only to help you understand the conversation flow. Your analysis MUST be based on the actual message text below, not on previous messages.`
    : '';

  return `${BASE_INSTRUCTIONS}

TASK: Predict how the recipient will likely perceive and react to this SPECIFIC message.

${contextSection}
MESSAGE TO ANALYZE:
"${message}"

CRITICAL: Analyze THIS message above based on its actual words, tone, and content. Do not assume negativity based on context - evaluate the message itself objectively.

Evaluate these four metrics (0-100 scale) based on the message above:
1. "Emotional Friction" - How much negative emotion this SPECIFIC message may trigger (0 = none, 100 = very high)
2. "Defensive Response Likelihood" - Probability recipient becomes defensive from THIS message (0 = very unlikely, 100 = very likely)
3. "Relationship Strain" - Potential damage to the relationship from THIS message (0 = none, 100 = severe)
4. "Cooperation Likelihood" - Chance recipient will comply/cooperate positively with THIS message (0 = very unlikely, 100 = very likely)

EVALUATION GUIDELINES:
- Positive/reassuring messages (e.g., "All is fine", "Thank you", "Great work") should have LOW Emotional Friction, LOW Defensive Response, LOW Relationship Strain, and HIGH Cooperation Likelihood
- Neutral messages should have medium values across metrics
- Negative/confrontational messages should have HIGH Emotional Friction, HIGH Defensive Response, HIGH Relationship Strain, and LOW Cooperation Likelihood
- Base your evaluation on the actual message text, not assumptions

CRITICAL RULES FOR METRICS ARRAY:
1. The metrics array MUST contain exactly 4 metric objects - NEVER return an empty array []
2. You MUST provide all 4 metrics listed above - no exceptions
3. Each metric must have:
   - name: The exact metric name as listed above (required, non-empty, must match exactly)
   - value: Integer between 0 and 100 inclusive (required, must be 0-100)
   - category: "low" (0-33), "medium" (34-66), or "high" (67-100) (required, must match the value range)

Also provide recipientResponse: A realistic prediction of how the recipient might think or feel upon reading THIS specific message (required, non-empty string). Base this on the actual message content.

Respond with this exact JSON structure:
{
  "metrics": [
    { "name": "Emotional Friction", "value": <0-100>, "category": "low|medium|high" },
    { "name": "Defensive Response Likelihood", "value": <0-100>, "category": "low|medium|high" },
    { "name": "Relationship Strain", "value": <0-100>, "category": "low|medium|high" },
    { "name": "Cooperation Likelihood", "value": <0-100>, "category": "low|medium|high" }
  ],
  "recipientResponse": "The recipient may feel..."
}`;
}

// -----------------------------------------------------------------------------
// Alternatives Generation Prompt
// -----------------------------------------------------------------------------

export function buildAlternativesPrompt(message: string, context?: string): string {
  const contextSection = context
    ? `\nCONVERSATION CONTEXT:\n${context}\n`
    : '';

  return `${BASE_INSTRUCTIONS}

TASK: Generate exactly 3 alternative phrasings for the message below that achieve the same goal with better emotional impact.

${contextSection}
ORIGINAL MESSAGE TO REWRITE:
"${message}"

CRITICAL REQUIREMENTS:
1. You MUST analyze the ACTUAL message above and generate alternatives for THAT specific message
2. You MUST return an array with exactly 3 alternatives - DO NOT return an empty array []
3. Each alternative must be a complete rewrite of the original message above, not a generic example

For each of the 3 alternatives, provide:
- badge: Label like "Option A", "Option B", "Option C" (required, non-empty string)
- text: The complete reworded message based on the original message above (required, non-empty string)
- reason: Explanation of why this version improves on the original message (required, at least 1 character, non-empty string)
- tags: Array with at least 1 tag (required, minimum 1 item), each tag has:
  - text: Tag label like "Collaborative", "Direct", "Empathetic" (required, non-empty string)
  - isPositive: true or false (required boolean)

Create 3 alternatives that:
1. Preserve the original intent of the message above
2. Reduce potential for negative emotional response
3. Vary in approach (e.g., one more direct, one more empathetic, one more collaborative)

Respond with this exact JSON array format (MUST have exactly 3 items, NOT empty):
[
  {
    "badge": "Option A",
    "text": "[Your rewritten version of the original message]",
    "reason": "[Explanation of why this improves on the original]",
    "tags": [
      { "text": "[Tag name]", "isPositive": true },
      { "text": "[Tag name]", "isPositive": false }
    ]
  },
  {
    "badge": "Option B",
    "text": "[Your rewritten version of the original message]",
    "reason": "[Explanation of why this improves on the original]",
    "tags": [
      { "text": "[Tag name]", "isPositive": true }
    ]
  },
  {
    "badge": "Option C",
    "text": "[Your rewritten version of the original message]",
    "reason": "[Explanation of why this improves on the original]",
    "tags": [
      { "text": "[Tag name]", "isPositive": true },
      { "text": "[Tag name]", "isPositive": false }
    ]
  }
]

FINAL REMINDER:
- Analyze the ACTUAL message: "${message}"
- Generate 3 alternatives for THAT specific message
- DO NOT copy examples - create new alternatives based on the message above
- You MUST return an array with exactly 3 alternatives
- DO NOT return an empty array []`;
}

// -----------------------------------------------------------------------------
// Retry Prompt Wrapper
// -----------------------------------------------------------------------------

export function buildRetryPrompt(originalPrompt: string, error: string): string {
  const isEmptyArrayError = error.includes('must NOT have fewer than 1 items');
  const isEmotionsError = error.includes('/emotions') && error.includes('must NOT have fewer than 1 items');
  const isMetricsError = error.includes('/metrics') && error.includes('must NOT have fewer than 1 items');
  const isAlternativesError = error.includes('root:') && error.includes('must NOT have fewer than 1 items');
  const isEmptyStringError = error.includes('must NOT have fewer than 1 characters');
  const isIntentError = (error.includes('/primary') || error.includes('/secondary') || error.includes('/implicit')) && isEmptyStringError;
  
  let specificWarning = '';
  if (isIntentError) {
    const fieldName = error.includes('/primary') ? 'primary' : error.includes('/secondary') ? 'secondary' : 'implicit';
    specificWarning = `\n\nCRITICAL ERROR: You returned an empty string for the "${fieldName}" field. This is NOT allowed. ALL intent fields (primary, secondary, implicit) MUST contain at least 1 character. You MUST provide a meaningful description for each intent level:
- primary: The main stated purpose or request (what they explicitly want) - MUST be non-empty
- secondary: The supporting goal or subtext (what else they're trying to achieve) - MUST be non-empty
- implicit: The unstated emotional or relational goal (what they may not realize they're conveying) - MUST be non-empty
DO NOT return empty strings for any intent field. Analyze the message and provide actual descriptions.\n`;
  } else if (isMetricsError) {
    specificWarning = `\n\nCRITICAL ERROR: You returned an empty metrics array []. This is NOT allowed. The metrics array MUST contain exactly 4 metric objects. You MUST provide all 4 metrics:
1. "Emotional Friction"
2. "Defensive Response Likelihood"
3. "Relationship Strain"
4. "Cooperation Likelihood"
Each metric must have: name (exact match), value (0-100), category (low/medium/high). DO NOT return an empty metrics array.\n`;
  } else if (isEmotionsError) {
    specificWarning = `\n\nCRITICAL ERROR: You returned an empty emotions array []. This is NOT allowed. The emotions array MUST contain at least 1 emotion object. If you cannot detect clear emotions, you MUST still return at least one emotion, such as {"text": "Neutral", "sentiment": "neutral"}. DO NOT return an empty emotions array.\n`;
  } else if (isAlternativesError) {
    specificWarning = `\n\nCRITICAL ERROR: You returned an empty array []. This is NOT allowed. You MUST generate exactly 3 alternatives based on the ACTUAL original message provided. DO NOT copy examples from the prompt - analyze the specific message and create alternatives for it. DO NOT return []. Start generating the 3 alternatives now.\n`;
  } else if (isEmptyArrayError) {
    specificWarning = `\n\nCRITICAL ERROR: You returned an empty array []. This is NOT allowed. Arrays must have at least the minimum number of items specified. DO NOT return empty arrays.\n`;
  } else if (isEmptyStringError) {
    specificWarning = `\n\nCRITICAL ERROR: You returned an empty string for a required field. This is NOT allowed. ALL string fields MUST contain at least 1 character. You MUST provide actual content, not empty strings. If you're uncertain, provide a reasonable description based on the message.\n`;
  }

  return `${originalPrompt}

CRITICAL: Your previous response failed validation.
Validation Error: ${error}
${specificWarning}
REQUIREMENTS YOU MUST FOLLOW:
- All required fields must be present and non-empty
- Arrays must have at least the minimum number of items specified (DO NOT return empty arrays)
- For alternatives: You MUST analyze the ACTUAL original message and generate alternatives for THAT specific message - DO NOT copy examples
- For tone analysis: emotions array MUST have at least 1 item - if uncertain, use {"text": "Neutral", "sentiment": "neutral"}
- For impact analysis: metrics array MUST have exactly 4 items - all 4 metrics must be provided
- String fields cannot be empty (must have at least 1 character)
- Numeric values must be within the specified ranges
- All boolean fields must be true or false (not strings)

Please respond with ONLY valid JSON that meets all requirements. No markdown, no explanations, just the JSON.`;
}
