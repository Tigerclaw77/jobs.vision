export type JobDiscoverySourceType =
  | "career_page"
  | "smartrecruiters"
  | "greenhouse"
  | "lever"
  | "workday"
  | "icims"
  | "taleo"
  | "unknown";

export type JobDiscoveryClassification =
  | "job_posting"
  | "career_landing_page"
  | "navigation"
  | "informational"
  | "unknown";

export type JobImportStatus =
  | "discovered"
  | "needs_review"
  | "evergreen"
  | "rejected"
  | "published";

export type JobImportRoleBadge =
  | "OD"
  | "OPTICIAN"
  | "TECH"
  | "MANAGER"
  | "OPTICAL"
  | "FRONT_DESK"
  | "OMD"
  | "OTHER"
  | "UNKNOWN";

export type JobImportRecommendation = "approve" | "reject" | "review";

export interface JobImportClassificationSummary {
  primaryRole: string | null;
  secondaryRole: string | null;
  specialty: string | null;
  employmentType: string | null;
  practiceType: string | null;
  compensationSummary: string | null;
  jobsVisionRelevant: boolean | null;
  recommendation: JobImportRecommendation;
  recommendationReason: string;
  confidenceScore: number;
  roleBadge: JobImportRoleBadge;
}

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
  atsProvider?: JobDiscoverySourceType | null;
  classification: JobDiscoveryClassification;
  requisitionId?: string | null;
  confidenceScore: number;
  extractionNotes: string[];
}

export interface NormalizedDiscoveredJob {
  title: string;
  company: string;
  parentCompany?: string | null;
  employerBrand?: string | null;
  practiceName?: string | null;
  location: string | null;
  employmentType: string | null;
  compensation: string | null;
  description: string | null;
  applyUrl: string | null;
  sourceUrl: string;
  sourceType: JobDiscoverySourceType;
  atsProvider?: JobDiscoverySourceType | null;
  classification: JobDiscoveryClassification;
  requisitionId?: string | null;
  industryTags: string[];
  roleTags: string[];
  classificationSummary?: JobImportClassificationSummary;
  primaryRole?: string | null;
  secondaryRole?: string | null;
  specialty?: string | null;
  practiceType?: string | null;
  compensationSummary?: string | null;
  jobsVisionRelevant?: boolean;
  recommendation?: JobImportRecommendation;
  recommendationReason?: string | null;
  classificationConfidenceScore?: number | null;
  roleBadge?: JobImportRoleBadge;
  status: JobImportStatus;
  duplicateKey: string;
}

export interface JobDiscoveryIndustryConfig {
  industryKey: string;
  industryTags?: Record<string, string[]>;
  roleKeywordSets?: Record<string, string[]>;
  includeIfAnyKeywordMatches?: string[];
}
