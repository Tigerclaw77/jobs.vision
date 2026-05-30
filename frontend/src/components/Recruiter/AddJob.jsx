// import React, { useState, useEffect } from "react";
// import { useForm } from "react-hook-form";
// import { yupResolver } from "@hookform/resolvers/yup";
// import * as yup from "yup";

// import {
//   Container,
//   Paper,
//   Typography,
//   FormControlLabel,
//   Checkbox,
//   Button,
//   Box,
// } from "@mui/material";

// import GlassTextField from "../ui/GlassTextField";
// import "../../styles/forms.css";

// import { createJob, updateJob } from "../../utils/api";
// import useDebounce from "../../hooks/useDebounce";
// import JobForm from "./JobForm";

// const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// const schema = yup.object().shape({
//   jobTitle: yup.string().required("Job title is required"),
//   description: yup.string().required("Job description is required"),
//   salary: yup
//     .string()
//     .matches(/^[0-9,.\-\sA-Za-z]+$/, "Invalid salary format")
//     .required("Salary is required"),
//   jobStatus: yup.array().min(1, "Select at least one job status"),
//   jobType: yup.array().min(1, "Select at least one job type"),
//   location: yup.string().required("Location is required unless remote"),
//   templateName: yup.string(),
//   tags: yup.array().of(yup.string()).max(10),
// });

// const AddJob = ({ jobToEdit }) => {
//   const {
//     register,
//     handleSubmit,
//     setValue,
//     watch,
//     formState: { errors },
//   } = useForm({
//     resolver: yupResolver(schema),
//     defaultValues: {
//       jobTitle: "",
//       description: "",
//       salary: "",
//       jobStatus: [],
//       jobType: [],
//       remote: false,
//       inOffice: false,
//       location: "",
//       state: "",
//       latitude: "",
//       longitude: "",
//       saveTemplate: false,
//       templateName: "",
//       setting: "",
//       chainAffiliation: "",
//       ownershipTrack: "",
//       jobRoles: [],
//       tagIds: [],
//     },
//   });

//   const [saveTemplate, setSaveTemplate] = useState(false);
//   const [suggestions, setSuggestions] = useState([]);
//   const [loadingSuggestions, setLoadingSuggestions] = useState(false);

//   const debouncedSearch = useDebounce(async (input) => {
//     if (!input) return setSuggestions([]);
//     setLoadingSuggestions(true);
//     try {
//       const response = await fetch(
//         `https://places.googleapis.com/v1/places:autocomplete?input=${encodeURIComponent(
//           input
//         )}&key=${GOOGLE_MAPS_API_KEY}&languageCode=en`
//       );
//       const data = await response.json();
//       const predictions = data?.suggestions || [];
//       setSuggestions(predictions);
//     } catch (error) {
//       console.error("Error fetching places:", error);
//       setSuggestions([]);
//     } finally {
//       setLoadingSuggestions(false);
//     }
//   }, 500);

//   const handleLocationInputChange = (e) => {
//     const inputValue = e.target.value;
//     setValue("location", inputValue);
//     debouncedSearch(inputValue);
//   };

//   const handleSuggestionSelect = async (suggestion) => {
//     try {
//       const placeId = suggestion.placePrediction.placeId;
//       const detailsResponse = await fetch(
//         `https://places.googleapis.com/v1/places/${placeId}?fields=formattedAddress,location,regionCode&key=${GOOGLE_MAPS_API_KEY}`
//       );
//       const details = await detailsResponse.json();
//       setValue("location", details.formattedAddress || "");
//       setValue("latitude", details.location?.latitude || "");
//       setValue("longitude", details.location?.longitude || "");
//       setValue("state", details.regionCode || "");
//       setSuggestions([]);
//     } catch (error) {
//       console.error("Error getting place details:", error);
//     }
//   };

//   const onSubmit = async (data) => {
//     try {
//       const result = jobToEdit
//         ? await updateJob(jobToEdit._id, { ...data, saveTemplate })
//         : await createJob({ ...data, saveTemplate });

//       alert(jobToEdit ? "Job updated successfully!" : "Job posted successfully!");
//       console.log("✅ Job result:", result);
//     } catch (error) {
//       console.error("❌ Error submitting job:", error.message);
//       alert(error.message);
//     }
//   };

//   useEffect(() => {
//     if (jobToEdit) {
//       const keys = Object.keys(jobToEdit);
//       keys.forEach((key) => {
//         if (jobToEdit[key] !== undefined) {
//           setValue(key, jobToEdit[key]);
//         }
//       });
//     }
//   }, [jobToEdit, setValue]);

