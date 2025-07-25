import { Action, IAgentRuntime, Memory, logger, ModelType } from '@elizaos/core';
import { z } from 'zod';
import { GoogleMeetService } from '../services/googleMeetService';
import { JoinMeetingParams } from '../types';

const joinMeetingSchema = z.object({
  meetingUrl: z.string().url().refine((url: string) => url.includes('meet.google.com'), {
    message: 'Must be a valid Google Meet URL'
  }),
  displayName: z.string().optional(),
});

export const joinMeetingAction: Action = {
  name: 'JOIN_GOOGLE_MEET',
  description: 'Join a Google Meet meeting and start listening/transcribing',
  
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    
    // Check if message contains join intent and a meet URL
    const hasJoinIntent = /join|enter|attend|go to/.test(text);
    const hasMeetUrl = /meet\.google\.com\/[\w-]+/.test(text);
    
    return hasJoinIntent && hasMeetUrl;
  },
  
  handler: async (runtime: IAgentRuntime, message: Memory) => {
    try {
      // Extract meeting URL from message
      const urlMatch = message.content.text?.match(/https?:\/\/meet\.google\.com\/[\w-]+/);
      if (!urlMatch) {
        throw new Error('Could not extract Google Meet URL from message');
      }
      
      const params: JoinMeetingParams = {
        meetingUrl: urlMatch[0],
        displayName: runtime.character.name,
      };
      
      // Validate parameters
      const validated = joinMeetingSchema.parse(params);
      
      // Get the Google Meet service
      const meetService = runtime.getService<GoogleMeetService>('google-meet');
      if (!meetService) {
        throw new Error('Google Meet service not available');
      }
      
      // Join the meeting
      const meeting = await meetService.joinMeeting(validated.meetingUrl, validated.displayName);
      
      logger.info(`Successfully joined meeting: ${meeting.id}`);
      
      return {
        success: true,
        data: {
          meetingId: meeting.id,
          meetingUrl: meeting.url,
          status: meeting.status,
        },
        message: `Successfully joined Google Meet at ${meeting.url}. I'm now listening and transcribing the conversation.`,
      };
      
    } catch (error) {
      logger.error('Failed to join meeting:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to join meeting',
      };
    }
  },
  
  examples: [],
  
  similes: [
    "JOIN_MEET",
    "ATTEND_MEETING",
    "ENTER_GOOGLE_MEET",
    "GO_TO_MEET",
  ],
}; 