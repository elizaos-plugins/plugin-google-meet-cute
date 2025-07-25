import { Service, IAgentRuntime, logger, ModelType } from '@elizaos/core';
import puppeteer from 'puppeteer';
import { getStream, launch } from 'puppeteer-stream';
import { 
  GoogleMeetConfig, 
  Meeting, 
  MeetingStatus, 
  Participant, 
  Transcript,
  GoogleMeetServiceState 
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class GoogleMeetService extends Service {
  static serviceType = 'google-meet' as const;
  
  private state: GoogleMeetServiceState = {
    isRecording: false,
  };
  
  private meetConfig!: GoogleMeetConfig; // Will be initialized in initialize()
  private meetings: Map<string, Meeting> = new Map();
  private audioBuffer: Buffer[] = [];
  private audioChunkTimer?: NodeJS.Timeout;
  private transcriptionStream?: any;
  
  constructor() {
    super();
  }
  
  get capabilityDescription(): string {
    return 'Google Meet integration service for joining meetings, capturing audio, and generating transcripts';
  }
  
  async stop(): Promise<void> {
    logger.info('Stopping Google Meet service...');
    
    // Clean up audio processing
    if (this.audioChunkTimer) {
      clearInterval(this.audioChunkTimer);
      this.audioChunkTimer = undefined;
    }
    
    if (this.transcriptionStream) {
      this.transcriptionStream.destroy();
      this.transcriptionStream = undefined;
    }
    
    // Leave meeting if in one
    if (this.state.currentMeeting) {
      await this.leaveMeeting();
    }
    
    // Clean up resources
    if (this.state.browser) {
      await this.state.browser.close();
    }
    
    logger.info('Google Meet service stopped');
  }
  
  async initialize(runtime: IAgentRuntime): Promise<void> {
    logger.info('Initializing Google Meet service...');
    
    // Store runtime reference for transcription
    this.runtime = runtime;
    
    // Get configuration from runtime
    this.meetConfig = {
      GOOGLE_MEET_EMAIL: runtime.getSetting('GOOGLE_MEET_EMAIL') || '',
      GOOGLE_MEET_PASSWORD: runtime.getSetting('GOOGLE_MEET_PASSWORD'),
      DEFAULT_MEETING_NAME: runtime.getSetting('DEFAULT_MEETING_NAME') || 'ElizaOS Bot',
      TRANSCRIPTION_LANGUAGE: runtime.getSetting('TRANSCRIPTION_LANGUAGE') || 'en',
      REPORT_OUTPUT_DIR: runtime.getSetting('REPORT_OUTPUT_DIR') || './meeting-reports',
      ENABLE_REAL_TIME_TRANSCRIPTION: runtime.getSetting('ENABLE_REAL_TIME_TRANSCRIPTION') === 'true',
      AUDIO_CHUNK_DURATION_MS: parseInt(runtime.getSetting('AUDIO_CHUNK_DURATION_MS') || '30000'),
    };
    
    // Verify OpenAI is available for transcription
    const openaiKey = runtime.getSetting('OPENAI_API_KEY');
    if (!openaiKey && this.meetConfig.ENABLE_REAL_TIME_TRANSCRIPTION) {
      logger.warn('OpenAI API key not found - transcription will be disabled');
      this.meetConfig.ENABLE_REAL_TIME_TRANSCRIPTION = false;
    }
    
    logger.info('Google Meet service initialized successfully');
  }
  
  async joinMeeting(meetingUrl: string, displayName?: string): Promise<Meeting> {
    logger.info(`Joining Google Meet: ${meetingUrl}`);
    
    if (this.state.currentMeeting) {
      throw new Error('Already in a meeting. Please leave the current meeting first.');
    }
    
    try {
      // Launch browser with audio/video permissions
      const browser = await launch({
        executablePath: puppeteer.executablePath(),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
        ],
      });
      
      const page = await browser.newPage();
      
      // Grant permissions
      const context = browser.defaultBrowserContext();
      await context.overridePermissions(meetingUrl, ['microphone', 'camera']);
      
      // Navigate to meeting
      await page.goto(meetingUrl, { waitUntil: 'networkidle2' });
      
      // Handle Google login if needed
      if (await page.$('input[type="email"]')) {
        await this.handleGoogleLogin(page);
      }
      
      // Set display name
      const nameToUse = displayName || this.meetConfig.DEFAULT_MEETING_NAME;
      await this.setDisplayName(page, nameToUse);
      
      // Join meeting
      await this.clickJoinButton(page);
      
      // Create meeting object
      const meeting: Meeting = {
        id: uuidv4(),
        url: meetingUrl,
        startTime: new Date(),
        participants: [],
        transcripts: [],
        status: 'joined' as MeetingStatus,
      };
      
      this.meetings.set(meeting.id, meeting);
      this.state.currentMeeting = meeting;
      this.state.browser = browser;
      this.state.page = page;
      
      // Start audio capture if transcription is enabled
      if (this.meetConfig.ENABLE_REAL_TIME_TRANSCRIPTION) {
        await this.startAudioCapture(page);
      }
      
      logger.info(`Successfully joined meeting: ${meeting.id}`);
      return meeting;
      
    } catch (error) {
      logger.error('Failed to join meeting:', error);
      throw error;
    }
  }
  
  async leaveMeeting(): Promise<void> {
    logger.info('Leaving Google Meet...');
    
    if (!this.state.currentMeeting) {
      throw new Error('Not currently in a meeting');
    }
    
    try {
      // Stop recording if active
      if (this.state.isRecording) {
        await this.stopRecording();
      }
      
      // Leave the meeting
      if (this.state.page) {
        // Click the leave button
        await this.state.page.evaluate(() => {
          const leaveButton = document.querySelector('[aria-label*="Leave call"]');
          if (leaveButton) {
            (leaveButton as HTMLElement).click();
          }
        });
        
        await this.state.page.waitForTimeout(2000);
      }
      
      // Close browser
      if (this.state.browser) {
        await this.state.browser.close();
      }
      
      // Update meeting status
      if (this.state.currentMeeting) {
        this.state.currentMeeting.endTime = new Date();
        this.state.currentMeeting.status = 'ended';
      }
      
      // Clear state
      this.state.currentMeeting = undefined;
      this.state.browser = undefined;
      this.state.page = undefined;
      
      logger.info('Successfully left meeting');
      
    } catch (error) {
      logger.error('Error leaving meeting:', error);
      throw error;
    }
  }
  
  async startRecording(): Promise<void> {
    if (!this.state.currentMeeting) {
      throw new Error('Not in a meeting');
    }
    
    if (this.state.isRecording) {
      throw new Error('Already recording');
    }
    
    logger.info('Starting recording...');
    this.state.isRecording = true;
    
    // Audio capture is handled by startAudioCapture called in joinMeeting
    logger.info('Recording started');
  }
  
  async stopRecording(): Promise<void> {
    if (!this.state.isRecording) {
      throw new Error('Not recording');
    }
    
    logger.info('Stopping recording...');
    this.state.isRecording = false;
    
    // Stop audio stream processing
    if (this.audioChunkTimer) {
      clearInterval(this.audioChunkTimer);
      this.audioChunkTimer = undefined;
    }
    
    // Process any remaining audio
    if (this.audioBuffer.length > 0) {
      await this.processAudioChunk();
    }
    
    if (this.transcriptionStream) {
      this.transcriptionStream.destroy();
      this.transcriptionStream = undefined;
    }
    
    logger.info('Recording stopped');
  }
  
  getCurrentMeeting(): Meeting | undefined {
    return this.state.currentMeeting;
  }
  
  getMeeting(meetingId: string): Meeting | undefined {
    return this.meetings.get(meetingId);
  }
  
  getAllMeetings(): Meeting[] {
    return Array.from(this.meetings.values());
  }
  
  getTranscripts(meetingId: string): Transcript[] {
    const meeting = this.meetings.get(meetingId);
    return meeting?.transcripts || [];
  }
  
  // Private helper methods
  
  private async handleGoogleLogin(page: any): Promise<void> {
    logger.info('Handling Google login...');
    
    // Enter email
    await page.type('input[type="email"]', this.meetConfig.GOOGLE_MEET_EMAIL);
    await page.click('#identifierNext');
    await page.waitForNavigation();
    
    // Enter password if provided
    if (this.meetConfig.GOOGLE_MEET_PASSWORD) {
      await page.waitForSelector('input[type="password"]', { visible: true });
      await page.type('input[type="password"]', this.meetConfig.GOOGLE_MEET_PASSWORD);
      await page.click('#passwordNext');
      await page.waitForNavigation();
    }
  }
  
  private async setDisplayName(page: any, name: string): Promise<void> {
    // Wait for name input field
    await page.waitForSelector('input[placeholder*="name" i]', { visible: true });
    await page.type('input[placeholder*="name" i]', name);
  }
  
  private async clickJoinButton(page: any): Promise<void> {
    // Try different selectors for the join button
    const joinSelectors = [
      'button[jsname="Qx7uuf"]',
      'button[aria-label*="Join" i]',
      'button[data-mdc-dialog-action="join"]',
      'span:contains("Join now")',
      'span:contains("Ask to join")',
    ];
    
    for (const selector of joinSelectors) {
      try {
        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        await page.click(selector);
        break;
      } catch (e) {
        // Try next selector
      }
    }
    
    // Wait for meeting to load
    await page.waitForTimeout(5000);
  }
  
  private async startAudioCapture(page: any): Promise<void> {
    logger.info('Starting audio capture for transcription...');
    
    if (!this.runtime) {
      logger.error('Runtime not available for transcription');
      return;
    }
    
    try {
      // Get audio stream from the page
      const stream = await getStream(page, { audio: true, video: false });
      
      // Reset audio buffer
      this.audioBuffer = [];
      
      // Collect audio chunks
      stream.on('data', (chunk: Buffer) => {
        this.audioBuffer.push(chunk);
      });
      
      // Process audio chunks periodically
      this.audioChunkTimer = setInterval(async () => {
        await this.processAudioChunk();
      }, this.meetConfig.AUDIO_CHUNK_DURATION_MS);
      
      // Store stream reference
      this.transcriptionStream = stream;
      
      logger.info('Audio capture started successfully');
      
    } catch (error) {
      logger.error('Failed to start audio capture:', error);
    }
  }
  
  private async processAudioChunk(): Promise<void> {
    if (this.audioBuffer.length === 0 || !this.runtime) {
      return;
    }
    
    try {
      // Combine audio chunks
      const audioData = Buffer.concat(this.audioBuffer);
      this.audioBuffer = []; // Clear buffer
      
      // Skip if audio is too small
      if (audioData.length < 1000) {
        return;
      }
      
      logger.debug(`Processing audio chunk of size: ${audioData.length} bytes`);
      
      // Use OpenAI Whisper for transcription
      const transcription = await this.runtime.useModel(
        ModelType.TRANSCRIPTION,
        audioData
      );
      
      if (transcription && this.state.currentMeeting) {
        const transcriptEntry: Transcript = {
          id: uuidv4(),
          speakerName: 'Speaker', // Whisper doesn't provide speaker diarization
          speakerId: 'speaker-1',
          text: transcription,
          timestamp: new Date(),
          confidence: 0.95, // Whisper doesn't provide confidence scores
        };
        
        this.state.currentMeeting.transcripts.push(transcriptEntry);
        logger.info(`Transcribed: ${transcription}`);
      }
      
    } catch (error) {
      logger.error('Error processing audio chunk:', error);
    }
  }
} 