//   return (
//     <Container maxWidth="md">
//       <Paper elevation={5} className="glass-form">
//         <Typography variant="h4" align="center" gutterBottom>
//           {jobToEdit ? "Edit Job" : "Post a Job"}
//         </Typography>

//         <form onSubmit={handleSubmit(onSubmit)}>
//           <div className="form-container">
//             <JobForm
//               register={register}
//               errors={errors}
//               watch={watch}
//               setValue={setValue}
//               suggestions={suggestions}
//               loadingSuggestions={loadingSuggestions}
//               handleLocationInputChange={handleLocationInputChange}
//               handleSuggestionSelect={handleSuggestionSelect}
//             />

//             <Box sx={{ marginTop: "20px" }}>
//               <FormControlLabel
//                 control={
//                   <Checkbox
//                     checked={saveTemplate}
//                     onChange={(e) => setSaveTemplate(e.target.checked)}
//                   />
//                 }
//                 label="Save as Template"
//               />

//               {saveTemplate && (
//                 <GlassTextField
//                   label="Template Name"
//                   {...register("templateName")}
//                   fullWidth
//                 />
//               )}
//             </Box>

//             <Button
//               type="submit"
//               variant="contained"
//               className="glass-button"
//               sx={{ marginTop: 2 }}
//             >
//               {jobToEdit ? "Update Job" : "Submit Job"}
//             </Button>
//           </div>
//         </form>
//       </Paper>
//     </Container>
//   );
// };

// export default AddJob;

// import React, { useEffect, useState } from "react";
// import { useForm } from "react-hook-form";
// import { yupResolver } from "@hookform/resolvers/yup";
// import * as yup from "yup";

// import {
//   Container,
//   Paper,
//   Typography,
//   FormControlLabel,
//   Checkbox,
//   Button,
//   Box,
// } from "@mui/material";

// import GlassTextField from "../ui/GlassTextField";
// import "../../styles/forms.css";

// import { createJob, updateJob } from "../../utils/api";
// import useDebounce from "../../hooks/useDebounce";
// import JobForm from "./JobForm";

// const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// /** ---------------- Validation ---------------- */
// const schema = yup.object().shape({
//   // Essentials
//   jobTitle: yup.string().required("Job title is required"),
//   company: yup.string().required("Company is required"),
//   description: yup.string().required("Job description is required"),

//   // Work mode & locations
//   workMode: yup
//     .string()
//     .oneOf(["remote", "hybrid", "onsite"])
//     .required("Work mode is required"),
//   // Keep legacy single location for compatibility; not required when remote
//   location: yup.string().when("workMode", {
//     is: (v) => v !== "remote",
//     then: (s) => s.required("Location is required unless remote"),
//     otherwise: (s) => s.optional(),
//   }),
//   // New multi-location array
//   locations: yup
//     .array()
//     .of(
//       yup.object().shape({
//         label: yup.string().required(),
//         lat: yup.number().nullable(),
//         lng: yup.number().nullable(),
//       })
//     )
//     .test(
//       "loc-required-when-onsite",
//       "At least one location is required for On-site/Hybrid",
//       function (val) {
//         const wm = this.parent.workMode;
//         if (wm === "remote") return true;
//         return Array.isArray(val) && val.length >= 1;
//       }
//     ),

//   // Hours (from your “Job Status”; we normalize later)
//   jobStatus: yup.array().min(1, "Select at least one job status"),

//   // Optional “Job Type”
//   jobType: yup.array().default([]),

//   // Salary (structured; you can enter either/both)
//   salaryMin: yup
//     .number()
//     .typeError("Enter a number")
//     .nullable()
//     .transform((v, o) => (o === "" ? null : v)),
//   salaryMax: yup
//     .number()
//     .typeError("Enter a number")
//     .nullable()
//     .transform((v, o) => (o === "" ? null : v)),
//   salaryPeriod: yup.string().oneOf(["year", "month", "hour"]).default("year"),

//   // Apply method (exactly one)
//   applyUrl: yup
//     .string()
//     .url("Must be a valid URL")
//     .nullable()
//     .transform((v, o) => (o === "" ? null : v)),
//   applyEmail: yup
//     .string()
//     .email("Invalid email")
//     .nullable()
//     .transform((v, o) => (o === "" ? null : v))
//     .test("xor-apply", "Provide either Apply URL or Apply Email (not both)", function (v) {
//       const url = this.parent.applyUrl;
//       if (!url && !v) return this.createError({ message: "Provide Apply URL or Apply Email" });
//       if (url && v) return this.createError({ message: "Only one apply method is allowed" });
//       return true;
//     }),

