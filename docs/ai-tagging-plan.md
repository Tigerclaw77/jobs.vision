# AI Tagging Preparation

This pass does not integrate AI or require API keys. It prepares the tag taxonomy and recruiter workflow for a later AI-assisted tagging phase.

## Current Flow

1. Recruiter writes the job description.
2. Recruiter manually enters tags.
3. Known tags are saved as canonical `snake_case` values from `frontend/src/constants/jobTagTaxonomy.js`.
4. Unknown recruiter-entered tags are normalized and preserved as manual override tags.
5. Tags are saved to `jobs.tag_ids`.

## Future AI Flow

1. Recruiter writes or edits the job description.
2. API sends the description plus the allowed taxonomy to an AI extraction service.
3. AI returns suggested canonical tag IDs with confidence and evidence.
4. UI shows suggested tags as unchecked or preselected suggestions.
5. Recruiter confirms, removes, or adds tags manually.
6. Confirmed tags are saved to `jobs.tag_ids`.

## Recommended Future API Shape

`POST /api/jobs/suggest-tags`

Request:

```json
{
  "title": "Optometrist - Dry Eye Clinic",
  "description": "Busy practice with scleral lenses, dry eye, and myopia management.",
  "allowedTags": ["dry_eye", "scleral_lenses", "myopia_management"]
}
```

Response:

```json
{
  "suggestions": [
    {
      "tagId": "dry_eye",
      "confidence": 0.93,
      "reason": "Description explicitly mentions dry eye."
    }
  ]
}
```

## Guardrails

- Never save AI tags without recruiter confirmation.
- Restrict AI output to known taxonomy IDs unless explicitly marked as a manual custom suggestion.
- Keep manual override available.
- Log suggestion source separately from confirmed saved tags if analytics are added later.
- Do not use AI tags to change pricing, entitlement, or job visibility.
