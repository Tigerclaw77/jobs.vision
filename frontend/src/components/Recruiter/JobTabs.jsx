import React, { useEffect, useMemo, useState } from "react";
import RecruiterJobCard from "./RecruiterJobCard";

const TAB_ORDER = ["active", "pending", "draft", "paused", "expired", "archived", "featured"];

const TAB_LABELS = {
  draft: "Unfinished",
  active: "Live Jobs",
  paused: "Hidden",
  expired: "Expired",
  archived: "Removed",
  pending: "Pending Jobs",
  featured: "Featured",
};

const JobTabs = ({ jobsByStatus, onEdit, onPause, onResume, onArchive, onUnarchive }) => {
  const [activeTab, setActiveTab] = useState("active");
  const tabs = useMemo(() => TAB_ORDER.filter((key) => key in jobsByStatus), [jobsByStatus]);
  const jobs = jobsByStatus[activeTab] || [];

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.includes(activeTab)) setActiveTab(tabs[0]);
  }, [activeTab, tabs]);

  return (
    <div className="job-tabs">
      <div className="tab-buttons">
        {tabs.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={activeTab === key ? "active" : ""}
          >
            {TAB_LABELS[key]} ({jobsByStatus[key].length})
          </button>
        ))}
      </div>

      <div className="tab-content">
        {jobs.length > 0 ? (
          <div className="recruiter-job-list">
            <div className="recruiter-job-list-header" aria-hidden="true">
              <span>Job</span>
              <span>Role</span>
              <span>Location</span>
              <span>Type</span>
              <span>Status</span>
              <span>Posted</span>
              <span>Applicants</span>
              <span>Actions</span>
            </div>
            {jobs.map((job) => (
              <RecruiterJobCard
                key={job.id || job._id}
                job={job}
                onEdit={onEdit}
                onPause={activeTab === "active" || activeTab === "pending" ? onPause : null}
                onResume={activeTab === "paused" ? onResume : null}
                onArchive={activeTab !== "archived" ? onArchive : null}
                onUnarchive={activeTab === "archived" ? onUnarchive : null}
              />
            ))}
          </div>
        ) : (
          <p>No jobs here yet.</p>
        )}
      </div>
    </div>
  );
};

export default JobTabs;
