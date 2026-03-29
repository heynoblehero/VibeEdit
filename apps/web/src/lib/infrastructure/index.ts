/**
 * Infrastructure Module
 *
 * Central export for the infrastructure migration layer.
 * Import from "@/lib/infrastructure" for all infra concerns.
 */

// Config
export {
  type InfraConfig,
  type ProcessingBackend,
  type StorageProvider,
  type ProcessingTask,
  type InfraEndpoints,
  type StorageConfig,
  type ProcessingLimits,
  DEFAULT_CONFIG,
  DEFAULT_LIMITS,
  getInfraConfig,
  resetInfraConfig,
  loadInfraConfig,
  hasEndpoint,
  getEndpoint,
} from "./config";

// Processing Router
export {
  type RoutingDecision,
  type ProcessingTaskInput,
  type ServerTaskPayload,
  type ProgressCallback,
  type ProcessingResult,
  shouldOffloadToServer,
  routeProcessingTask,
} from "./processing-router";

// Cloud Storage
export {
  type CloudStorageProvider,
  createStorageProvider,
  getStorageProvider,
  resetStorageProvider,
} from "./cloud-storage";

// Job Queue
export {
  type Job,
  type JobStatus,
  type JobExecutor,
  JobQueue,
  getJobQueue,
  resetJobQueue,
} from "./job-queue";
