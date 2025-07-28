// Popup script for ElizaOS Google Meet Extension
document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const elizaUrlInput = document.getElementById('elizaUrl');
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  const meetingInfo = document.getElementById('meetingInfo');
  const meetingId = document.getElementById('meetingId');
  const participantCount = document.getElementById('participantCount');
  const duration = document.getElementById('duration');
  const autoConnectCheckbox = document.getElementById('autoConnect');
  const enableTranscriptionCheckbox = document.getElementById('enableTranscription');
  const enableVideoCaptureCheckbox = document.getElementById('enableVideoCapture');
  const setupOBSLink = document.getElementById('setupOBS');
  
  let connectionStatus = 'disconnected';
  let meetingStartTime = null;
  let durationInterval = null;
  
  // Load saved settings
  const settings = await chrome.storage.sync.get([
    'elizaUrl',
    'autoConnect',
    'enableTranscription',
    'enableVideoCapture'
  ]);
  
  if (settings.elizaUrl) {
    elizaUrlInput.value = settings.elizaUrl;
  }
  
  autoConnectCheckbox.checked = settings.autoConnect !== false;
  enableTranscriptionCheckbox.checked = settings.enableTranscription !== false;
  enableVideoCaptureCheckbox.checked = settings.enableVideoCapture !== false;
  
  // Get current connection status
  chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' }, (response) => {
    if (response && response.status) {
      updateConnectionStatus(response.status);
    }
  });
  
  // Update connection status
  function updateConnectionStatus(status) {
    connectionStatus = status;
    
    statusIndicator.className = `status-indicator ${status}`;
    
    switch (status) {
      case 'connected':
        statusText.textContent = 'Connected to ElizaOS';
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'block';
        break;
        
      case 'disconnected':
        statusText.textContent = 'Disconnected';
        connectBtn.style.display = 'block';
        disconnectBtn.style.display = 'none';
        break;
        
      case 'error':
        statusText.textContent = 'Connection Error';
        connectBtn.style.display = 'block';
        disconnectBtn.style.display = 'none';
        break;
    }
  }
  
  // Connect button click
  connectBtn.addEventListener('click', async () => {
    const url = elizaUrlInput.value.trim();
    if (!url) {
      alert('Please enter a valid WebSocket URL');
      return;
    }
    
    // Save URL
    await chrome.storage.sync.set({ elizaUrl: url });
    
    // Send connect message to background
    chrome.runtime.sendMessage({
      type: 'CONNECT_TO_ELIZA',
      url: url
    });
    
    // Update UI
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';
    
    setTimeout(() => {
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect';
    }, 2000);
  });
  
  // Disconnect button click
  disconnectBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'DISCONNECT_FROM_ELIZA' });
  });
  
  // Save settings on change
  autoConnectCheckbox.addEventListener('change', async () => {
    await chrome.storage.sync.set({ autoConnect: autoConnectCheckbox.checked });
  });
  
  enableTranscriptionCheckbox.addEventListener('change', async () => {
    await chrome.storage.sync.set({ enableTranscription: enableTranscriptionCheckbox.checked });
  });
  
  enableVideoCaptureCheckbox.addEventListener('change', async () => {
    await chrome.storage.sync.set({ enableVideoCapture: enableVideoCaptureCheckbox.checked });
  });
  
  // Setup OBS link
  setupOBSLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: chrome.runtime.getURL('obs-setup.html')
    });
  });
  
  // Check if we're in a meeting
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('meet.google.com')) {
      // We're on a Meet page, check if in meeting
      chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_MEETING_STATUS' }, (response) => {
        if (response && response.inMeeting) {
          showMeetingInfo(response);
        }
      });
    }
  });
  
  // Show meeting info
  function showMeetingInfo(info) {
    meetingInfo.style.display = 'block';
    meetingId.textContent = info.meetingId || 'Unknown';
    participantCount.textContent = info.participants || '0';
    
    if (info.startTime) {
      meetingStartTime = new Date(info.startTime);
      updateDuration();
      
      // Update duration every second
      if (durationInterval) {
        clearInterval(durationInterval);
      }
      durationInterval = setInterval(updateDuration, 1000);
    }
  }
  
  // Update meeting duration
  function updateDuration() {
    if (!meetingStartTime) return;
    
    const now = new Date();
    const diff = Math.floor((now - meetingStartTime) / 1000);
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    
    duration.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Listen for status updates from background
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.connectionStatus) {
      updateConnectionStatus(changes.connectionStatus.newValue);
    }
  });
  
  // Listen for messages from background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'CONNECTION_STATUS_CHANGED') {
      updateConnectionStatus(request.status);
    }
  });
}); 