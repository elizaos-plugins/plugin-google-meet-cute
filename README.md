# @elizaos/plugin-google-meet-cute

A Google Meet integration plugin for ElizaOS that enables agents to join meetings, transcribe audio in real-time using OpenAI Whisper, and generate comprehensive meeting reports.

<img width="1536" height="1024" alt="ChatGPT_Image_Jul_24_2025_10_27_43_AM" src="https://github.com/user-attachments/assets/61a54bbd-9b56-4bfb-8565-9c49dc5e5fc1" />

## Features

- 🎥 **Join Google Meet meetings** - Automatically join meetings via URL
- 🎙️ **Real-time transcription** - Capture and transcribe meeting audio using OpenAI Whisper
- 📊 **Meeting reports** - Generate summaries, key points, and action items
- 👥 **Participant tracking** - Monitor who joins and leaves meetings
- 💾 **Persistent storage** - Save transcripts and reports for later reference

## Installation

```bash
bun install @elizaos/plugin-google-meet-cute
```

## Prerequisites

1. **OpenAI API Key**: This plugin uses OpenAI Whisper for transcription (requires OpenAI API access)
2. **Google Account**: A Google account to join meetings (can be a dedicated bot account)

## Configuration

Add the following to your `.env` file:

```env
# Required - Make sure this is set in your main ElizaOS config
OPENAI_API_KEY=your-openai-api-key

# Required for Google Meet
GOOGLE_MEET_EMAIL=bot@gmail.com

# Optional
GOOGLE_MEET_PASSWORD=password  # Only if not using OAuth
DEFAULT_MEETING_NAME=ElizaOS Bot
TRANSCRIPTION_LANGUAGE=en
REPORT_OUTPUT_DIR=./meeting-reports
ENABLE_REAL_TIME_TRANSCRIPTION=true
AUDIO_CHUNK_DURATION_MS=30000  # 30 seconds chunks for Whisper
```

## Usage

### Adding the Plugin

```typescript
// In your agent configuration
const agent = {
  plugins: [
    "@elizaos/plugin-google-meet-cute"
  ],
  // ... other configuration
};
```

### Available Actions

#### JOIN_GOOGLE_MEET
Join a Google Meet meeting and start transcribing.

**Example prompts:**
- "Please join this Google Meet: https://meet.google.com/abc-defg-hij"
- "Can you attend our team meeting at https://meet.google.com/xyz-123-456?"

#### LEAVE_GOOGLE_MEET
Leave the current meeting.

**Example prompts:**
- "Please leave the meeting"
- "Exit the Google Meet call"

#### GENERATE_MEETING_REPORT
Generate a comprehensive report from the meeting.

**Example prompts:**
- "Generate a report for this meeting"
- "Create a summary of what was discussed"
- "Prepare meeting notes with action items"

### Sample Meeting Report

The plugin generates reports in the following format:

```json
{
  "meetingId": "uuid",
  "title": "Team Standup",
  "date": "2024-01-15T10:00:00Z",
  "duration": 30,
  "participants": ["Alice", "Bob", "Charlie"],
  "summary": "The team discussed...",
  "keyPoints": [
    "Feature X is on track for release",
    "Need to address performance issues",
    "New team member starting next week"
  ],
  "actionItems": [
    {
      "description": "Review pull request #123",
      "assignee": "Alice",
      "priority": "high"
    }
  ],
  "fullTranscript": [...]
}
```

## Architecture

### Components

1. **GoogleMeetService** - Core service managing browser automation and meeting state
2. **Actions** - Commands for joining, leaving, and generating reports
3. **Providers** - Context providers for meeting status
4. **Transcription** - Real-time audio capture and speech-to-text

### How It Works

1. Uses Puppeteer to automate a headless browser
2. Joins meetings with provided credentials
3. Captures audio stream using puppeteer-stream
4. Chunks audio and sends to OpenAI Whisper for transcription
5. Stores transcripts with timestamps
6. Generates AI-powered summaries and insights using ElizaOS's LLM

## Development

### Building

```bash
bun run build
```

### Testing

```bash
bun test
```

### Running Locally

```bash
# Start the agent with the plugin
elizaos start
```

## Limitations

- Requires a stable internet connection
- Meeting host may need to admit the bot
- Audio quality affects transcription accuracy
- Currently supports one meeting at a time
- Speaker diarization not available (Whisper limitation)
- Audio is transcribed in chunks (default 30 seconds)

## Security Considerations

- Store credentials securely (never commit them)
- Use a dedicated bot account for meetings
- Be transparent about recording/transcription
- Comply with meeting recording regulations

## Troubleshooting

### Bot can't join meetings
- Ensure the Google account has access to the meeting
- Check if the meeting requires approval to join
- Verify browser automation permissions

### Transcription not working
- Verify OpenAI API key is set and valid
- Check that audio chunk duration is appropriate
- Ensure audio permissions are granted in browser

### Reports not generating
- Check write permissions for report directory
- Verify sufficient transcripts were collected
- Check LLM model availability

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [plugin-google-meet-cute/issues](https://github.com/elizaos-plugins/plugin-google-meet-cute/issues)
- Discord: [ElizaOS Community](https://discord.gg/elizaos)
