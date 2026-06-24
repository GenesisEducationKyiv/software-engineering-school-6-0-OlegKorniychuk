export const RELEASES_EXCHANGE = 'releases';
export const RELEASE_DETECTED_ROUTING_KEY = 'release.detected';
export const RELEASE_DETECTED_QUEUE = 'release.detected';

export interface ReleaseDetectedEvent {
  repoId: string;
  repoName: string;
  releaseTag: string;
}
