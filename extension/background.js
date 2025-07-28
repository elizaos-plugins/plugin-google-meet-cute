// Background service worker for ElizaOS Google Meet Extension
let elizaSocket = null;
let elizaUrl = 'ws://localhost:8765'; // Default ElizaOS WebSocket URL
let connectionStatus = 'disconnected';
let currentMeetingId = null;

// Store for active tabs
const activeMeetTabs = new Map();

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('ElizaOS Google Meet Extension installed');
  
  // Set default settings
  chrome.storage.sync.set({
    elizaUrl: elizaUrl,
    autoConnect: true,
    enableTranscription: true,
    enableVideoCapture: true
  });
});

// Connect to ElizaOS WebSocket
function connectToEliza() {
  if (elizaSocket && elizaSocket.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    elizaSocket = new WebSocket(elizaUrl);
    
    elizaSocket.onopen = () => {
      console.log('Connected to ElizaOS');
      connectionStatus = 'connected';
      updateConnectionStatus();
      
      // Notify all content scripts
      chrome.tabs.query({ url: 'https://meet.google.com/*' }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { 
            type: 'ELIZA_CONNECTED' 
          });
        });
      });
    };

    elizaSocket.onmessage = (event) => {
      handleElizaMessage(JSON.parse(event.data));
    };

    elizaSocket.onerror = (error) => {
      console.error('ElizaOS WebSocket error:', error);
      connectionStatus = 'error';
      updateConnectionStatus();
    };

    elizaSocket.onclose = () => {
      console.log('Disconnected from ElizaOS');
      connectionStatus = 'disconnected';
      updateConnectionStatus();
      
      // Reconnect after 5 seconds
      setTimeout(connectToEliza, 5000);
    };
  } catch (error) {
    console.error('Failed to connect to ElizaOS:', error);
    connectionStatus = 'error';
    updateConnectionStatus();
  }
}

// Handle messages from ElizaOS
function handleElizaMessage(message) {
  console.log('Received from ElizaOS:', message);
  
  switch (message.action) {
    case 'JOIN_MEETING':
      joinMeeting(message.meetingUrl, message.displayName);
      break;
      
    case 'LEAVE_MEETING':
      leaveMeeting();
      break;
      
    case 'MUTE_MICROPHONE':
      sendToActiveTab({ type: 'TOGGLE_MIC', mute: true });
      break;
      
    case 'UNMUTE_MICROPHONE':
      sendToActiveTab({ type: 'TOGGLE_MIC', mute: false });
      break;
      
    case 'TURN_OFF_CAMERA':
      sendToActiveTab({ type: 'TOGGLE_CAMERA', enable: false });
      break;
      
    case 'TURN_ON_CAMERA':
      sendToActiveTab({ type: 'TOGGLE_CAMERA', enable: true });
      break;
      
    case 'GET_PARTICIPANTS':
      sendToActiveTab({ type: 'GET_PARTICIPANTS' });
      break;
      
    case 'START_RECORDING':
      startRecording();
      break;
      
    case 'STOP_RECORDING':
      stopRecording();
      break;
  }
}

// Send message to ElizaOS
function sendToEliza(data) {
  if (elizaSocket && elizaSocket.readyState === WebSocket.OPEN) {
    elizaSocket.send(JSON.stringify(data));
  }
}

// Send message to active Meet tab
function sendToActiveTab(message) {
  chrome.tabs.query({ active: true, url: 'https://meet.google.com/*' }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, message);
    }
  });
}

// Join a meeting
function joinMeeting(meetingUrl, displayName) {
  chrome.tabs.create({ url: meetingUrl }, (tab) => {
    activeMeetTabs.set(tab.id, {
      meetingUrl,
      joinedAt: new Date(),
      autoJoin: true, // Flag to auto-click join button
      displayName: displayName || null // Store display name if provided
    });
  });
}

// Leave current meeting
function leaveMeeting() {
  chrome.tabs.query({ active: true, url: 'https://meet.google.com/*' }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.remove(tabs[0].id);
    }
  });
}

