// src/components/JobSearch/JobList.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import { getNeonUser, neonAuth } from "../../utils/neonAuthClient";
import { createStripeCheckout } from "../../utils/api";

import {
  fetchJobs,
  addJobToFavorites,
  applyToJob,
  getUserJobInteractions,
} from "../../utils/api.supabase";

import JobFilter from "./JobFilter";
import JobCard from "./JobCard";
import JobModal from "./JobModal";
import JobMap from "./JobMap";
import Pagination from "./Pagination";

import { buildLookupFromJobs, smartParseQuery } from "../../utils/smartParseQuery";
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
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  return { lat: nLat, lng: nLng };
}
function locationKey(location = "") {
  return String(location).trim().toLowerCase();
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
const TYPE_LABEL = {
  full_time: "Full-time",
  part_time: "Part-time",
  remote: "Remote",
};
const OPPORTUNITY_TYPE_LABEL = {
  associate_position: "Associate Position",
  lease_opportunity: "Lease Opportunity",
  ownership_track: "Ownership Track",
};
const PRACTICE_TYPE_LABEL = {
  private_practice: "Private Practice",
  corporate: "Corporate",
  od_md: "OD/MD",
};
const titleCase = (s = "") =>
  String(s)
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
const normalizeType = (value = "") => String(value).trim().toLowerCase().replace(/-/g, "_");
const normalizeFilterArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

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
  role: "",
  employmentTypes: [],
  opportunityTypes: [],
  practiceTypes: [],
  company: "",
};

const ARRAY_FILTER_KEYS = new Set([
  "employmentTypes",
  "opportunityTypes",
  "practiceTypes",
]);

function searchParamsForFilters(filters, sort, page) {
  const params = {};
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) params[key] = value.join(",");
      return;
    }
    if (value === "" || value == null) return;
    params[key] = String(value);
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
    if (ARRAY_FILTER_KEYS.has(key)) {
      next[key] = normalizeFilterArray(value);
    } else if (key === "type") {
      next.employmentTypes = normalizeFilterArray(value);
    } else if (key !== "hours") {
      next[key] = value;
    }
  });

  return next;
}

