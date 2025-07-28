// Content script for Google Meet pages
console.log('ElizaOS Google Meet Extension loaded');

// State
let isConnected = false;
let meetingId = null;
let participants = new Map();
let mediaRecorder = null;
let audioContext = null;
let audioProcessor = null;
let meetingStartTime = null;

// Inject script into page context for direct access
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Set up message passing with injected script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.source !== 'eliza-meet-inject') return;
  
  handleInjectedMessage(event.data);
});

// Handle messages from injected script
function handleInjectedMessage(data) {
  switch (data.type) {
    case 'MEETING_STATE_CHANGED':
      handleMeetingStateChange(data.state);
      break;
      
    case 'PARTICIPANT_UPDATE':
      handleParticipantUpdate(data.participants);
      break;
      
    case 'TRANSCRIPT_UPDATE':
      chrome.runtime.sendMessage({
        type: 'TRANSCRIPT_UPDATE',
        speaker: data.speaker,
        text: data.text
      });
      break;
      
    case 'AUDIO_STREAM_AVAILABLE':
      handleAudioStream(data.stream);
      break;
      
    case 'MEETING_CONTROLS_READY':
      console.log('Meeting controls are ready');
      break;
  }
}

// Handle meeting state changes
function handleMeetingStateChange(state) {
  if (state.inMeeting && !meetingId) {
    // Joined meeting
    meetingId = state.meetingId || generateMeetingId();
    meetingStartTime = new Date();
    chrome.runtime.sendMessage({
      type: 'MEETING_JOINED',
      meetingId: meetingId
    });
  } else if (!state.inMeeting && meetingId) {
    // Left meeting
    chrome.runtime.sendMessage({
      type: 'MEETING_LEFT',
      meetingId: meetingId
    });
    meetingId = null;
    meetingStartTime = null;
    participants.clear();
  }
}

// Handle participant updates
function handleParticipantUpdate(newParticipants) {
  const currentIds = new Set(participants.keys());
  const newIds = new Set(newParticipants.map(p => p.id));
  
  // Find who joined
  newParticipants.forEach(participant => {
    if (!currentIds.has(participant.id)) {
      participants.set(participant.id, participant);
      chrome.runtime.sendMessage({
        type: 'PARTICIPANT_JOINED',
        participant: participant
      });
    }
  });
  
  // Find who left
  currentIds.forEach(id => {
    if (!newIds.has(id)) {
      const participant = participants.get(id);
      chrome.runtime.sendMessage({
        type: 'PARTICIPANT_LEFT',
        participant: participant
      });
      participants.delete(id);
    }
  });
}

// Handle audio stream for processing
async function handleAudioStream(stream) {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  
  try {
    const source = audioContext.createMediaStreamSource(stream);
    audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    
    audioProcessor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const audioData = Array.from(inputData);
      
      // Send audio data to background script
      chrome.runtime.sendMessage({
        type: 'AUDIO_DATA',
        data: audioData,
        sampleRate: audioContext.sampleRate
      });
    };
    
    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
  } catch (error) {
    console.error('Failed to process audio stream:', error);
  }
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message from background:', request);
  
  switch (request.type) {
    case 'ELIZA_CONNECTED':
      isConnected = true;
      notifyPageOfConnection();
      break;
      
    case 'TOGGLE_MIC':
      toggleMicrophone(request.mute);
      break;
      
    case 'TOGGLE_CAMERA':
      toggleCamera(request.enable);
      break;
      
    case 'GET_PARTICIPANTS':
      sendResponse({ participants: Array.from(participants.values()) });
      break;
      
    case 'START_CAPTURE':
      startMediaCapture(request.streamId);
      break;
      
    case 'STOP_CAPTURE':
      stopMediaCapture();
      break;
      
    case 'CLICK_JOIN_BUTTON':
      clickJoinButton();
      break;
      
    case 'SET_DISPLAY_NAME':
      setDisplayName(request.displayName);
      break;
      
    case 'GET_MEETING_STATUS':
      // Respond with current meeting status
      sendResponse({
        inMeeting: meetingId !== null,
        meetingId: meetingId,
        participants: participants.size,
        startTime: meetingStartTime
      });
      return true; // Indicates async response
  }
});

// Notify page script of connection status
function notifyPageOfConnection() {
  window.postMessage({
    source: 'eliza-meet-content',
    type: 'ELIZA_CONNECTION_STATUS',
    connected: isConnected
  }, '*');
}

// Toggle microphone
function toggleMicrophone(mute) {
  window.postMessage({
    source: 'eliza-meet-content',
    type: 'TOGGLE_MIC',
    mute: mute
  }, '*');
}

// Toggle camera
function toggleCamera(enable) {
  window.postMessage({
    source: 'eliza-meet-content',
    type: 'TOGGLE_CAMERA',
    enable: enable
  }, '*');
}

// Click join button
function clickJoinButton() {
  window.postMessage({
    source: 'eliza-meet-content',
    type: 'CLICK_JOIN_BUTTON'
  }, '*');
}

// Set display name
function setDisplayName(displayName) {
  window.postMessage({
    source: 'eliza-meet-content',
    type: 'SET_DISPLAY_NAME',
    displayName: displayName
  }, '*');
}

// Start media capture
async function startMediaCapture(streamId) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        }
      }
    });
    
    // Create MediaRecorder
    const options = {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 2500000,
      audioBitsPerSecond: 128000
    };
    
    mediaRecorder = new MediaRecorder(stream, options);
    const chunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      // Send to background for processing
      const reader = new FileReader();
      reader.onload = () => {
        chrome.runtime.sendMessage({
          type: 'RECORDING_COMPLETE',
          data: reader.result,
          mimeType: 'video/webm'
        });
      };
      reader.readAsDataURL(blob);
    };
    
    mediaRecorder.start(1000); // Record in 1-second chunks
    console.log('Recording started');
  } catch (error) {
    console.error('Failed to start capture:', error);
  }
}

// Stop media capture
function stopMediaCapture() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    console.log('Recording stopped');
  }
}

// Generate meeting ID from URL
function generateMeetingId() {
  const match = window.location.pathname.match(/\/([a-z0-9-]+)$/i);
  return match ? match[1] : 'unknown-' + Date.now();
}

// Observe DOM for meeting state changes
const observer = new MutationObserver(() => {
  // Check if we're in a meeting by looking for specific elements
  const inMeeting = !!(
    document.querySelector('[data-meeting-code]') ||
    document.querySelector('[aria-label*="Leave call"]') ||
    document.querySelector('[data-call-state="in_call"]')
  );
  
  window.postMessage({
    source: 'eliza-meet-content',
    type: 'CHECK_MEETING_STATE'
  }, '*');
});

// Start observing when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
} else {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initial connection check
chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' }, (response) => {
  if (response && response.status === 'connected') {
    isConnected = true;
    notifyPageOfConnection();
  }
}); 