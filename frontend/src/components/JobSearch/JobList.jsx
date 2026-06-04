// src/components/JobSearch/JobList.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createStripeCheckout } from "../../utils/api";
import { useEffectiveAuth } from "../auth/useEffectiveAuth";

import {
  fetchJobs,
  addJobToFavorites,
  applyToJob,
  hideJob as hideJobPreference,
  unhideJob as unhideJobPreference,
  getUserJobInteractions,
} from "../../utils/api.supabase";

import JobFilter from "./JobFilter";
import JobCard from "./JobCard";
import JobModal from "./JobModal";
import JobMap from "./JobMap";
import Pagination from "./Pagination";

import { buildLookupFromJobs, smartParseQuery } from "../../utils/smartParseQuery";
import {
  EMPLOYMENT_TYPE_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  PRACTICE_TYPE_LABELS,
  ROLE_LABELS,
  WORK_ARRANGEMENT_LABELS,
  normalizeMultiValue,
  normalizeRole,
  normalizeToken,
} from "../../utils/jobTaxonomy";
import "../../styles/jobSearch.css";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const PAGE_SIZE = 12;
const FREE_SAVE_LIMIT = 5;
let googleMapsPromise;

// ---------- helpers ----------
function haversineMi(a, b) {
  if (!a || !b) return Infinity;
  const R = 3958.8; // miles
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function finitePoint(lat, lng) {
  if (lat == null || lng == null || lat === "" || lng === "") return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  return { lat: nLat, lng: nLng };
}
function locationKey(location = "") {
  return normalizeLocationText(location);
}
function collapseLocationInput(location = "") {
  return String(location).replace(/\s+/g, " ");
}
function cleanLocationInput(location = "") {
  return collapseLocationInput(location).trim();
}
function normalizeLocationText(location = "") {
  return cleanLocationInput(location).toLowerCase();
}
function getJobLocationText(job = {}) {
  return [
    job.location,
    [job.city, job.state].filter(Boolean).join(", "),
    job.city,
    job.state,
  ]
    .filter(Boolean)
    .map(normalizeLocationText)
    .filter(Boolean)
    .join(" ");
}
function getJobPosition(job, geocodedLocations = {}) {
  const direct = finitePoint(job?.latitude ?? job?.lat, job?.longitude ?? job?.lng);
  if (direct) return direct;

  const key = locationKey(job?.location);
  return key ? geocodedLocations[key] || null : null;
}
function loadGoogleMaps(apiKey) {
  if (!apiKey) return Promise.reject(new Error("Google Maps API key is not configured."));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const id = "googleMaps";
    const existing = document.getElementById(id);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google.maps), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error("Google Maps failed to load."));
    document.body.appendChild(script);
  });

  return googleMapsPromise;
}
async function geocodeAddress(address, apiKey) {
  const maps = await loadGoogleMaps(apiKey);
  const geocoder = new maps.Geocoder();
  return new Promise((resolve, reject) => {
    geocoder.geocode(
      { address, componentRestrictions: { country: "US" } },
      (results, status) => {
        const location = results?.[0]?.geometry?.location;
        if (status === "OK" && location) {
          resolve({ lat: location.lat(), lng: location.lng() });
          return;
        }
        reject(new Error(`Unable to geocode location: ${status}`));
      }
    );
  });
}
const TYPE_LABEL = EMPLOYMENT_TYPE_LABELS;
const OPPORTUNITY_TYPE_LABEL = OPPORTUNITY_TYPE_LABELS;
const PRACTICE_TYPE_LABEL = PRACTICE_TYPE_LABELS;
const WORK_ARRANGEMENT_LABEL = WORK_ARRANGEMENT_LABELS;
const titleCase = (s = "") =>
  String(s)
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
const normalizeType = normalizeToken;
const normalizeFilterArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};
const normalizeRoleFilters = (value) =>
  normalizeFilterArray(value)
    .map((item) => normalizeRole(item) || item)
    .filter(Boolean);
