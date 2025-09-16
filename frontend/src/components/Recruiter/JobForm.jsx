import React, { useMemo } from "react";
import {
  Typography,
  FormControlLabel,
  Checkbox,
  Box,
  MenuItem,
  Chip,
  IconButton,
} from "@mui/material";
import { X as XIcon } from "lucide-react";
import GlassTextField from "../ui/GlassTextField";

// ✅ Canonical tags
import {
  JOB_TAG_CATEGORIES,
  displayTagsForOrg,
} from "../../constants/jobTags";

/**
 * Props:
 * - register, errors, watch, setValue (react-hook-form)
 * - suggestions, loadingSuggestions, handleLocationInputChange, handleSuggestionSelect (Places)
 * - orgId (optional; falls back to chainAffiliation -> `${chainAffiliation}_org`)
 */
export default function JobForm({
  register,
  errors,
  watch,
  setValue,
  suggestions,
  loadingSuggestions,
  handleLocationInputChange,
  handleSuggestionSelect,
  orgId: orgIdProp,
}) {
  const chainAffiliation = watch("chainAffiliation") || "";
  const orgId = orgIdProp || (chainAffiliation ? `${chainAffiliation}_org` : undefined);

  // Allowed canonical tags for this org, grouped by your category order
  const groupedAllowedTags = useMemo(() => {
    const allowed = displayTagsForOrg(orgId);
    const byCat = allowed.reduce((acc, t) => {
      (acc[t.category] = acc[t.category] || []).push(t);
      return acc;
    }, {});
    return JOB_TAG_CATEGORIES.map((cat) => ({
      categoryLabel: cat.label,
      items: (byCat[cat.label] || []).sort((a, b) => a.label.localeCompare(b.label)),
    }));
  }, [orgId]);

  // Work mode
  const workMode = watch("workMode") || "onsite";

  // Multi-locations (array in form state)
  const locations = Array.isArray(watch("locations")) ? watch("locations") : [];

  const removeLocation = (idx) => {
    const next = locations.slice();
    next.splice(idx, 1);
    setValue("locations", next, { shouldDirty: true, shouldValidate: true });

    // Keep legacy single location in sync with first element
    const first = next[0];
    setValue("location", first?.label || "", { shouldDirty: true });
    setValue("latitude", first?.lat ?? "", { shouldDirty: true });
    setValue("longitude", first?.lng ?? "", { shouldDirty: true });
  };

  return (
    <>
      {/* Essentials */}
      <GlassTextField
        label="Job Title"
        {...register("jobTitle")}
        error={!!errors.jobTitle}
        helperText={errors.jobTitle?.message}
        fullWidth
      />

      <GlassTextField
        label="Company"
        {...register("company")}
        error={!!errors.company}
        helperText={errors.company?.message}
        fullWidth
      />

      {/* Work mode */}
      <GlassTextField
        select
        label="Work Mode"
        {...register("workMode")}
        defaultValue="onsite"
        fullWidth
      >
        {["remote", "hybrid", "onsite"].map((o) => (
          <MenuItem key={o} value={o}>
            {o.charAt(0).toUpperCase() + o.slice(1)}
          </MenuItem>
        ))}
      </GlassTextField>

      {/* Locations */}
      {workMode !== "remote" && (
        <>
          <Typography variant="subtitle1" sx={{ mt: 1.5, mb: 0.5, fontWeight: 600 }}>
            Locations
          </Typography>

          {/* Add-by-search input (uses Places) */}
          <Box sx={{ position: "relative", mb: 1.5 }}>
            <GlassTextField
              label="Search city or address to add"
              value={watch("location")}
              onChange={handleLocationInputChange}
              error={!!errors.location}
              helperText={
                errors.location?.message ||
                "Pick one or more. First item is the primary location."
              }
              fullWidth
            />
            {loadingSuggestions && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Loading suggestions...
              </Typography>
            )}
            {suggestions?.length > 0 && (
              <Box
                sx={{
                  position: "absolute",
                  zIndex: 10,
                  backgroundColor: "white",
                  width: "100%",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  mt: 1,
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {suggestions.map((s, idx) => (
                  <MenuItem key={idx} onClick={() => handleSuggestionSelect(s)}>
                    {s.placePrediction?.text?.structuredFormat?.mainText?.text}
                  </MenuItem>
                ))}
              </Box>
            )}
          </Box>

          {/* Chosen locations */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1 }}>
            {locations.map((loc, i) => (
              <Chip
                key={`${loc.label}-${i}`}
                label={loc.label}
                onDelete={() => removeLocation(i)}
                deleteIcon={
                  <IconButton size="small" aria-label="remove">
                    <XIcon size={14} />
                  </IconButton>
                }
              />
            ))}
            {!locations.length && (
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                No locations yet. Add at least one for On-site/Hybrid roles.
              </Typography>
            )}
          </Box>

          {/* Hidden legacy single-location fields */}
          <input type="hidden" {...register("latitude")} />
          <input type="hidden" {...register("longitude")} />
          <input type="hidden" {...register("state")} />
        </>
      )}

      {/* Description */}
      <GlassTextField
        label="Job Description"
        multiline
        rows={4}
        {...register("description")}
        error={!!errors.description}
        helperText={errors.description?.message}
        fullWidth
      />

      {/* Job Position (checkbox list you already had).
          We’ll take the FIRST selected as the canonical job.role */}
      <Box>
        <Typography variant="h6">Job Position</Typography>
        {[
          "Optometrist",
          "Ophthalmologist",
          "Optician",
          "Office Manager",
          "Optometric Tech",
          "Ophthalmic Tech",
          "Surgical Tech",
          "Scribe",
          "Front Desk/Reception",
          "Insurance/Billing",
        ].map((role) => (
          <FormControlLabel
            key={role}
            control={<Checkbox {...register("jobRoles")} value={role} />}
            label={role}
          />
        ))}
      </Box>

      {/* Job Status (hours) */}
      <Box>
        <Typography variant="h6">Job Status</Typography>
        {["Full-time", "Part-time", "Per Diem / Contract"].map((status) => (
          <FormControlLabel
            key={status}
            control={<Checkbox {...register("jobStatus")} value={status} />}
            label={status}
          />
        ))}
      </Box>

      {/* Job Type */}
      <Box>
        <Typography variant="h6">Job Type</Typography>
        {["Leaseholder", "Associate", "Partner", "Employee"].map((type) => (
          <FormControlLabel
            key={type}
            control={<Checkbox {...register("jobType")} value={type} />}
            label={type}
          />
        ))}
      </Box>

      {/* Practice metadata */}
      <GlassTextField
        select
        label="Practice Setting"
        {...register("setting")}
        defaultValue=""
        fullWidth
      >
        {["private", "retail", "hospital", "mobile", "academic"].map((o) => (
          <MenuItem key={o} value={o}>
            {o.charAt(0).toUpperCase() + o.slice(1)}
          </MenuItem>
        ))}
      </GlassTextField>

      <GlassTextField
        select
        label="Chain Affiliation"
        {...register("chainAffiliation")}
        defaultValue=""
        fullWidth
      >
        {["luxottica", "walmart", "visionworks", "other", "none"].map((o) => (
          <MenuItem key={o} value={o}>
            {o.charAt(0).toUpperCase() + o.slice(1)}
          </MenuItem>
        ))}
      </GlassTextField>

      <GlassTextField
        select
        label="Ownership Track"
        {...register("ownershipTrack")}
        defaultValue=""
        fullWidth
      >
        {["none", "potential", "required"].map((o) => (
          <MenuItem key={o} value={o}>
            {o.charAt(0).toUpperCase() + o.slice(1)}
          </MenuItem>
        ))}
      </GlassTextField>

      {/* Salary (structured) */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
        <GlassTextField
          label="Salary Min"
          type="number"
          inputProps={{ min: 0 }}
          {...register("salaryMin")}
          error={!!errors.salaryMin}
          helperText={errors.salaryMin?.message}
          fullWidth
        />
        <GlassTextField
          label="Salary Max"
          type="number"
          inputProps={{ min: 0 }}
          {...register("salaryMax")}
          error={!!errors.salaryMax}
          helperText={errors.salaryMax?.message}
          fullWidth
        />
        <GlassTextField select label="Period" {...register("salaryPeriod")} defaultValue="year" fullWidth>
          {["year", "month", "hour"].map((p) => (
            <MenuItem key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </MenuItem>
          ))}
        </GlassTextField>
      </Box>

      {/* Apply method */}
      <Typography variant="h6" sx={{ mt: 2 }}>
        Apply Method
      </Typography>
      <GlassTextField
        label="Apply URL"
        placeholder="https://…"
        {...register("applyUrl")}
        error={!!errors.applyUrl}
        helperText={errors.applyUrl?.message}
        fullWidth
      />
      <Typography align="center" sx={{ my: 1, opacity: 0.6 }}>— or —</Typography>
      <GlassTextField
        label="Apply Email"
        placeholder="hr@company.com"
        {...register("applyEmail")}
        error={!!errors.applyEmail}
        helperText={errors.applyEmail?.message}
        fullWidth
      />

      {/* Canonical tags (IDs), grouped */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6">Tags</Typography>
        <input type="hidden" {...register("tagIds")} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groupedAllowedTags.map(({ categoryLabel, items }) => (
            <Box key={categoryLabel} sx={{ mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {categoryLabel}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: "8px", ml: 1 }}>
                {items.length === 0 ? (
                  <Typography variant="body2" sx={{ opacity: 0.7, ml: 1 }}>
                    No tags available for this category.
                  </Typography>
                ) : (
                  items.map((t) => {
                    const current = Array.isArray(watch("tagIds")) ? watch("tagIds") : [];
                    const checked = current.includes(t.id);
                    return (
                      <FormControlLabel
                        key={t.id}
                        control={
                          <Checkbox
                            value={t.id}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...current, t.id]
                                : current.filter((x) => x !== t.id);
                              setValue("tagIds", Array.from(new Set(next)), {
                                shouldValidate: true,
                                shouldDirty: true,
                              });
                            }}
                            checked={checked}
                          />
                        }
                        label={t.label}
                      />
                    );
                  })
                )}
              </Box>
            </Box>
          ))}
        </div>
      </Box>
    </>
  );
}