//   // Tag IDs (canonical)
//   tagIds: yup.array().of(yup.string()).max(10),

//   // Misc extras you already had
//   templateName: yup.string().nullable(),
//   setting: yup.string().nullable(),
//   chainAffiliation: yup.string().nullable(),
//   ownershipTrack: yup.string().nullable(),
//   jobRoles: yup.array().of(yup.string()).default([]),

//   // Legacy hidden fields (kept)
//   state: yup.string().nullable(),
//   latitude: yup.string().nullable(),
//   longitude: yup.string().nullable(),
// });

// const DEFAULTS = {
//   jobTitle: "",
//   company: "",
//   description: "",
//   workMode: "onsite", // default
//   location: "",
//   locations: [], // [{label,lat,lng}]
//   jobStatus: [],
//   jobType: [],
//   salaryMin: "",
//   salaryMax: "",
//   salaryPeriod: "year",
//   applyUrl: "",
//   applyEmail: "",
//   remote: false, // kept for compatibility; not used
//   inOffice: false, // kept for compatibility; not used
//   state: "",
//   latitude: "",
//   longitude: "",
//   saveTemplate: false,
//   templateName: "",
//   setting: "",
//   chainAffiliation: "",
//   ownershipTrack: "",
//   jobRoles: [],
//   tagIds: [],
// };

// export default function AddJob({ jobToEdit }) {
//   const {
//     register,
//     handleSubmit,
//     setValue,
//     watch,
//     reset,
//     formState: { errors },
//   } = useForm({
//     resolver: yupResolver(schema),
//     defaultValues: DEFAULTS,
//   });

//   const [saveTemplate, setSaveTemplate] = useState(false);

//   // -------- Google Places suggestions (for adding locations) --------
//   const [suggestions, setSuggestions] = useState([]);
//   const [loadingSuggestions, setLoadingSuggestions] = useState(false);

//   const debouncedSearch = useDebounce(async (input) => {
//     if (!input) return setSuggestions([]);
//     setLoadingSuggestions(true);
//     try {
//       const response = await fetch(
//         `https://places.googleapis.com/v1/places:autocomplete?input=${encodeURIComponent(
//           input
//         )}&key=${GOOGLE_MAPS_API_KEY}&languageCode=en`
//       );
//       const data = await response.json();
//       setSuggestions(data?.suggestions || []);
//     } catch (error) {
//       console.error("Error fetching places:", error);
//       setSuggestions([]);
//     } finally {
//       setLoadingSuggestions(false);
//     }
//   }, 500);

//   const handleLocationInputChange = (e) => {
//     debouncedSearch(e.target.value);
//     setValue("location", e.target.value, { shouldDirty: true });
//   };

//   const handleSuggestionSelect = async (suggestion) => {
//     try {
//       const placeId = suggestion.placePrediction.placeId;
//       const detailsResponse = await fetch(
//         `https://places.googleapis.com/v1/places/${placeId}?fields=formattedAddress,location,regionCode&key=${GOOGLE_MAPS_API_KEY}`
//       );
//       const details = await detailsResponse.json();

//       const label = details.formattedAddress || "";
//       const lat = details.location?.latitude ?? null;
//       const lng = details.location?.longitude ?? null;

//       // Add to locations[]
//       const list = Array.isArray(watch("locations")) ? [...watch("locations")] : [];
//       list.push({ label, lat, lng });
//       setValue("locations", list, { shouldDirty: true, shouldValidate: true });

//       // Keep legacy single-location fields in sync with first item
//       if (list.length === 1) {
//         setValue("location", label);
//         setValue("latitude", lat ?? "");
//         setValue("longitude", lng ?? "");
//         setValue("state", details.regionCode || "");
//       }

//       setSuggestions([]);
//     } catch (error) {
//       console.error("Error getting place details:", error);
//     }
//   };

//   // If editing, hydrate form
//   useEffect(() => {
//     if (!jobToEdit) {
//       reset(DEFAULTS);
//       return;
//     }
//     const patch = { ...DEFAULTS, ...jobToEdit };
//     // Normalize any stored locations -> [{label,lat,lng}]
//     if (Array.isArray(jobToEdit.locations)) {
//       patch.locations = jobToEdit.locations.map((l) => ({
//         label: l.label || l.location || "",
//         lat: l.lat ?? l.latitude ?? null,
//         lng: l.lng ?? l.longitude ?? null,
//       }));
//     }
//     reset(patch);
//   }, [jobToEdit, reset]);

