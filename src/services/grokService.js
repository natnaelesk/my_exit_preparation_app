/**
 * Groq AI Service (Free AI API)
 * Handles communication with Groq AI API (or OpenAI-compatible APIs) for question explanations and chat
 * No data is saved - all interactions are temporary
 * 
 * Supports:
 * - Groq API (Free tier available)
 * - xAI Grok API
 * - OpenAI-compatible APIs
 * - Other AI providers with similar API structure
 */

// API Configuration - Update these in your .env file
// For Groq (Free AI API): https://api.groq.com/openai/v1/chat/completions
// For xAI Grok: https://api.x.ai/v1/chat/completions
// For OpenAI: https://api.openai.com/v1/chat/completions
// For other providers: Check their documentation
const GROK_API_URL = import.meta.env.VITE_GROK_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
// Common Groq model names:
// - openai/gpt-oss-120b
// - llama-3.1-70b-versatile
// - mixtral-8x7b-32768
// - llama-3.1-8b-instant
// Check https://console.groq.com/docs/models for all available models
const GROK_MODEL = import.meta.env.VITE_GROK_MODEL || 'openai/gpt-oss-120b';

/**
 * Get initial explanation for a question
 * @param {Object} question - The question object
 * @param {string} apiKey - Groq/Grok API key
 * @returns {Promise<string>} - AI explanation
 */
export const getQuestionExplanation = async (question, apiKey) => {
  if (!apiKey) {
    throw new Error('Groq/Grok API key is required. Please add VITE_GROK_API_KEY to your environment variables.');
  }

  const prompt = `Return your answer in GitHub-flavored Markdown.

Constraints:
- Keep it concise and simple English (aim 8-14 short bullet points total).
- Use ONLY "###" headings (no "#", no "##").
- Prefer bullets over long paragraphs.
- No emojis.
- If you include code, keep it very short.

Task:
Explain the question and the correct answer clearly, then briefly say why the other choices are wrong.

Question: ${question.question}

Subject: ${question.subject}
Topic: ${question.topic || 'General'}

Choices:
${question.choices.map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`).join('\n')}

Correct Answer: ${question.correctAnswer}

Explanation provided: ${question.explanation}
`;

  const requestBody = {
    model: GROK_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful computer science tutor. Be concise, use simple English, and format answers in GitHub-flavored Markdown using ONLY ### headings. No emojis.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 1000
  };

  console.log('Groq/Grok API Request:', {
    url: GROK_API_URL,
    model: GROK_MODEL,
    hasApiKey: !!apiKey
  });

  try {
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorMessage = `API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        console.error('API Error Response:', errorData);
        
        // Try to extract detailed error message
        if (errorData.error) {
          const apiError = errorData.error;
          errorMessage = apiError.message || apiError.code || JSON.stringify(apiError);
          
          // Add helpful hints for common errors
          if (apiError.message && apiError.message.includes('model')) {
            errorMessage += '\n\n💡 Tip: Try different model names in your .env file:\n' +
              '  - VITE_GROK_MODEL=openai/gpt-oss-120b\n' +
              '  - VITE_GROK_MODEL=llama-3.1-70b-versatile\n' +
              '  - VITE_GROK_MODEL=mixtral-8x7b-32768\n' +
              'Check https://console.groq.com/docs/models for all available models.';
          } else if (apiError.message && apiError.message.includes('key') || apiError.message.includes('auth')) {
            errorMessage += '\n\n💡 Tip: Verify your API key at https://console.groq.com and ensure it has API access.';
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else {
          errorMessage = JSON.stringify(errorData);
        }
      } catch (parseError) {
        const textError = await response.text().catch(() => '');
        console.error('Error response text:', textError);
        errorMessage = textError || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Unable to generate explanation.';
  } catch (error) {
    console.error('Error calling Groq/Grok API:', error);
    throw new Error(`Failed to get AI explanation: ${error.message}`);
  }
};

/**
 * Send a chat message to Groq/Grok AI
 * @param {Array} conversationHistory - Array of {role: 'user'|'assistant', content: string}
 * @param {string} userMessage - The user's message
 * @param {string} apiKey - Groq/Grok API key
 * @returns {Promise<string>} - AI response
 */
export const sendChatMessage = async (conversationHistory, userMessage, apiKey) => {
  if (!apiKey) {
    throw new Error('Grok API key is required.');
  }

  try {
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful computer science tutor. Answer questions clearly and provide educational guidance.'
      },
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage
      }
    ];

    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      let errorMessage = `API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        console.error('API Error Response:', errorData);
        
        // Try to extract detailed error message
        if (errorData.error) {
          const apiError = errorData.error;
          errorMessage = apiError.message || apiError.code || JSON.stringify(apiError);
          
          // Add helpful hints for common errors
          if (apiError.message && apiError.message.includes('model')) {
            errorMessage += '\n\n💡 Tip: Try different model names in your .env file:\n' +
              '  - VITE_GROK_MODEL=openai/gpt-oss-120b\n' +
              '  - VITE_GROK_MODEL=llama-3.1-70b-versatile\n' +
              '  - VITE_GROK_MODEL=mixtral-8x7b-32768\n' +
              'Check https://console.groq.com/docs/models for all available models.';
          } else if (apiError.message && apiError.message.includes('key') || apiError.message.includes('auth')) {
            errorMessage += '\n\n💡 Tip: Verify your API key at https://console.groq.com and ensure it has API access.';
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else {
          errorMessage = JSON.stringify(errorData);
        }
      } catch (parseError) {
        const textError = await response.text().catch(() => '');
        console.error('Error response text:', textError);
        errorMessage = textError || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Unable to generate response.';
  } catch (error) {
    console.error('Error calling Grok API:', error);
    throw new Error(`Failed to send message: ${error.message}`);
  }
};

/**
 * Get a short daily motivation message for the Plan page.
 * Nothing is saved; callers should cache it locally if desired.
 */
export const getDailyPlanMotivation = async (
  {
    dateKey,
    focusSubject,
    focusTopic,
    subjectAccuracy,
    weakestTopics = []
  },
  apiKey
) => {
  if (!apiKey) {
    throw new Error('Groq/Grok API key is required. Please add VITE_GROK_API_KEY to your environment variables.');
  }

  const weakTopicsText =
    weakestTopics && weakestTopics.length > 0
      ? weakestTopics
          .slice(0, 4)
          .map((t) => `${t.topic}: ${Math.round(t.accuracy || 0)}%`)
          .join(', ')
      : 'N/A';

  const prompt = `Return your answer in plain text (NO Markdown).
Constraints:
- 1 short paragraph, 2-3 sentences max.
- Simple English.
- No emojis.
- Talk directly to the user ("you").
- Be motivating but not cheesy.

Context:
Date: ${dateKey}
Today's focus subject: ${focusSubject}
Today's focus topic: ${focusTopic || 'All topics'}
Current subject accuracy: ${Math.round(subjectAccuracy || 0)}%
Weak topics (accuracy): ${weakTopicsText}

Task:
Write a motivation message for today's practice plan that helps the user stay consistent and focus on improving weak areas.`;

  try {
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a concise, practical study coach.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 180
      })
    });

    if (!response.ok) {
      let errorMessage = `API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) errorMessage = errorData.error.message;
      } catch {}
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return (data.choices[0]?.message?.content || '').trim() || 'Stay consistent today — one focused session is enough to move your score.';
  } catch (error) {
    throw new Error(`Failed to get daily motivation: ${error.message}`);
  }
};

