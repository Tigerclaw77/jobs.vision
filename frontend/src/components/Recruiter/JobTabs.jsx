import React, { useState } from "react";
import RecruiterJobCard from "./RecruiterJobCard";

const JobTabs = ({ jobsByStatus, onEdit, onArchive }) => {
  const [activeTab, setActiveTab] = useState("active");

  const tabLabels = {
    active: "Active",
    archived: "Archived",
    featured: "Featured",
    expired: "Expired",
  };

  const tabs = Object.keys(jobsByStatus).filter(
    (key) => jobsByStatus[key]?.length > 0
  );

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
              key={job._id}
              job={job}
              onEdit={onEdit}
              onArchive={activeTab !== "archived" ? onArchive : null}
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