export default function JobList() {
  const authUser = useSelector((state) => state.auth.user);
  const userRole = String(authUser?.userRole || "").toLowerCase();
  const isCandidateUser = userRole === "candidate";
  const canUseMapSearch =
    userRole === "admin" || authUser?.entitlements?.candidate?.features?.mapSearch === true;

  // data
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [fetchError, setFetchError] = useState("");
  const [jobLocationCoords, setJobLocationCoords] = useState({});

  // filters & query state
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState("newest");
  const [searchParams, setSearchParams] = useSearchParams();
  const debounceRef = useRef(null);

  // interactions
  const [favorites, setFavorites] = useState(new Set());
  const [appliedJobs, setAppliedJobs] = useState(new Set());
  const [isAuthed, setIsAuthed] = useState(false);

  // UI
  const [selectedJob, setSelectedJob] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const hasUnlimitedSaves = hasUnlimitedCandidateSaves(authUser, userRole);
  const saveSlotsRemaining = hasUnlimitedSaves
    ? null
    : Math.max(0, FREE_SAVE_LIMIT - favorites.size);

  // auth
  useEffect(() => {
    let unsub;
    (async () => {
      const { user } = await getNeonUser();
      setIsAuthed(!!user);
      const sub = neonAuth.onAuthStateChange((_e, session) =>
        setIsAuthed(!!session?.user)
      );
      unsub = sub?.data?.subscription?.unsubscribe;
    })();
    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, []);

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
    setFilters(nextFilters);
    setSearchParams(searchParamsForFilters(nextFilters, sort, 1), { replace: true });
  };


  // interactions load
  useEffect(() => {
    const load = async () => {
      try {
        const { favorites, appliedJobs } = await getUserJobInteractions();
        setFavorites(new Set(favorites || []));
        setAppliedJobs(new Set(appliedJobs || []));
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
  const hasLocationText = Boolean(String(filters.location || "").trim());
  const hasActiveRadius = canUseMapSearch && hasLocationText && Boolean(searchCenter);

  // SMART PARSE: convert free-text into filter fields; keep leftovers in q
  useEffect(() => {
    if (!filters.q) return;
    const { result } = smartParseQuery(filters.q, lookup);
    setFilters((prev) => {
      const next = { ...prev };
      if (!prev.role && result.role) next.role = result.role;
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
    if (!canUseMapSearch) return;

    const location = String(filters.location || "").trim();
    if (!location) {
      if (filters.lat != null || filters.lng != null) {
        setFilters((prev) => ({ ...prev, lat: null, lng: null }));
      }
      return;
    }
    if (finitePoint(filters.lat, filters.lng)) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const point = await geocodeAddress(location, GOOGLE_MAPS_API_KEY);
        if (cancelled) return;
        setFilters((prev) => {
          if (String(prev.location || "").trim() !== location) return prev;
          return { ...prev, lat: point.lat, lng: point.lng };
        });
      } catch (err) {
        if (!cancelled) console.warn(err?.message || err);
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
    if (filters.role) {
      tags.push({ type: "role", value: filters.role, label: titleCase(filters.role) });
    }
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
        value: String(filters.location).toLowerCase(),
        label: titleCase(filters.location),
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
        role = "",
        employmentTypes = [],
        opportunityTypes = [],
        practiceTypes = [],
        location = "",
        company = "",
        lat,
        lng,
        radiusMi = 25,
      } = filters;
      const center = finitePoint(lat, lng);
      const locationText = String(location || "").trim().toLowerCase();
      const locationRadiusActive = canUseMapSearch && Boolean(locationText && center);
      const qLower = q.trim().toLowerCase();
      const employmentSet = new Set(normalizeFilterArray(employmentTypes).map(normalizeType));
      const opportunitySet = new Set(normalizeFilterArray(opportunityTypes).map(normalizeType));
      const practiceSet = new Set(normalizeFilterArray(practiceTypes).map(normalizeType));

      const next = (jobs || []).filter((job) => {
        const hay = [
          job.title,
          job.company,
          job.description,
          job.role,
          job.type,
          job.employment_type,
          TYPE_LABEL[normalizeType(job.employment_type || job.type)],
          job.opportunity_type,
          OPPORTUNITY_TYPE_LABEL[normalizeType(job.opportunity_type)],
          job.practice_type,
          PRACTICE_TYPE_LABEL[normalizeType(job.practice_type)],
          job.location,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchQ = !qLower || hay.includes(qLower);
        const matchRole = !role || (job.role || "").toLowerCase() === role.toLowerCase();
        const jobEmploymentType = normalizeType(job.employment_type || job.type);
        const matchEmployment =
          employmentSet.size === 0 || employmentSet.has(jobEmploymentType);
        const matchOpportunity =
          opportunitySet.size === 0 || opportunitySet.has(normalizeType(job.opportunity_type));
        const matchPractice =
          practiceSet.size === 0 || practiceSet.has(normalizeType(job.practice_type));
        const matchCompany =
          !company || (job.company || "").toLowerCase().includes(String(company).toLowerCase());
        const matchLocText =
          !locationText ||
          locationRadiusActive ||
          (job.location || "").toLowerCase().includes(String(location).toLowerCase());

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
  }, [filters, jobs, canUseMapSearch, jobLocationCoords]);

  // pagination
  const page = parseInt(searchParams.get("page") || "1", 10);
  const paginated = filteredJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil((filteredJobs.length || 0) / PAGE_SIZE));

  // chips: remove one -> clear the corresponding filter (do NOT put it back in q)
const removeQuickTag = (tag) => {
  const next = { ...filters };
  if (tag.type === "company")  next.company  = "";
  if (tag.type === "role")     next.role     = "";
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
          />
        </div>

        <div className="map-card">
          <div className={`job-map-inner top ${canUseMapSearch ? "" : "map-locked"}`}>
            <div className="map-canvas-layer" aria-hidden={!canUseMapSearch}>
              <JobMap
                jobs={filteredJobs}
                showMap={true}
                apiKey={GOOGLE_MAPS_API_KEY}
                searchCenter={searchCenter}
                radiusMi={filters.radiusMi}
                hasActiveRadius={hasActiveRadius}
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
      <div className="job-cards">
        {paginated.length ? (
          paginated.map((job) => (
            <JobCard
              key={job._id}
              job={job}
              isFavorite={favorites.has(job._id)}
              isApplied={appliedJobs.has(job._id)}
              savedTooltip={savedTooltipFor(job._id)}
              appliedTooltip={appliedTooltipFor(job._id)}
              onFavoriteClick={handleFavorite}
              onApplyClick={handleApply}
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
              : "No jobs match your filters."}
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
        savedTooltip={selectedJob ? savedTooltipFor(selectedJob._id) : ""}
        appliedTooltip={selectedJob ? appliedTooltipFor(selectedJob._id) : ""}
        onFavoriteClick={handleFavorite}
        onApply={handleApply}
        onClose={() => {
          setSelectedJob(null);
          setIsModalOpen(false);
        }}
        isAuthed={isAuthed}
      />
    </div>
  );
}
