/**
 * Curated collection of famous motivational quotes for daily plans
 */

export const MOTIVATIONAL_QUOTES = [
  "A fool with a plan can achieve more than a genius without a plan.",
  "The only way to do great work is to love what you do. - Steve Jobs",
  "Success is the sum of small efforts repeated day in and day out. - Robert Collier",
  "The future belongs to those who believe in the beauty of their dreams. - Eleanor Roosevelt",
  "It does not matter how slowly you go as long as you do not stop. - Confucius",
  "Believe you can and you're halfway there. - Theodore Roosevelt",
  "Don't watch the clock; do what it does. Keep going. - Sam Levenson",
  "The only impossible journey is the one you never begin. - Tony Robbins",
  "You are never too old to set another goal or to dream a new dream. - C.S. Lewis",
  "The way to get started is to quit talking and begin doing. - Walt Disney",
  "Dream big and dare to fail. - Norman Vaughan",
  "Hard work beats talent when talent doesn't work hard. - Tim Notke",
  "The expert in anything was once a beginner. - Helen Hayes",
  "Your limitation—it's only your imagination.",
  "Great things never come from comfort zones.",
  "Push yourself, because no one else is going to do it for you.",
  "Dream it. Wish it. Do it.",
  "Success doesn't just find you. You have to go out and get it.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Dream bigger. Do bigger.",
  "Don't stop when you're tired. Stop when you're done.",
  "Wake up with determination. Go to bed with satisfaction.",
  "Do something today that your future self will thank you for.",
  "Little things make big things happen.",
  "It's going to be hard, but hard does not mean impossible.",
  "Don't wait for opportunity. Create it.",
  "Sometimes we're tested not to show our weaknesses, but to discover our strengths.",
  "The key to success is to focus on goals, not obstacles.",
  "Dream it. Believe it. Build it.",
  "If the plan doesn't work, change the plan, but never the goal.",
  "What lies behind us and what lies before us are tiny matters compared to what lies within us. - Ralph Waldo Emerson",
  "The only person you are destined to become is the person you decide to be. - Ralph Waldo Emerson"
];

/**
 * Get a random quote from the collection
 * @param {string[]} excludeQuotes - Quotes to exclude (recently used)
 * @returns {string} A random motivational quote
 */
export const getRandomQuote = (excludeQuotes = []) => {
  const availableQuotes = excludeQuotes.length > 0
    ? MOTIVATIONAL_QUOTES.filter(quote => !excludeQuotes.includes(quote))
    : MOTIVATIONAL_QUOTES;
  
  // If we've excluded all quotes, use the full list
  const quotesToUse = availableQuotes.length > 0 ? availableQuotes : MOTIVATIONAL_QUOTES;
  
  const randomIndex = Math.floor(Math.random() * quotesToUse.length);
  return quotesToUse[randomIndex];
};

