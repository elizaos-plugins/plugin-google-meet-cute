# Migration Guide: Google Cloud Speech to OpenAI Whisper

This plugin has been updated to use OpenAI Whisper for transcription instead of Google Cloud Speech-to-Text. This change simplifies setup and leverages existing OpenAI integration in ElizaOS.

## What Changed

### Removed Dependencies
- ❌ `@google-cloud/speech` - No longer needed
- ❌ Google Cloud Project setup - Not required
- ❌ Service Account credentials - Not required

### New Approach
- ✅ Uses OpenAI Whisper API for transcription
- ✅ Leverages existing OpenAI plugin integration
- ✅ Simpler configuration (just needs OpenAI API key)

## Configuration Changes

### Old Configuration
```env
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_CREDENTIALS=/path/to/credentials.json
TRANSCRIPTION_LANGUAGE=en-US
```

### New Configuration
```env
# OpenAI API key should be set in main ElizaOS config
OPENAI_API_KEY=your-openai-api-key

# Language code simplified
TRANSCRIPTION_LANGUAGE=en

# New optional setting for audio chunking
AUDIO_CHUNK_DURATION_MS=30000
```

## Technical Changes

1. **Audio Processing**: Audio is now buffered and sent in chunks (default 30 seconds) to Whisper API
2. **No Streaming**: Whisper doesn't support streaming, so transcription happens in batches
3. **No Speaker Diarization**: Whisper doesn't identify different speakers
4. **Simplified Setup**: No need for Google Cloud account or complex service account setup

## Benefits

- 🚀 **Faster Setup**: No Google Cloud configuration needed
- 💰 **Single Billing**: Uses existing OpenAI credits
- 🔧 **Simpler Maintenance**: One less API to manage
- 🔌 **Better Integration**: Works seamlessly with ElizaOS's OpenAI plugin

## Limitations

- Speaker identification is not available
- Transcription happens in chunks rather than real-time streaming
- Language support depends on Whisper's capabilities

## Upgrade Steps

1. Remove Google Cloud configuration from `.env`
2. Ensure `OPENAI_API_KEY` is set
3. Update plugin to latest version
4. Adjust `AUDIO_CHUNK_DURATION_MS` if needed (default 30 seconds works well) 