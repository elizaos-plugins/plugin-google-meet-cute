# Google Meet Plugin v2.0 Migration Guide

## Overview

Version 2.0 of the Google Meet plugin has been completely rewritten to use the official Google Meet REST API instead of browser automation. This provides better stability, reliability, and security.

## Breaking Changes

### Removed Features
1. **Chrome Extension** - No longer needed
2. **WebSocket Server** - Replaced with direct API calls
3. **Real-time Transcription** - Use Meet API artifacts instead
4. **Auto-join Meetings** - Create meeting spaces via API instead
5. **Browser Automation** - All DOM manipulation removed

### Changed Actions
- `JOIN_MEETING` → `CREATE_MEETING` (creates new meeting space)
- `LEAVE_MEETING` → Removed (use `endActiveConference` API if needed)
- `SUMMARIZE_MEETING` → Merged into `GENERATE_REPORT`

### New Requirements
- Google Cloud Project with Meet API enabled
- OAuth2 credentials (Client ID and Secret)
- User authentication via OAuth2 flow

## Migration Steps

### 1. Update Dependencies
```bash
npm uninstall ws openai @types/ws
npm install
```

### 2. Update Environment Variables
Remove old variables:
```bash
# Remove these
EXTENSION_WS_PORT=8765
OPENAI_API_KEY=sk-xxx
TRANSCRIPTION_LANGUAGE=en
AUDIO_CHUNK_DURATION_MS=30000
ENABLE_REAL_TIME_TRANSCRIPTION=true
```

Add new variables:
```bash
# Add these
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
# Optional: Save refresh token after first auth
GOOGLE_REFRESH_TOKEN=your-refresh-token
```

### 3. Update Code

#### Authentication
Before using any Meet actions, authenticate first:
```typescript
// User says: "Authenticate with Google"
// Agent will provide OAuth URL
```

#### Creating Meetings
Replace join meeting logic:
```typescript
// Old way
agent.joinMeeting("https://meet.google.com/abc-defg-hij");

// New way
agent.createMeeting({ accessType: 'OPEN' });
// Returns: { meetingUri, meetingCode }
```

#### Getting Meeting Info
```typescript
// Still works similarly
agent.getMeetingInfo();
// Returns: meeting details, participants, status
```

### 4. Handle API Limitations

The Google Meet REST API has some limitations compared to browser automation:

1. **No Real-time Control** - Can't mute/unmute participants or control meeting settings
2. **Conference Records** - Data available after meetings, not during
3. **Transcripts** - Only available after meetings with recording enabled
4. **No Auto-join** - Users must manually join created meetings

### 5. Remove Chrome Extension
1. Uninstall the Chrome extension from `chrome://extensions/`
2. Delete the `extension/` folder from your project

## New Features

### OAuth2 Authentication
- Secure authentication with Google
- Refresh token support for persistent auth

### Meeting Spaces API
- Create meetings programmatically
- Configure access types (OPEN, TRUSTED, RESTRICTED)
- Get meeting URIs and codes

### Conference Records
- Access participant lists after meetings
- Retrieve recordings and transcripts
- Get detailed meeting analytics

## Example Usage

```typescript
// 1. Authenticate (first time only)
"Authenticate with Google"

// 2. Create a meeting
"Create a new meeting"
// Returns: meet.google.com/abc-defg-hij

// 3. After meeting ends, get report
"Generate a meeting report"
// Returns: Summary with participants, duration, artifacts

// 4. Get specific info
"Who was in the meeting?"
// Returns: Participant list with join/leave times
```

## Troubleshooting

### "Not authenticated" Error
- Run the authenticate action first
- Check Client ID and Secret are correct

### "API not enabled" Error
- Enable Google Meet API in Cloud Console
- Wait a few minutes for propagation

### Missing Transcripts
- Ensure recording was enabled in the meeting
- Transcripts only available after meeting ends

## Support

For issues or questions:
1. Check the [README](README.md)
2. Review [SETUP_GUIDE](SETUP_GUIDE.md)
3. Open an issue on GitHub 