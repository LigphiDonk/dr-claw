import { credentialsDb } from '../database/db.js';

export function getGeminiApiKeyForUser(userId) {
  if (userId) {
    try {
      const userCredential = credentialsDb.getActiveCredential(userId, 'gemini_api_key');
      if (userCredential) {
        return userCredential;
      }
    } catch (error) {
      console.error('[WARN] Failed to load Gemini API key from DB:', error.message);
    }
  }

  return process.env.GEMINI_API_KEY || null;
}

export function withGeminiApiKeyEnv(baseEnv = process.env, geminiApiKey = null) {
  const nextEnv = { ...baseEnv };

  if (geminiApiKey) {
    nextEnv.GEMINI_API_KEY = geminiApiKey;
  } else {
    delete nextEnv.GEMINI_API_KEY;
  }

  return nextEnv;
}