const includesOptometristRole = (value) => normalizeRoleFilters(value).includes("optometrist");

function jobValues(job, pluralField, singularField, fallbackField = null) {
  return normalizeMultiValue(
    job?.[pluralField] || job?.[singularField] || (fallbackField ? job?.[fallbackField] : null),
    normalizeType
  );
}

function hasUnlimitedCandidateSaves(user, userRole) {
  if (String(userRole || "").toLowerCase() === "admin") return true;
  const candidate = user?.entitlements?.candidate;
  if (candidate?.features?.unlimitedSaves === true) return true;

  const values = [user?.tier, candidate?.tier, candidate?.plan]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return values.some((value) =>
    ["plus", "premium", "candidate_plus", "candidate_premium"].includes(value)
  );
}

// ---------- filters ----------
const DEFAULT_FILTERS = {
  q: "",
  location: "",
  lat: null,
  lng: null,
  radiusMi: 25,
  roles: [],
  employmentTypes: [],
  workArrangements: [],
  opportunityTypes: [],
  practiceTypes: [],
  company: "",
  showHiddenJobs: false,
};

const ARRAY_FILTER_KEYS = new Set([
  "roles",
  "employmentTypes",
  "workArrangements",
  "opportunityTypes",
  "practiceTypes",
]);

function searchParamsForFilters(filters, sort, page) {
  const params = {};
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (key === "showHiddenJobs") {
      if (value === true) params[key] = "1";
      return;
    }
    if (Array.isArray(value)) {
      if (value.length) params[key] = value.join(",");
      return;
    }
    const serializedValue = key === "location" ? collapseLocationInput(value) : value;
    if (serializedValue == null) return;
    if (key === "location" && cleanLocationInput(serializedValue) === "") return;
    if (serializedValue === "") return;
    params[key] = String(serializedValue);
  });
  params.sort = sort || "newest";
  params.page = String(page || 1);
  return params;
}

function filtersFromSearchParams(searchParams) {
  const initial = Object.fromEntries([...searchParams.entries()]);
  delete initial.page;
  delete initial.sort;

  const next = { ...DEFAULT_FILTERS };
  Object.entries(initial).forEach(([key, value]) => {
    if (key === "roles") {
      next.roles = normalizeRoleFilters(value);
    } else if (ARRAY_FILTER_KEYS.has(key)) {
      next[key] = normalizeFilterArray(value);
    } else if (key === "role") {
      next.roles = normalizeRoleFilters(value);
    } else if (key === "type") {
      next.employmentTypes = normalizeFilterArray(value);
    } else if (key === "location") {
      next.location = collapseLocationInput(value);
    } else if (key === "showHiddenJobs") {
      next.showHiddenJobs = value === "1" || value === "true";
    } else if (key !== "hours") {
      next[key] = value;
    }
  });
  if (!includesOptometristRole(next.roles)) {
    next.opportunityTypes = [];
  }

  return next;
}

