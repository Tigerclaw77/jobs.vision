export type JobDiscoverySourceType =
  | "career_page"
  | "greenhouse"
  | "lever"
  | "workday"
  | "unknown";

export type JobImportStatus =
  | "discovered"
  | "needs_review"
  | "rejected"
  | "published";

export interface JobDiscoverySourceInput {
  employerName: string;
  employerWebsiteUrl: string;
  careersUrl?: string | null;
  industryKey?: string | null;
  sourceType: JobDiscoverySourceType;
}

export interface JobDiscoveryResult {
  sourceUrl: string;
  discoveredAt: string;
  rawTitle: string;
  rawLocation: string | null;
  rawDescription: string | null;
  applyUrl: string | null;
  employerName: string;
  sourceType: JobDiscoverySourceType;
  confidenceScore: number;
  extractionNotes: string[];
}

export interface NormalizedDiscoveredJob {
  title: string;
  company: string;
  location: string | null;
  employmentType: string | null;
  compensation: string | null;
  description: string | null;
  applyUrl: string | null;
  sourceUrl: string;
  sourceType: JobDiscoverySourceType;
  industryTags: string[];
  roleTags: string[];
  status: JobImportStatus;
  duplicateKey: string;
}

export interface JobDiscoveryIndustryConfig {
  industryKey: string;
  industryTags?: Record<string, string[]>;
  roleKeywordSets?: Record<string, string[]>;
  includeIfAnyKeywordMatches?: string[];
}
