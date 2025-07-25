import { AgentRuntime } from '@elizaos/core';
import { googleMeetPlugin } from '../src';

// Example of using the Google Meet plugin
async function main() {
  // Create an agent runtime with the plugin
  const runtime = new AgentRuntime({
    name: 'MeetingBot',
    plugins: [googleMeetPlugin],
    settings: {
      // Make sure OpenAI API key is configured
      OPENAI_API_KEY: 'your-openai-api-key',
      // Configure Google Meet access
      GOOGLE_MEET_EMAIL: 'bot@example.com',
      GOOGLE_MEET_PASSWORD: 'optional-password',
      // Optional settings
      AUDIO_CHUNK_DURATION_MS: '30000',
      ENABLE_REAL_TIME_TRANSCRIPTION: 'true',
    },
  });

  // Initialize the runtime
  await runtime.initialize();

  // Example 1: Join a meeting
  await runtime.processMessage({
    userId: 'user123',
    content: {
      text: 'Please join this Google Meet: https://meet.google.com/abc-defg-hij',
    },
  });

  // Example 2: Generate a report after the meeting
  await runtime.processMessage({
    userId: 'user123',
    content: {
      text: 'Generate a report for this meeting',
    },
  });

  // Example 3: Leave the meeting
  await runtime.processMessage({
    userId: 'user123',
    content: {
      text: 'Please leave the meeting',
    },
  });
}

// Run the example
main().catch(console.error); 