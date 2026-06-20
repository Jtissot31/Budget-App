const path = require('path');
const { loadProjectEnv } = require('@expo/env');

// Load apps/mobile/.env before reading EXPO_PUBLIC_* into extra.
loadProjectEnv(__dirname);

/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    anthropicApiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '',
    geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '',
  },
});
