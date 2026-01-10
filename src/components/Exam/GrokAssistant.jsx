import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { getQuestionExplanation, sendChatMessage } from '../../services/grokService';
import LoadingAnimation from '../Common/LoadingAnimation';
import Markdown from '../Common/Markdown';
import { formatAiMarkdown } from '../../utils/formatAiMarkdown';

const GrokAssistant = ({ question, isOpen, onClose, onMarkAsWrong }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const apiKey = import.meta.env.VITE_GROK_API_KEY;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load initial explanation when modal opens
  useEffect(() => {
    if (isOpen && question && apiKey) {
      loadInitialExplanation();
    } else if (isOpen && !apiKey) {
      setError('Grok API key not found. Please add VITE_GROK_API_KEY to your environment variables.');
      setIsLoadingInitial(false);
    }
  }, [isOpen, question, apiKey]);

  const loadInitialExplanation = async () => {
    try {
      setIsLoadingInitial(true);
      setError(null);
      const explanation = await getQuestionExplanation(question, apiKey);
      
      setMessages([
        {
          role: 'assistant',
          content: formatAiMarkdown(explanation)
        }
      ]);
    } catch (err) {
      const errorMsg = err.message || 'Failed to load explanation.';
      setError(errorMsg);
      console.error('Error loading explanation:', err);
      
      // Log full error for debugging
      if (err.message) {
        console.error('Full error message:', err.message);
      }
    } finally {
      setIsLoadingInitial(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !apiKey) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    // Add user message to chat
    const newUserMessage = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      setIsLoading(true);
      setError(null);

      // Build conversation history (exclude system message)
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await sendChatMessage(conversationHistory, userMessage, apiKey);
      
      // Add assistant response
      setMessages(prev => [...prev, { role: 'assistant', content: formatAiMarkdown(response) }]);
    } catch (err) {
      const errorMsg = err.message || 'Failed to send message. Please try again.';
      setError(errorMsg);
      console.error('Error sending message:', err);
      
      // Log full error for debugging
      if (err.message) {
        console.error('Full error message:', err.message);
      }
      
      // Remove the user message if there was an error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClose = () => {
    // Mark question as wrong when closing (if not already marked)
    if (onMarkAsWrong) {
      onMarkAsWrong();
    }
    onClose();
    // Reset state for next time
    setMessages([]);
    setInputMessage('');
    setError(null);
    setIsLoadingInitial(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/10 rounded-lg">
              <SparklesIcon className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">Grok AI Assistant</h2>
              <p className="text-xs text-muted">
                {question?.subject} - {question?.topic || 'General'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-surface transition-colors text-muted hover:text-text"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Question Context */}
        <div className="px-4 py-3 bg-surface border-b border-border">
          <p className="text-sm text-text font-medium mb-1">Question:</p>
          <p className="text-sm text-muted line-clamp-2">{question?.question}</p>
        </div>

        {/* Messages Container */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
        >
          {isLoadingInitial ? (
            <div className="flex items-center justify-center py-8">
              <LoadingAnimation message="AI is thinking" size="default" />
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
              <p className="text-sm text-red-500 font-medium mb-2">Error</p>
              <p className="text-sm text-red-400">{error}</p>
              {!apiKey ? (
                <div className="mt-3 text-xs text-red-300 space-y-2">
                  <p>To use AI Assistant, add your API key to environment variables:</p>
                  <div className="bg-red-500/20 p-2 rounded space-y-1">
                    <code className="block">VITE_GROK_API_KEY=your-api-key-here</code>
                    <p className="text-xs mt-2">For Groq:</p>
                    <code className="block">VITE_GROK_API_URL=https://api.groq.com/openai/v1/chat/completions</code>
                    <code className="block">VITE_GROK_MODEL=openai/gpt-oss-120b</code>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-xs text-muted">
                  <p className="font-semibold mb-1">Troubleshooting:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Check browser console (F12) for detailed error messages</li>
                    <li>Verify your API key is correct</li>
                    <li>Ensure API endpoint and model name are correct</li>
                    <li>Check if your API provider requires different parameters</li>
                  </ul>
                </div>
              )}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <p>No messages yet. Start by asking a question!</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary-500 text-white'
                      : 'bg-surface text-text border border-border'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <Markdown content={message.content} />
                  ) : (
                    <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
                  )}
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-surface border border-border rounded-lg p-3">
                <LoadingAnimation message="Thinking" size="small" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a follow-up question..."
              className="flex-1 input"
              disabled={isLoading || isLoadingInitial || !apiKey}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || isLoadingInitial || !apiKey}
              className="btn-primary px-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-muted mt-2">
            This question will be marked as incorrect for learning purposes. No chat data is saved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GrokAssistant;