export default function JobList() {
  const effectiveAuth = useEffectiveAuth();
  const authUser = effectiveAuth.user;
  const userRole = String(authUser?.userRole || effectiveAuth.role || "").toLowerCase();
  const isCandidateUser = userRole === "candidate";
  const canUseMapSearch =
    userRole === "admin" || authUser?.entitlements?.candidate?.features?.mapSearch === true;

  // data
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [fetchError, setFetchError] = useState("");
  const [jobLocationCoords, setJobLocationCoords] = useState({});
  const [geocodeStatus, setGeocodeStatus] = useState("idle");
  const [geocodeMessage, setGeocodeMessage] = useState("");

  // filters & query state
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState("newest");
  const [searchParams, setSearchParams] = useSearchParams();
  const debounceRef = useRef(null);

  // interactions
  const [favorites, setFavorites] = useState(new Set());
  const [appliedJobs, setAppliedJobs] = useState(new Set());
  const [hiddenJobs, setHiddenJobs] = useState(new Set());
  const isAuthed = effectiveAuth.isAuthenticated;

  // UI
  const [selectedJob, setSelectedJob] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const hasUnlimitedSaves = hasUnlimitedCandidateSaves(authUser, userRole);
  const saveSlotsRemaining = hasUnlimitedSaves
    ? null
    : Math.max(0, FREE_SAVE_LIMIT - favorites.size);

  // parse URL
  useEffect(() => {
    setFilters(filtersFromSearchParams(searchParams));
    setSort(searchParams.get("sort") || "newest");
  }, [searchParams]);

  // load jobs
  useEffect(() => {
    const load = async () => {
      setFetchError("");
      try {
        const list = await fetchJobs();
        setJobs(list || []);
        setFilteredJobs(list || []);
      } catch (err) {
        console.error("fetchJobs failed:", err);
        setFetchError(err?.message || "Failed to fetch jobs");
        setJobs([]);
        setFilteredJobs([]);
      }
    };
    load();
  }, []);

  useEffect(() => {
  document.body.classList.add('dim-bg');
  return () => document.body.classList.remove('dim-bg');
}, []);

  const updateFilters = (nextFilters) => {
    const normalizedFilters = { ...nextFilters };
    if ("roles" in normalizedFilters) {
      normalizedFilters.roles = normalizeRoleFilters(normalizedFilters.roles);
      if (!includesOptometristRole(normalizedFilters.roles)) {
        normalizedFilters.opportunityTypes = [];
      }
    }
    if ("location" in normalizedFilters) {
      const nextLocation = collapseLocationInput(normalizedFilters.location);
      const previousLocation = cleanLocationInput(filters.location);
      normalizedFilters.location = nextLocation;
      if (normalizeLocationText(nextLocation) !== normalizeLocationText(previousLocation)) {
        normalizedFilters.lat = null;
        normalizedFilters.lng = null;
      }
    }
    setFilters(normalizedFilters);
    setSearchParams(searchParamsForFilters(normalizedFilters, sort, 1), { replace: true });
  };


  // interactions load
  useEffect(() => {
    const load = async () => {
      try {
        const { favorites, appliedJobs, hiddenJobs } = await getUserJobInteractions();
        setFavorites(new Set(favorites || []));
        setAppliedJobs(new Set(appliedJobs || []));
        setHiddenJobs(new Set(hiddenJobs || []));
      } catch {}
    };
    load();
  }, []);

  // lookup from current jobs
  const lookup = useMemo(() => buildLookupFromJobs(jobs), [jobs]);
  const searchCenter = useMemo(
    () => finitePoint(filters.lat, filters.lng),
    [filters.lat, filters.lng]
  );
  const canBuyCandidateMapPlan = isAuthed && isCandidateUser;
  const displayLocation = cleanLocationInput(filters.location);
  const normalizedLocation = normalizeLocationText(filters.location);
  const hasLocationText = Boolean(normalizedLocation);
  const hasActiveRadius =
    canUseMapSearch && hasLocationText && geocodeStatus === "success" && Boolean(searchCenter);
  const shouldFitMapToJobs = useMemo(() => {
    const hasArrayFilter = [
      filters.roles,
      filters.employmentTypes,
      filters.workArrangements,
      filters.opportunityTypes,
      filters.practiceTypes,
    ].some((value) => normalizeFilterArray(value).length > 0);

    return Boolean(
      cleanLocationInput(filters.q) ||
        cleanLocationInput(filters.company) ||
        cleanLocationInput(filters.location) ||
        hasArrayFilter
    );
  }, [filters]);

  // SMART PARSE: convert free-text into filter fields; keep leftovers in q
  useEffect(() => {
    if (!filters.q) return;
    const { result } = smartParseQuery(filters.q, lookup);
    setFilters((prev) => {
      const next = { ...prev };
      if (!prev.roles?.length && result.role) next.roles = [result.role];
      if (!prev.employmentTypes?.length && result.hours) {
        const parsedType = normalizeType(result.hours);
        if (TYPE_LABEL[parsedType]) next.employmentTypes = [parsedType];
      }
      if (!prev.company && result.company) next.company = result.company;
      if (!prev.location && result.location) next.location = result.location;
      // keep only leftovers in the search box
      if (typeof result.qClean === "string") next.q = result.qClean;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, lookup]);

  useEffect(() => {
    if (!canUseMapSearch) {
      setGeocodeStatus("idle");
      setGeocodeMessage("");
      return;
    }

    const location = cleanLocationInput(filters.location);
    if (!location) {
      setGeocodeStatus("idle");
      setGeocodeMessage("");
      if (filters.lat != null || filters.lng != null) {
        setFilters((prev) => ({ ...prev, lat: null, lng: null }));
      }
      return;
    }
    if (finitePoint(filters.lat, filters.lng)) {
      setGeocodeStatus("success");
      setGeocodeMessage(`Location found: ${location}`);
      return;
    }

    let cancelled = false;
    setGeocodeStatus("searching");
    setGeocodeMessage(`Locating ${location}...`);
    const timeout = setTimeout(async () => {
      try {
        const point = await geocodeAddress(location, GOOGLE_MAPS_API_KEY);
        if (cancelled) return;
        setGeocodeStatus("success");
        setGeocodeMessage(`Location found: ${location}`);
        setFilters((prev) => {
          if (normalizeLocationText(prev.location) !== normalizeLocationText(location)) {
            return prev;
          }
          return { ...prev, location, lat: point.lat, lng: point.lng };
        });
      } catch (err) {
        if (!cancelled) {
          console.warn(err?.message || err);
          setGeocodeStatus("failed");
          setGeocodeMessage(`Could not locate ${location}. Showing text matches only.`);
          setFilters((prev) => {
            if (normalizeLocationText(prev.location) !== normalizeLocationText(location)) {
              return prev;
            }
            return { ...prev, lat: null, lng: null };
          });
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [canUseMapSearch, filters.location, filters.lat, filters.lng]);

  useEffect(() => {
    if (!canUseMapSearch || !hasActiveRadius) return;

    const missing = (jobs || [])
      .filter((job) => !finitePoint(job?.latitude ?? job?.lat, job?.longitude ?? job?.lng))
      .map((job) => job?.location)
      .map(locationKey)
      .filter(Boolean)
      .filter((key, index, list) => list.indexOf(key) === index)
      .filter((key) => !jobLocationCoords[key]);

    if (!missing.length) return;

    let cancelled = false;
    (async () => {
      const next = {};
      for (const key of missing) {
        try {
          next[key] = await geocodeAddress(key, GOOGLE_MAPS_API_KEY);
        } catch (err) {
          console.warn(err?.message || err);
        }
        if (cancelled) return;
      }
      if (!cancelled && Object.keys(next).length) {
        setJobLocationCoords((prev) => ({ ...prev, ...next }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobs, canUseMapSearch, hasActiveRadius, jobLocationCoords]);

  // chips are derived from persistent filters (so they don't vanish while typing)
  const quickTags = useMemo(() => {
    const tags = [];
    if (filters.company) {
      const lower = String(filters.company).toLowerCase();
      const label = lookup.companies.get(lower) || titleCase(filters.company);
      tags.push({ type: "company", value: lower, label });
    }
    normalizeFilterArray(filters.roles).forEach((value) => {
      const roleValue = normalizeRole(value) || value;
      tags.push({ type: "roles", value: roleValue, label: ROLE_LABELS[roleValue] || titleCase(roleValue) });
    });
    normalizeFilterArray(filters.employmentTypes).forEach((value) => {
      tags.push({
        type: "employmentTypes",
        value,
        label: TYPE_LABEL[normalizeType(value)] || titleCase(value.replace(/_/g, " ")),
      });
    });
    normalizeFilterArray(filters.opportunityTypes).forEach((value) => {
      tags.push({
        type: "opportunityTypes",
        value,
        label:
          OPPORTUNITY_TYPE_LABEL[normalizeType(value)] ||
          titleCase(value.replace(/_/g, " ")),
      });
    });
    normalizeFilterArray(filters.workArrangements).forEach((value) => {
      tags.push({
        type: "workArrangements",
        value,
        label:
          WORK_ARRANGEMENT_LABEL[normalizeType(value)] ||
          titleCase(value.replace(/_/g, " ")),
      });
    });
    normalizeFilterArray(filters.practiceTypes).forEach((value) => {
      tags.push({
        type: "practiceTypes",
        value,
        label:
          PRACTICE_TYPE_LABEL[normalizeType(value)] ||
          titleCase(value.replace(/_/g, " ")),
      });
    });
    if (filters.location) {
      tags.push({
        type: "location",
        value: normalizeLocationText(filters.location),
        label: titleCase(cleanLocationInput(filters.location)),
      });
    }
    return tags;
  }, [filters, lookup]);

  // filtering (debounced)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const {
        q = "",
        roles = [],
        employmentTypes = [],
        workArrangements = [],
        opportunityTypes = [],
        practiceTypes = [],
        location = "",
        company = "",
        lat,
        lng,
        radiusMi = 25,
        showHiddenJobs = false,
      } = filters;
      const center = finitePoint(lat, lng);
      const locationText = normalizeLocationText(location);
      const locationRadiusActive =
        canUseMapSearch && geocodeStatus === "success" && Boolean(locationText && center);
      const qLower = q.trim().toLowerCase();
      const employmentSet = new Set(normalizeFilterArray(employmentTypes).map(normalizeType));
      const workArrangementSet = new Set(normalizeFilterArray(workArrangements).map(normalizeType));
      const practiceSet = new Set(normalizeFilterArray(practiceTypes).map(normalizeType));
      const roleSet = new Set(
        normalizeRoleFilters(roles)
      );
      const opportunitySet = roleSet.has("optometrist")
        ? new Set(normalizeFilterArray(opportunityTypes).map(normalizeType))
        : new Set();

      const next = (jobs || []).filter((job) => {
        const jobId = String(job._id || job.id || "");
        if (jobId && hiddenJobs.has(jobId) && !showHiddenJobs) return false;
        const roleValue = normalizeRole(job.role) || String(job.role || "").toLowerCase();
        const employmentValues = jobValues(job, "employment_types", "employment_type", "type");
        const workArrangementValues = jobValues(job, "work_arrangements", "work_arrangement");
        const opportunityValues = jobValues(job, "opportunity_types", "opportunity_type");

        const hay = [
          job.title,
          job.company,
          job.description,
          ROLE_LABELS[roleValue],
          roleValue,
          job.type,
          ...employmentValues,
          ...employmentValues.map((value) => TYPE_LABEL[value]),
          ...workArrangementValues,
          ...workArrangementValues.map((value) => WORK_ARRANGEMENT_LABEL[value]),
          ...opportunityValues,
          ...opportunityValues.map((value) => OPPORTUNITY_TYPE_LABEL[value]),
          job.practice_type,
          PRACTICE_TYPE_LABEL[normalizeType(job.practice_type)],
          job.location,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchQ = !qLower || hay.includes(qLower);
        const matchRole = roleSet.size === 0 || roleSet.has(roleValue);
        const matchEmployment =
          employmentSet.size === 0 || employmentValues.some((value) => employmentSet.has(value));
        const matchWorkArrangement =
          workArrangementSet.size === 0 ||
          workArrangementValues.some((value) => workArrangementSet.has(value));
        const matchOpportunity =
          opportunitySet.size === 0 || opportunityValues.some((value) => opportunitySet.has(value));
        const matchPractice =
          practiceSet.size === 0 || practiceSet.has(normalizeType(job.practice_type));
        const matchCompany =
          !company || (job.company || "").toLowerCase().includes(String(company).toLowerCase());
        const matchLocText =
          !locationText ||
          locationRadiusActive ||
          getJobLocationText(job).includes(locationText);

        let matchRadius = true;
        if (locationRadiusActive) {
          const jobPosition = getJobPosition(job, jobLocationCoords);
          matchRadius = jobPosition
            ? haversineMi(center, jobPosition) <= Number(radiusMi || 25)
            : false;
        }

        return (
          matchQ &&
          matchRole &&
          matchEmployment &&
          matchWorkArrangement &&
          matchOpportunity &&
          matchPractice &&
          matchCompany &&
          matchLocText &&
          matchRadius
        );
      });

      setFilteredJobs(next);
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [filters, jobs, canUseMapSearch, geocodeStatus, jobLocationCoords, hiddenJobs]);

  // pagination
  const page = parseInt(searchParams.get("page") || "1", 10);
  const paginated = filteredJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil((filteredJobs.length || 0) / PAGE_SIZE));
  const radiusMiles = Number(filters.radiusMi || 25);
  const jobsNoun = filteredJobs.length === 1 ? "job" : "jobs";
  const resultCountText =
    hasLocationText && canUseMapSearch && geocodeStatus === "success"
      ? `${filteredJobs.length} ${jobsNoun} found within ${radiusMiles} miles`
      : `${filteredJobs.length} ${jobsNoun} found`;
  const noFilteredJobsMessage = hasLocationText
    ? `No jobs found within ${radiusMiles} miles of ${displayLocation || "that location"}`
    : "No jobs match your filters.";
  const mapEmptyMessage =
    !fetchError && jobs.length > 0 && filteredJobs.length === 0 ? noFilteredJobsMessage : "";
  const mapJobs = useMemo(
    () =>
      filteredJobs.map((job) => ({
        ...job,
        isApplied: appliedJobs.has(job._id),
        isFavorite: favorites.has(job._id),
        isHidden: hiddenJobs.has(job._id),
      })),
    [filteredJobs, appliedJobs, favorites, hiddenJobs]
  );

  // chips: remove one -> clear the corresponding filter (do NOT put it back in q)
const removeQuickTag = (tag) => {
  const next = { ...filters };
  if (tag.type === "company")  next.company  = "";
  if (ARRAY_FILTER_KEYS.has(tag.type)) {
    next[tag.type] = normalizeFilterArray(next[tag.type]).filter(
      (value) => value !== tag.value
    );
  }
  if (tag.type === "location") {
    next.location = "";
    next.lat = null;
    next.lng = null;
  }
  updateFilters(next);
};


  const requireAuth = (message) => {
    const go = window.confirm(message || "Please sign in to continue. Go to Sign In?");
    if (go) window.location.assign("/login");
  };

  const savedTooltipFor = (jobId) => {
    if (!isAuthed) return "Register or log in to save";
    if (favorites.has(jobId)) return "Remove saved job";
    if (hasUnlimitedSaves) return "Save job? Unlimited saves";
    if (saveSlotsRemaining <= 0) {
      return "Save slots full \u2014 upgrade for unlimited saves";
    }
    return `Save job? ${saveSlotsRemaining} slot${saveSlotsRemaining === 1 ? "" : "s"} remaining`;
  };

  const appliedTooltipFor = (jobId) => {
    return appliedJobs.has(jobId) ? "Already applied" : "Apply to this job";
  };

  const hideTooltipFor = () => {
    return isAuthed ? "Hide job" : "Register or log in to hide jobs";
  };

  const restoreTooltipFor = () => {
    return isAuthed ? "Restore job" : "Register or log in to restore jobs";
  };

  const handleFavorite = async (jobId) => {
    if (!isAuthed) return requireAuth("Register or log in to save. Go to Login?");
    const wasFavorite = favorites.has(jobId);
    if (!wasFavorite && !hasUnlimitedSaves && saveSlotsRemaining <= 0) {
      alert("Save slots full - upgrade for unlimited saves.");
      return;
    }

    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(jobId) ? next.delete(jobId) : next.add(jobId);
      return next;
    });
    try {
      const result = await addJobToFavorites(jobId);
      setFavorites((prev) => {
        const next = new Set(prev);
        result.added ? next.add(jobId) : next.delete(jobId);
        return next;
      });
    } catch (error) {
      setFavorites((prev) => {
        const next = new Set(prev);
        wasFavorite ? next.add(jobId) : next.delete(jobId);
        return next;
      });
      alert(error?.message || "Couldn't save this. Try again.");
    }
  };

  const handleApply = async (jobId) => {
    if (!isAuthed) return requireAuth("Please sign in to apply for jobs. Go to Sign In?");
    if (appliedJobs.has(jobId)) return;
    try {
      await applyToJob(jobId);
      setAppliedJobs((prev) => new Set(prev).add(jobId));
    } catch (error) {
      if (error?.message) {
        alert(error.message);
        return;
      }
      alert("We couldn’t submit your application. Please try again.");
    }
  };

  const handleHideJob = async (jobId) => {
    if (!isAuthed) return requireAuth("Register or log in to hide jobs. Go to Login?");

    const normalizedId = String(jobId);
    const wasHidden = hiddenJobs.has(normalizedId);
    const previousSelectedJob = selectedJob;
    const previousModalOpen = isModalOpen;

    setHiddenJobs((prev) => {
      const next = new Set(prev);
      next.add(normalizedId);
      return next;
    });

    if (selectedJob && String(selectedJob._id) === normalizedId) {
      setSelectedJob(null);
      setIsModalOpen(false);
    }

    try {
      await hideJobPreference(normalizedId);
    } catch (error) {
      setHiddenJobs((prev) => {
        const next = new Set(prev);
        if (wasHidden) next.add(normalizedId);
        else next.delete(normalizedId);
        return next;
      });
      setSelectedJob(previousSelectedJob);
      setIsModalOpen(previousModalOpen);
      alert(error?.message || "We couldn't update this job. Please try again.");
    }
  };

  const handleRestoreJob = async (jobId) => {
    if (!isAuthed) return requireAuth("Register or log in to restore jobs. Go to Login?");

    const normalizedId = String(jobId);
    const wasHidden = hiddenJobs.has(normalizedId);

    setHiddenJobs((prev) => {
      const next = new Set(prev);
      next.delete(normalizedId);
      return next;
    });

    try {
      await unhideJobPreference(normalizedId);
    } catch (error) {
      setHiddenJobs((prev) => {
        const next = new Set(prev);
        if (wasHidden) next.add(normalizedId);
        return next;
      });
      alert(error?.message || "We couldn't update this job. Please try again.");
    }
  };

  const handleCandidateUpgrade = async (planKey) => {
    setCheckoutError("");
    setCheckoutLoading(planKey);
    try {
      const checkout = await createStripeCheckout(planKey);
      if (!checkout?.url) throw new Error("Checkout URL was not returned.");
      window.location.assign(checkout.url);
    } catch (error) {
      setCheckoutError(error?.response?.data?.error || error?.message || "Unable to open checkout.");
      setCheckoutLoading("");
    }
  };

  return (
    <div className="jobs-page jobsearch-scope">
      <h2>Available Jobs</h2>

      {/* FILTER + MAP */}
      <div className="jobs-top">
        <div className="filters-panel">
          <JobFilter
            filters={filters}
            onFilterChange={updateFilters}
            onClear={() => updateFilters(DEFAULT_FILTERS)}
            quickTags={quickTags}
            onRemoveQuickTag={removeQuickTag}
            canUseMapSearch={canUseMapSearch}
            geocodeStatus={geocodeStatus}
            geocodeMessage={geocodeMessage}
          />
        </div>

        <div className="map-card">
          <div className={`job-map-inner top ${canUseMapSearch ? "" : "map-locked"}`}>
            <div className="map-canvas-layer" aria-hidden={!canUseMapSearch}>
              <JobMap
                jobs={mapJobs}
                showMap={true}
                apiKey={GOOGLE_MAPS_API_KEY}
                searchCenter={searchCenter}
                radiusMi={filters.radiusMi}
                hasActiveRadius={hasActiveRadius}
                fitToJobs={shouldFitMapToJobs}
                emptyMessage={mapEmptyMessage}
                onMarkerClick={
                  canUseMapSearch
                    ? (job) => {
                        setSelectedJob(job);
                        setIsModalOpen(true);
                      }
                    : undefined
                }
              />
            </div>

            {!canUseMapSearch && (
              <div className="map-paywall-overlay">
                <div className="map-paywall-content">
                  <h3>Advanced Map Search</h3>
                  <p>Search jobs geographically with Candidate Plus or Premium.</p>

                  {canBuyCandidateMapPlan ? (
                    <div className="map-paywall-actions">
                      <button
                        type="button"
                        onClick={() => handleCandidateUpgrade("plus")}
                        disabled={Boolean(checkoutLoading)}
                      >
                        {checkoutLoading === "plus"
                          ? "Opening..."
                          : "Upgrade to Plus ($20/mo)"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCandidateUpgrade("premium")}
                        disabled={Boolean(checkoutLoading)}
                      >
                        {checkoutLoading === "premium"
                          ? "Opening..."
                          : "Upgrade to Premium ($50/mo)"}
                      </button>
                    </div>
                  ) : isAuthed ? (
                    <div className="map-paywall-info">
                      <span>Plus: $20/mo includes map search</span>
                      <span>Premium: $50/mo includes map search and priority visibility</span>
                    </div>
                  ) : (
                    <>
                      <div className="map-paywall-actions">
                        <Link to="/candidate/register">Register Free Account</Link>
                      </div>
                      <div className="map-paywall-info">
                        <span>Plus: $20/mo includes map search</span>
                        <span>Premium: $50/mo includes map search and priority visibility</span>
                      </div>
                    </>
                  )}

                  {checkoutError && <p className="map-paywall-error">{checkoutError}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CARDS */}
      {!fetchError && (
        <div className="jobs-result-summary" role="status" aria-live="polite">
          {geocodeStatus === "searching" ? geocodeMessage : resultCountText}
        </div>
      )}

      <div className="job-cards">
        {paginated.length ? (
          paginated.map((job) => (
            <JobCard
              key={job._id}
              job={job}
              isFavorite={favorites.has(job._id)}
              isApplied={appliedJobs.has(job._id)}
              isHidden={hiddenJobs.has(job._id)}
              savedTooltip={savedTooltipFor(job._id)}
              appliedTooltip={appliedTooltipFor(job._id)}
              hideTooltip={hideTooltipFor(job._id)}
              restoreTooltip={restoreTooltipFor(job._id)}
              onFavoriteClick={handleFavorite}
              onApplyClick={handleApply}
              onHideClick={handleHideJob}
              onRestoreClick={handleRestoreJob}
              onClick={() => {
                setSelectedJob(job);
                setIsModalOpen(true);
              }}
            />
          ))
        ) : (
          <div
            style={{
              padding: "14px 12px",
              borderRadius: 12,
              background: "rgba(20,22,28,0.55)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#cdd6f4",
            }}
          >
            {fetchError
              ? `Failed to load jobs: ${fetchError}`
              : jobs.length === 0
              ? "No jobs available."
              : noFilteredJobsMessage}
          </div>
        )}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(newPage) =>
          setSearchParams(searchParamsForFilters(filters, sort, newPage))
        }
      />

      <JobModal
        isOpen={isModalOpen && !!selectedJob}
        job={selectedJob}
        isFavorite={selectedJob && favorites.has(selectedJob._id)}
        isApplied={selectedJob && appliedJobs.has(selectedJob._id)}
        isHidden={selectedJob && hiddenJobs.has(selectedJob._id)}
        savedTooltip={selectedJob ? savedTooltipFor(selectedJob._id) : ""}
        appliedTooltip={selectedJob ? appliedTooltipFor(selectedJob._id) : ""}
        onFavoriteClick={handleFavorite}
        onApply={handleApply}
        onHide={handleHideJob}
        onRestore={handleRestoreJob}
        onClose={() => {
          setSelectedJob(null);
          setIsModalOpen(false);
        }}
        isAuthed={isAuthed}
      />
    </div>
  );
}
