import { Plugin, logger } from "@elizaos/core";
import { GoogleMeetService } from "./services/googleMeetService";
import {
  joinMeetingAction,
  leaveMeetingAction,
  generateReportAction,
} from "./actions";
import { meetingProvider } from "./providers";
import { googleMeetConfigSchema } from "./types";

export const googleMeetPlugin: Plugin = {
  name: "plugin-google-meet-cute",
  description:
    "Google Meet integration plugin for ElizaOS - join meetings, transcribe audio, and create reports",

  services: [GoogleMeetService],
  actions: [joinMeetingAction, leaveMeetingAction, generateReportAction],
  providers: [meetingProvider],

  config: {
    GOOGLE_MEET_EMAIL: process.env.GOOGLE_MEET_EMAIL,
    GOOGLE_MEET_PASSWORD: process.env.GOOGLE_MEET_PASSWORD,
    DEFAULT_MEETING_NAME: process.env.DEFAULT_MEETING_NAME,
    TRANSCRIPTION_LANGUAGE: process.env.TRANSCRIPTION_LANGUAGE,
    REPORT_OUTPUT_DIR: process.env.REPORT_OUTPUT_DIR,
    ENABLE_REAL_TIME_TRANSCRIPTION: process.env.ENABLE_REAL_TIME_TRANSCRIPTION,
    AUDIO_CHUNK_DURATION_MS: process.env.AUDIO_CHUNK_DURATION_MS,
  },

  async init(config: Record<string, string>, runtime?: any): Promise<void> {
    logger.info("Initializing Google Meet plugin...");

    try {
      // Validate configuration
      const validatedConfig = {
        GOOGLE_MEET_EMAIL:
          runtime?.getSetting("GOOGLE_MEET_EMAIL") ||
          config.GOOGLE_MEET_EMAIL ||
          process.env.GOOGLE_MEET_EMAIL,
        GOOGLE_MEET_PASSWORD:
          runtime?.getSetting("GOOGLE_MEET_PASSWORD") ||
          config.GOOGLE_MEET_PASSWORD ||
          process.env.GOOGLE_MEET_PASSWORD,
        DEFAULT_MEETING_NAME:
          runtime?.getSetting("DEFAULT_MEETING_NAME") ||
          config.DEFAULT_MEETING_NAME ||
          process.env.DEFAULT_MEETING_NAME ||
          "ElizaOS Bot",
        TRANSCRIPTION_LANGUAGE:
          runtime?.getSetting("TRANSCRIPTION_LANGUAGE") ||
          config.TRANSCRIPTION_LANGUAGE ||
          process.env.TRANSCRIPTION_LANGUAGE ||
          "en",
        REPORT_OUTPUT_DIR:
          runtime?.getSetting("REPORT_OUTPUT_DIR") ||
          config.REPORT_OUTPUT_DIR ||
          process.env.REPORT_OUTPUT_DIR ||
          "./meeting-reports",
        ENABLE_REAL_TIME_TRANSCRIPTION:
          runtime?.getSetting("ENABLE_REAL_TIME_TRANSCRIPTION") ||
          config.ENABLE_REAL_TIME_TRANSCRIPTION ||
          process.env.ENABLE_REAL_TIME_TRANSCRIPTION ||
          "true",
        AUDIO_CHUNK_DURATION_MS:
          runtime?.getSetting("AUDIO_CHUNK_DURATION_MS") ||
          config.AUDIO_CHUNK_DURATION_MS ||
          process.env.AUDIO_CHUNK_DURATION_MS ||
          "30000",
      };

      // Validate with schema
      await googleMeetConfigSchema.parseAsync(validatedConfig);

      logger.info("Google Meet plugin configuration validated successfully");

      // Store config in runtime if available
      if (runtime) {
        runtime.character.settings = runtime.character.settings || {};
        runtime.character.settings.googleMeetConfig = validatedConfig;
      }
    } catch (error) {
      logger.error(
        "Google Meet plugin configuration validation failed:",
        error,
      );
      throw new Error(
        `Invalid Google Meet plugin configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  dependencies: ["puppeteer"],
};

export default googleMeetPlugin;

// Export types and utilities for external use
export * from "./types";
export { GoogleMeetService } from "./services/googleMeetService";
