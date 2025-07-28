// Injected script that runs in page context with direct access to Google Meet
(function() {
  console.log('ElizaOS Meet Injector running in page context');
  
  // State
  let meetingState = {
    inMeeting: false,
    meetingId: null,
    isMuted: false,
    isVideoOn: false
  };
  
  // Find Google Meet API objects
  function findMeetAPI() {
    // Google Meet stores its state in various places
    // We'll try to find the meeting controller
    const scripts = Array.from(document.querySelectorAll('script'));
    for (const script of scripts) {
      if (script.textContent && script.textContent.includes('meetingData')) {
        try {
          // Extract meeting data
          const match = script.textContent.match(/meetingData["\s]*:["\s]*({[^}]+})/);
          if (match) {
            return JSON.parse(match[1]);
          }
        } catch (e) {
          console.error('Failed to parse meeting data:', e);
        }
      }
    }
    return null;
  }
  
  // Monitor meeting state
  function checkMeetingState() {
    const inCall = !!(
      document.querySelector('[data-call-state="in_call"]') ||
      document.querySelector('[aria-label*="Leave call"]') ||
      document.querySelector('[data-meeting-code]')
    );
    
    const newState = {
      inMeeting: inCall,
      meetingId: getMeetingId(),
      isMuted: isMicrophoneMuted(),
      isVideoOn: isCameraOn()
    };
    
    // Check if state changed
    if (JSON.stringify(newState) !== JSON.stringify(meetingState)) {
      meetingState = newState;
      sendToContent('MEETING_STATE_CHANGED', { state: meetingState });
    }
  }
  
  // Get meeting ID from URL or DOM
  function getMeetingId() {
    // Try URL first
    const urlMatch = window.location.pathname.match(/\/([a-z0-9-]+)$/i);
    if (urlMatch) return urlMatch[1];
    
    // Try data attribute
    const element = document.querySelector('[data-meeting-code]');
    if (element) return element.getAttribute('data-meeting-code');
    
    // Try meeting info element
    const meetingInfo = document.querySelector('[data-meeting-id]');
    if (meetingInfo) return meetingInfo.getAttribute('data-meeting-id');
    
    return null;
  }
  
  // Check microphone status
  function isMicrophoneMuted() {
    const micButton = document.querySelector('[aria-label*="microphone" i]');
    if (!micButton) return false;
    
    return micButton.getAttribute('aria-pressed') === 'true' ||
           micButton.getAttribute('data-is-muted') === 'true' ||
           micButton.querySelector('[jsname="jvUMfb"]') !== null;
  }
  
  // Check camera status
  function isCameraOn() {
    const cameraButton = document.querySelector('[aria-label*="camera" i]');
    if (!cameraButton) return false;
    
    return cameraButton.getAttribute('aria-pressed') === 'false' ||
           cameraButton.getAttribute('data-is-on') === 'true';
  }
  
  // Get participant list
  function getParticipants() {
    const participants = [];
    
    // Try various selectors for participant elements
    const selectors = [
      '[data-participant-id]',
      '[data-self-name]',
      '[aria-label*="participant" i]',
      '.KV1GEc', // Google Meet participant tile class
      '[role="listitem"][data-participant-id]'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const id = el.getAttribute('data-participant-id') || 
                   el.getAttribute('data-request-id') ||
                   'participant-' + Math.random().toString(36).substr(2, 9);
        
        const name = el.querySelector('[data-self-name]')?.textContent ||
                     el.querySelector('.ZjFb7c')?.textContent ||
                     el.getAttribute('aria-label') ||
                     'Unknown';
        
        const exists = participants.find(p => p.id === id);
        if (!exists && name !== 'Unknown') {
          participants.push({
            id: id,
            name: name.trim(),
            isSpeaking: el.classList.contains('IisKdb'), // Speaking indicator
            hasVideo: !!el.querySelector('video'),
            isMuted: !!el.querySelector('[aria-label*="muted" i]')
          });
        }
      });
    }
    
    return participants;
  }
  
  // Monitor participants
  let lastParticipants = [];
  function checkParticipants() {
    const participants = getParticipants();
    if (JSON.stringify(participants) !== JSON.stringify(lastParticipants)) {
      lastParticipants = participants;
      sendToContent('PARTICIPANT_UPDATE', { participants });
    }
  }
  
  // Capture transcriptions if available
  function setupTranscriptionCapture() {
    // Google Meet closed captions element
    const captionsContainer = document.querySelector('.a4cQT');
    if (!captionsContainer) return;
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const speaker = node.querySelector('.zs7s8d')?.textContent || 'Unknown';
            const text = node.querySelector('.iOzk7')?.textContent || '';
            
            if (text) {
              sendToContent('TRANSCRIPT_UPDATE', { speaker, text });
            }
          }
        });
      });
    });
    
    observer.observe(captionsContainer, {
      childList: true,
      subtree: true
    });
  }
  
  // Handle control actions
  function handleControlMessage(data) {
    switch (data.type) {
      case 'TOGGLE_MIC':
        toggleMicrophone(data.mute);
        break;
        
      case 'TOGGLE_CAMERA':
        toggleCamera(data.enable);
        break;
        
      case 'CLICK_JOIN_BUTTON':
        clickJoinButton();
        break;
        
      case 'CHECK_MEETING_STATE':
        checkMeetingState();
        checkParticipants();
        break;
        
      case 'SET_DISPLAY_NAME':
        setDisplayName(data.displayName);
        break;
    }
  }
  
  // Toggle microphone
  function toggleMicrophone(mute) {
    const micButton = document.querySelector('[aria-label*="microphone" i]') ||
                      document.querySelector('[data-mute-button]') ||
                      document.querySelector('[jscontroller="Em32fc"]');
    
    if (micButton) {
      const currentlyMuted = isMicrophoneMuted();
      if (currentlyMuted !== mute) {
        micButton.click();
      }
    }
  }
  
  // Toggle camera
  function toggleCamera(enable) {
    const cameraButton = document.querySelector('[aria-label*="camera" i]') ||
                         document.querySelector('[data-video-button]') ||
                         document.querySelector('[jscontroller="bwqwSd"]');
    
    if (cameraButton) {
      const currentlyOn = isCameraOn();
      if (currentlyOn !== enable) {
        cameraButton.click();
      }
    }
  }
  
  // Click join button
  function clickJoinButton() {
    // Try various selectors for join button
    const selectors = [
      '[jsname="Qx7uuf"]',
      'button[aria-label*="Join now" i]',
      'button[aria-label*="Ask to join" i]',
      'button:contains("Join now")',
      '[role="button"][jsaction*="click:cOuCgd"]'
    ];
    
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && !button.disabled) {
        button.click();
        console.log('Clicked join button');
        
        // After joining, try to enable captions
        setTimeout(enableCaptions, 5000);
        return;
      }
    }
    
    console.warn('Join button not found');
  }
  
  // Enable closed captions for transcription
  function enableCaptions() {
    // Try various selectors for captions button
    const captionSelectors = [
      'button[aria-label*="captions" i]',
      'button[aria-label*="Turn on captions" i]',
      '[data-promo-anchor-id="c"]',
      '[jscontroller="fJJqIe"]',
      'button[data-tooltip*="captions" i]'
    ];
    
    for (const selector of captionSelectors) {
      const button = document.querySelector(selector);
      if (button) {
        // Check if captions are already on
        const isOn = button.getAttribute('aria-pressed') === 'true' ||
                     button.classList.contains('active');
        
        if (!isOn) {
          button.click();
          console.log('Enabled closed captions for transcription');
        } else {
          console.log('Closed captions already enabled');
        }
        return;
      }
    }
    
    console.warn('Caption button not found');
  }
  
  // Set display name
  function setDisplayName(displayName) {
    if (!displayName) return;
    
    // Try various selectors for the name input field
    const selectors = [
      'input[aria-label*="Your name" i]',
      'input[placeholder*="Your name" i]',
      'input[placeholder*="Enter your name" i]',
      'input[jsname="YPqjbf"]',
      'input[type="text"][autocomplete="false"]',
      'div[contenteditable="true"][aria-label*="name" i]'
    ];
    
    for (const selector of selectors) {
      const input = document.querySelector(selector);
      if (input) {
        if (input.tagName === 'INPUT') {
          input.value = displayName;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (input.contentEditable === 'true') {
          input.textContent = displayName;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        console.log('Set display name to:', displayName);
        return;
      }
    }
    
    console.warn('Display name input not found');
  }
  
  // Capture media streams
  function captureMediaStreams() {
    // Override getUserMedia to capture streams
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia = async function(constraints) {
      const stream = await originalGetUserMedia.call(this, constraints);
      
      // Send audio stream info to content script
      if (constraints.audio) {
        sendToContent('AUDIO_STREAM_AVAILABLE', { 
          stream: stream,
          tracks: stream.getAudioTracks().map(t => ({ 
            id: t.id, 
            label: t.label,
            enabled: t.enabled 
          }))
        });
      }
      
      return stream;
    };
  }
  
  // Send message to content script
  function sendToContent(type, data = {}) {
    window.postMessage({
      source: 'eliza-meet-inject',
      type: type,
      ...data
    }, '*');
  }
  
  // Listen for messages from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data.source !== 'eliza-meet-content') return;
    
    handleControlMessage(event.data);
  });
  
  // Set up monitoring
  function initialize() {
    // Check state every second
    setInterval(() => {
      if (meetingState.inMeeting) {
        checkMeetingState();
        checkParticipants();
      }
    }, 1000);
    
    // Initial check
    checkMeetingState();
    
    // Set up caption monitoring
    setTimeout(setupTranscriptionCapture, 3000);
    
    // Capture media streams
    captureMediaStreams();
    
    // Notify content script we're ready
    sendToContent('MEETING_CONTROLS_READY');
  }
  
  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    // Add a small delay to ensure Meet has loaded
    setTimeout(initialize, 1000);
  }
})(); 