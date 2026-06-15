import React, { useEffect, useState } from "react";
import RecruiterJobCard from "./RecruiterJobCard";

const TAB_ORDER = ["draft", "active", "paused", "expired", "archived", "pending", "featured"];

const JobTabs = ({ jobsByStatus, onEdit, onPause, onResume, onArchive, onUnarchive }) => {
  const [activeTab, setActiveTab] = useState("draft");

  const tabLabels = {
    draft: "Drafts",
    active: "Active",
    paused: "Paused",
    expired: "Expired",
    archived: "Archived",
    pending: "Pending Verification",
    featured: "Featured",
  };

  const tabs = TAB_ORDER.filter((key) => key in jobsByStatus);

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.includes(activeTab)) setActiveTab(tabs[0]);
  }, [activeTab, tabs]);

  return (
    <div className="job-tabs">
      {/* ✅ Tab Navigation */}
      <div className="tab-buttons">
        {tabs.map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={activeTab === key ? "active" : ""}
          >
            {tabLabels[key]} ({jobsByStatus[key].length})
          </button>
        ))}
      </div>

      {/* ✅ Tab Content */}
      <div className="tab-content">
        {jobsByStatus[activeTab] && jobsByStatus[activeTab].length > 0 ? (
          jobsByStatus[activeTab].map((job) => (
            <RecruiterJobCard
              key={job.id || job._id}
              job={job}
              onEdit={onEdit}
              onPause={activeTab === "active" || activeTab === "pending" ? onPause : null}
              onResume={activeTab === "paused" ? onResume : null}
              onArchive={activeTab !== "archived" ? onArchive : null}
              onUnarchive={activeTab === "archived" ? onUnarchive : null}
            />
          ))
        ) : (
          <p>No jobs found in this tab.</p>
        )}
      </div>
    </div>
  );
};

export default JobTabs;