// Start recording with desktop capture
async function startRecording() {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, url: 'https://meet.google.com/*' });
    if (!tab) return;

    // Request desktop capture
    chrome.desktopCapture.chooseDesktopMedia(
      ['tab', 'audio'],
      tab,
      (streamId) => {
        if (streamId) {
          // Send stream ID to content script
          chrome.tabs.sendMessage(tab.id, {
            type: 'START_CAPTURE',
            streamId: streamId
          });
        }
      }
    );
  } catch (error) {
    console.error('Failed to start recording:', error);
  }
}

// Stop recording
function stopRecording() {
  sendToActiveTab({ type: 'STOP_CAPTURE' });
}

// Update connection status
function updateConnectionStatus() {
  chrome.storage.local.set({ connectionStatus });
  
  // Update extension icon
  const iconPath = connectionStatus === 'connected' 
    ? 'icon-connected-' 
    : 'icon-disconnected-';
    
  chrome.action.setIcon({
    path: {
      '16': iconPath + '16.png',
      '48': iconPath + '48.png',
      '128': iconPath + '128.png'
    }
  });
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message from content script:', request);
  
  switch (request.type) {
    case 'MEETING_JOINED':
      currentMeetingId = request.meetingId;
      sendToEliza({
        type: 'MEETING_JOINED',
        meetingId: request.meetingId,
        meetingUrl: sender.tab.url,
        timestamp: new Date().toISOString()
      });
      break;
      
    case 'MEETING_LEFT':
      currentMeetingId = null;
      sendToEliza({
        type: 'MEETING_LEFT',
        meetingId: request.meetingId,
        timestamp: new Date().toISOString()
      });
      break;
      
    case 'PARTICIPANT_JOINED':
      sendToEliza({
        type: 'PARTICIPANT_JOINED',
        participant: request.participant,
        timestamp: new Date().toISOString()
      });
      break;
      
    case 'PARTICIPANT_LEFT':
      sendToEliza({
        type: 'PARTICIPANT_LEFT',
        participant: request.participant,
        timestamp: new Date().toISOString()
      });
      break;
      
    case 'TRANSCRIPT_UPDATE':
      sendToEliza({
        type: 'TRANSCRIPT',
        speaker: request.speaker,
        text: request.text,
        timestamp: new Date().toISOString()
      });
      break;
      
    case 'AUDIO_DATA':
      sendToEliza({
        type: 'AUDIO_CHUNK',
        data: request.data,
        sampleRate: request.sampleRate,
        timestamp: new Date().toISOString()
      });
      break;
      
    case 'GET_CONNECTION_STATUS':
      sendResponse({ status: connectionStatus });
      return true;
      
    case 'CONNECT_TO_ELIZA':
      elizaUrl = request.url || elizaUrl;
      chrome.storage.sync.set({ elizaUrl });
      connectToEliza();
      break;
      
    case 'DISCONNECT_FROM_ELIZA':
      if (elizaSocket) {
        elizaSocket.close();
      }
      break;
  }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('meet.google.com')) {
    // Inject our scripts if needed
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
    
    // Check if this is an auto-join meeting
    const meetingInfo = activeMeetTabs.get(tabId);
    if (meetingInfo && meetingInfo.autoJoin) {
      // Wait a bit for the page to fully load
      setTimeout(() => {
        // Set display name if provided
        if (meetingInfo.displayName) {
          chrome.tabs.sendMessage(tabId, { 
            type: 'SET_DISPLAY_NAME',
            displayName: meetingInfo.displayName
          });
        }
        
        // Then click join button
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { 
            type: 'CLICK_JOIN_BUTTON' 
          });
          // Remove the autoJoin flag after attempting
          meetingInfo.autoJoin = false;
        }, 1000); // Extra delay after setting name
      }, 3000); // Wait 3 seconds for page to be ready
    }
  }
});

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeMeetTabs.has(tabId)) {
    activeMeetTabs.delete(tabId);
    sendToEliza({
      type: 'TAB_CLOSED',
      tabId: tabId
    });
  }
});

// Start connection on load
chrome.storage.sync.get(['elizaUrl', 'autoConnect'], (items) => {
  if (items.elizaUrl) {
    elizaUrl = items.elizaUrl;
  }
  if (items.autoConnect !== false) {
    connectToEliza();
  }
}); 