// src/components/JobSearch/JobList.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../utils/supabaseClient";

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
const PAGE_SIZE = 10;

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
const HOURS_LABEL = { "full-time": "Full-time", "part-time": "Part-time", prn: "PRN" };
const titleCase = (s = "") =>
  String(s)
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");

// ---------- filters ----------
const DEFAULT_FILTERS = {
  q: "",
  location: "",
  lat: null,
  lng: null,
  radiusMi: 25,
  role: "",
  hours: "",
  company: "",
};

export default function JobList() {
  // data
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [fetchError, setFetchError] = useState("");

  // filters & query state
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState("newest");
  const [searchParams, setSearchParams] = useSearchParams();
  const debounceRef = useRef(null);

  // interactions
  const [favorites, setFavorites] = useState(new Set());
  const [appliedJobs, setAppliedJobs] = useState(new Set());
  const [appliedAt, setAppliedAt] = useState(new Map());
  const [isAuthed, setIsAuthed] = useState(false);

  // UI
  const [selectedJob, setSelectedJob] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // auth
  useEffect(() => {
    let unsub;
    (async () => {
      const { data } = await supabase.auth.getUser();
      setIsAuthed(!!data?.user);
      const sub = supabase.auth.onAuthStateChange((_e, session) =>
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
    const initial = Object.fromEntries([...searchParams.entries()]);
    delete initial.page;
    delete initial.sort;
    setFilters({ ...DEFAULT_FILTERS, ...initial });
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

  // SMART PARSE: convert free-text into filter fields; keep leftovers in q
  useEffect(() => {
    if (!filters.q) return;
    const { result } = smartParseQuery(filters.q, lookup);
    setFilters((prev) => {
      const next = { ...prev };
      if (!prev.role && result.role) next.role = result.role;
      if (!prev.hours && result.hours) next.hours = result.hours;
      if (!prev.company && result.company) next.company = result.company;
      if (!prev.location && result.location) next.location = result.location;
      // keep only leftovers in the search box
      if (typeof result.qClean === "string") next.q = result.qClean;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, lookup]);

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
    if (filters.hours) {
      tags.push({
        type: "hours",
        value: filters.hours,
        label: HOURS_LABEL[filters.hours] || titleCase(filters.hours),
      });
    }
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
      const { q = "", role = "", hours = "", location = "", company = "", lat, lng, radiusMi = 25 } = filters;
      const center = lat && lng ? { lat, lng } : null;
      const qLower = q.trim().toLowerCase();

      const next = (jobs || []).filter((job) => {
        const hay = [
          job.title,
          job.company,
          job.description,
          job.role,
          job.hours,
          job.location,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchQ = !qLower || hay.includes(qLower);
        const matchRole = !role || (job.role || "").toLowerCase() === role.toLowerCase();
        const matchHours = !hours || (job.hours || "").toLowerCase() === hours.toLowerCase();
        const matchCompany =
          !company || (job.company || "").toLowerCase().includes(String(company).toLowerCase());
        const matchLocText =
          !location ||
          (job.location || "").toLowerCase().includes(String(location).toLowerCase());

        let matchRadius = true;
        if (center && job.latitude && job.longitude) {
          const d = haversineMi(center, { lat: job.latitude, lng: job.longitude });
          matchRadius = d <= radiusMi;
        }

        return matchQ && matchRole && matchHours && matchCompany && matchLocText && matchRadius;
      });

      setFilteredJobs(next);
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [filters, jobs]);

  // pagination
  const page = parseInt(searchParams.get("page") || "1", 10);
  const paginated = filteredJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil((filteredJobs.length || 0) / PAGE_SIZE));

  // chips: remove one -> clear the corresponding filter (do NOT put it back in q)
const removeQuickTag = (tag) => {
  setFilters((prev) => {
    const next = { ...prev };
    if (tag.type === "company")  next.company  = "";
    if (tag.type === "role")     next.role     = "";
    if (tag.type === "hours")    next.hours    = "";
    if (tag.type === "location") next.location = "";
    return next;
  });
};


  const requireAuth = (message) => {
    const go = window.confirm(message || "Please sign in to continue. Go to Sign In?");
    if (go) window.location.assign("/signin");
  };

  const handleFavorite = async (jobId) => {
    if (!isAuthed) return requireAuth("Please sign in to save favorites. Go to Sign In?");
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(jobId) ? next.delete(jobId) : next.add(jobId);
      return next;
    });
    try {
      await addJobToFavorites(jobId);
    } catch {
      alert("Couldn’t save this. Try again.");
    }
  };

  const handleApply = async (jobId) => {
    if (!isAuthed) return requireAuth("Please sign in to apply for jobs. Go to Sign In?");
    if (appliedJobs.has(jobId)) return;
    try {
      await applyToJob(jobId);
      setAppliedJobs((prev) => new Set(prev).add(jobId));
      setAppliedAt((prev) => new Map(prev).set(jobId, new Date().toISOString()));
    } catch {
      alert("We couldn’t submit your application. Please try again.");
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
            onFilterChange={setFilters}
            onClear={() => setFilters(DEFAULT_FILTERS)}
            quickTags={quickTags}
            onRemoveQuickTag={removeQuickTag}
          />
        </div>

        <div className="map-card">
          <div className="job-map-inner top">
            <JobMap
              jobs={filteredJobs}
              showMap={true}
              apiKey={GOOGLE_MAPS_API_KEY}
              onMarkerClick={(job) => {
                setSelectedJob(job);
                setIsModalOpen(true);
              }}
            />
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
              appliedTooltip={
                appliedAt.get(job._id)
                  ? `Applied on ${new Date(appliedAt.get(job._id)).toLocaleDateString()}`
                  : "Apply for this job"
              }
              onFavoriteClick={handleFavorite}
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
            {fetchError ? `Failed to load jobs: ${fetchError}` : "No jobs match your filters."}
          </div>
        )}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(newPage) =>
          setSearchParams({
            ...filters,
            sort,
            page: newPage.toString(),
          })
        }
      />

      <JobModal
        isOpen={isModalOpen && !!selectedJob}
        job={selectedJob}
        isFavorite={selectedJob && favorites.has(selectedJob._id)}
        isApplied={selectedJob && appliedJobs.has(selectedJob._id)}
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
