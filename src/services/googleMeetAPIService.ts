import { Service, IAgentRuntime, logger } from "@elizaos/core";
import { google, meet_v2 } from "googleapis";
import { GoogleAuthService } from "./googleAuthService";
import { Meeting, MeetingStatus, Participant, Transcript } from "../types";
import axios from "axios";

export class GoogleMeetAPIService extends Service {
  static serviceType = "google-meet-api" as const;
  
  private authService: GoogleAuthService;
  private meetClient: meet_v2.Meet;
  private meetings: Map<string, Meeting> = new Map();
  private currentMeetingSpace: meet_v2.Schema$Space | null = null;
  
  get capabilityDescription(): string {
    return "Google Meet API service for managing meetings, participants, and artifacts";
  }
  
  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.authService = runtime.getService("google-auth") as GoogleAuthService;
    
    if (!this.authService) {
      throw new Error("GoogleAuthService not found. Make sure it's registered before GoogleMeetAPIService");
    }
    
    this.meetClient = google.meet({ 
      version: 'v2',
      auth: this.authService.getOAuth2Client()
    });
  }

  static async start(runtime: IAgentRuntime): Promise<Service> {
    logger.info("Starting Google Meet API Service");
    const service = new GoogleMeetAPIService(runtime);
    await service.initialize();
    return service;
  }
  
  async initialize(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      logger.warn("Google Auth Service not authenticated. Please authenticate before using Meet API.");
    }
  }
  
  async createMeeting(config?: {
    accessType?: 'OPEN' | 'TRUSTED' | 'RESTRICTED';
  }): Promise<Meeting> {
    try {
      const response = await this.meetClient.spaces.create({
        requestBody: {
          config: {
            accessType: config?.accessType || 'OPEN',
            entryPointAccess: 'ALL'
          }
        }
      });
      
      const space = response.data;
      if (!space.name || !space.meetingUri || !space.meetingCode) {
        throw new Error("Invalid meeting space response");
      }
      
      const meeting: Meeting = {
        id: space.name,
        meetingCode: space.meetingCode,
        meetingUri: space.meetingUri,
        status: MeetingStatus.ACTIVE,
        startTime: new Date(),
        participants: [],
        transcripts: []
      };
      
      this.meetings.set(meeting.id, meeting);
      this.currentMeetingSpace = space;
      
      logger.info(`Created meeting: ${meeting.meetingUri}`);
      return meeting;
    } catch (error) {
      logger.error("Failed to create meeting:", error);
      throw error;
    }
  }
  
  async getMeetingSpace(spaceName: string): Promise<meet_v2.Schema$Space> {
    try {
      const response = await this.meetClient.spaces.get({
        name: spaceName
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Failed to get meeting space ${spaceName}:`, error);
      throw error;
    }
  }
  
  async getConference(conferenceName: string): Promise<meet_v2.Schema$ConferenceRecord> {
    try {
      const response = await this.meetClient.conferenceRecords.get({
        name: conferenceName
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Failed to get conference ${conferenceName}:`, error);
      throw error;
    }
  }
  
  async listParticipants(conferenceRecordName: string): Promise<Participant[]> {
    try {
      const response = await this.meetClient.conferenceRecords.participants.list({
        parent: conferenceRecordName,
        pageSize: 100
      });
      
      const participants: Participant[] = [];
      
      if (response.data.participants) {
        for (const p of response.data.participants) {
          if (p.name) {
            // Handle different participant types based on the API structure
            let displayName = "Unknown";
            
            // Check if it's a signedinUser
            if (p.signedinUser) {
              displayName = p.signedinUser.displayName || p.signedinUser.user || "Signed-in User";
            }
            // Check if it's an anonymousUser
            else if (p.anonymousUser) {
              displayName = p.anonymousUser.displayName || "Anonymous User";
            }
            // Check if it's a phoneUser
            else if (p.phoneUser) {
              displayName = p.phoneUser.displayName || "Phone User";
            }
            
            participants.push({
              id: p.name,
              name: displayName,
              joinTime: p.earliestStartTime ? new Date(p.earliestStartTime) : new Date(),
              leaveTime: p.latestEndTime ? new Date(p.latestEndTime) : undefined,
              isActive: !p.latestEndTime
            });
          }
        }
      }
      
      return participants;
    } catch (error) {
      logger.error(`Failed to list participants for ${conferenceRecordName}:`, error);
      throw error;
    }
  }
  
  async getTranscript(transcriptName: string): Promise<string> {
    try {
      const response = await this.meetClient.conferenceRecords.transcripts.get({
        name: transcriptName
      });
      
      if (!response.data.name) {
        throw new Error("Invalid transcript response");
      }
      
      // Get transcript entries
      const entriesResponse = await this.meetClient.conferenceRecords.transcripts.entries.list({
        parent: response.data.name,
        pageSize: 1000
      });
      
      let fullTranscript = "";
      if (entriesResponse.data.transcriptEntries) {
        for (const entry of entriesResponse.data.transcriptEntries) {
          const speaker = entry.participant || "Unknown";
          const text = entry.text || "";
          fullTranscript += `${speaker}: ${text}\n`;
        }
      }
      
      return fullTranscript;
    } catch (error) {
      logger.error(`Failed to get transcript ${transcriptName}:`, error);
      throw error;
    }
  }
  
  async listRecordings(conferenceRecordName: string): Promise<meet_v2.Schema$Recording[]> {
    try {
      const response = await this.meetClient.conferenceRecords.recordings.list({
        parent: conferenceRecordName
      });
      
      return response.data.recordings || [];
    } catch (error) {
      logger.error(`Failed to list recordings for ${conferenceRecordName}:`, error);
      throw error;
    }
  }
  
  async getRecordingUrl(recordingName: string): Promise<string | null> {
    try {
      const response = await this.meetClient.conferenceRecords.recordings.get({
        name: recordingName
      });
      
      return response.data.driveDestination?.file || null;
    } catch (error) {
      logger.error(`Failed to get recording ${recordingName}:`, error);
      throw error;
    }
  }
  
  async endMeeting(spaceName: string): Promise<void> {
    try {
      await this.meetClient.spaces.endActiveConference({
        name: spaceName
      });
      
      const meeting = Array.from(this.meetings.values()).find(m => m.id === spaceName);
      if (meeting) {
        meeting.status = MeetingStatus.ENDED;
        meeting.endTime = new Date();
      }
      
      logger.info(`Ended meeting: ${spaceName}`);
    } catch (error) {
      logger.error(`Failed to end meeting ${spaceName}:`, error);
      throw error;
    }
  }
  
  getCurrentMeeting(): Meeting | null {
    return this.currentMeetingSpace ? 
      this.meetings.get(this.currentMeetingSpace.name!) || null : 
      null;
  }
  
  getMeeting(meetingId: string): Meeting | null {
    return this.meetings.get(meetingId) || null;
  }
  
  async stop(): Promise<void> {
    logger.info("Stopping Google Meet API Service");
    this.meetings.clear();
    this.currentMeetingSpace = null;
  }
} 