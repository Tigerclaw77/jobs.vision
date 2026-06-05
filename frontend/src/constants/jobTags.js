import {
  JOB_TAG_ALIASES,
  JOB_TAG_OPTIONS,
  JOB_TAG_TAXONOMY,
  displayTagsForOrg as displayTaxonomyTagsForOrg,
  resolveJobTag,
} from "./jobTagTaxonomy";

export const JOB_TAG_CATEGORIES = JOB_TAG_TAXONOMY.map((group) => ({
  label: group.category,
  tags: group.tags.map((tag) => tag.label),
}));

export const JOB_TAGS = JOB_TAG_OPTIONS.map((tag) => ({
  id: tag.value,
  label: tag.label,
  category: tag.category,
}));

export { JOB_TAG_ALIASES, resolveJobTag };

export const JOB_TAG_RESTRICTED = {
  // "target_optical": new Set(["luxottica", "target_org"]),
  // "walmart_vision": new Set(["walmart_corp"]),
};

export function canUseJobTag(tagId, orgId) {
  const set = JOB_TAG_RESTRICTED[tagId];
  if (!set) return true;
  return set.has(orgId);
}

export function displayTagsForOrg(orgId) {
  return displayTaxonomyTagsForOrg(orgId, JOB_TAG_RESTRICTED).map((tag) => ({
    id: tag.value,
    label: tag.label,
    category: tag.category,
  }));
}