//   /** ---------- Mapping helpers ---------- */

//   // Normalize first selected Job Status to canonical hours
//   function deriveHours(jobStatusArray) {
//     if (!Array.isArray(jobStatusArray) || jobStatusArray.length === 0) return "";
//     const first = String(jobStatusArray[0]).toLowerCase();
//     if (first.includes("full")) return "full-time";
//     if (first.includes("part")) return "part-time";
//     return "prn";
//   }

//   // Normalize main role (use first selected from your list if multiple)
//   function deriveRole(jobRolesArray) {
//     if (!Array.isArray(jobRolesArray) || jobRolesArray.length === 0) return "optometrist";
//     return String(jobRolesArray[0]).toLowerCase();
//   }

//   function toNumberOrNull(v) {
//     if (v === "" || v == null) return null;
//     const n = Number(v);
//     return Number.isFinite(n) ? n : null;
//   }

//   /** ---------- Submit ---------- */
//   const onSubmit = async (form) => {
//     try {
//       const hours = deriveHours(form.jobStatus);
//       const role = deriveRole(form.jobRoles);

//       const locs = Array.isArray(form.locations) ? form.locations : [];
//       const primary = locs[0] || {
//         label: form.location || "",
//         lat: form.latitude ? Number(form.latitude) : null,
//         lng: form.longitude ? Number(form.longitude) : null,
//       };

//       const payload = {
//         // canonical job fields your list/modal already expect
//         title: form.jobTitle,
//         company: form.company,
//         role,
//         hours,
//         description: form.description,

//         workMode: form.workMode, // remote | hybrid | onsite

//         // keep legacy single-location AND new multi-location
//         location: primary.label || "",
//         latitude: primary.lat,
//         longitude: primary.lng,
//         locations: locs, // [{label,lat,lng}]

//         // salary
//         salaryMin: toNumberOrNull(form.salaryMin),
//         salaryMax: toNumberOrNull(form.salaryMax),
//         salaryPeriod: form.salaryPeriod || "year",

//         // tags
//         tags: Array.isArray(form.tagIds) ? form.tagIds : [],

//         // apply
//         applyUrl: form.applyUrl || null,
//         applyEmail: form.applyEmail || null,

//         // extras you already store
//         jobType: form.jobType || [],
//         setting: form.setting || "",
//         chainAffiliation: form.chainAffiliation || "",
//         ownershipTrack: form.ownershipTrack || "",
//         // keep for back-compat if your API wants them
//         state: form.state || "",
//       };

//       const result = jobToEdit
//         ? await updateJob(jobToEdit._id, { ...payload, saveTemplate })
//         : await createJob({ ...payload, saveTemplate });

//       alert(jobToEdit ? "Job updated successfully!" : "Job posted successfully!");
//       console.log("✅ Job result:", result);
//       if (!jobToEdit) reset(DEFAULTS);
//     } catch (error) {
//       console.error("❌ Error submitting job:", error);
//       alert(error.message || "Failed to submit job");
//     }
//   };

//   return (
//     <Container maxWidth="md">
//       <Paper elevation={5} className="glass-form">
//         <Typography variant="h4" align="center" gutterBottom>
//           {jobToEdit ? "Edit Job" : "Post a Job"}
//         </Typography>

//         <form onSubmit={handleSubmit(onSubmit)}>
//           <div className="form-container">
//             <JobForm
//               register={register}
//               errors={errors}
//               watch={watch}
//               setValue={setValue}
//               suggestions={suggestions}
//               loadingSuggestions={loadingSuggestions}
//               handleLocationInputChange={handleLocationInputChange}
//               handleSuggestionSelect={handleSuggestionSelect}
//             />

//             <Box sx={{ marginTop: "20px" }}>
//               <FormControlLabel
//                 control={
//                   <Checkbox
//                     checked={saveTemplate}
//                     onChange={(e) => setSaveTemplate(e.target.checked)}
//                   />
//                 }
//                 label="Save as Template"
//               />
//               {saveTemplate && (
//                 <GlassTextField
//                   label="Template Name"
//                   {...register("templateName")}
//                   fullWidth
//                 />
//               )}
//             </Box>

//             <Button
//               type="submit"
//               variant="contained"
//               className="glass-button"
//               sx={{ marginTop: 2 }}
//             >
//               {jobToEdit ? "Update Job" : "Submit Job"}
//             </Button>
//           </div>
//         </form>
//       </Paper>
//     </Container>
//   );
// }

import React from "react";
import JobForm from "../JobForm"; // adjust path if needed

export default function AddJobPage() {
  return <JobForm />;
}
