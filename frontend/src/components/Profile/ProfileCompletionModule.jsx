import React from "react";
import { Link } from "react-router-dom";

const severityLabel = {
  critical: "Critical",
  recommended: "Recommended",
  optional: "Optional",
};

const severityOrder = ["critical", "recommended", "optional"];

export default function ProfileCompletionModule({
  completion,
  compact = false,
  includeOptional = true,
  displayTaskIds = null,
  labelOverrides = {},
  showNote = true,
  showTaskDetails = true,
  collapseWhenComplete = false,
}) {
  if (!completion || completion.score === null || completion.score === undefined) return null;

  const rawTasks = includeOptional
    ? completion.tasks || []
    : completion.attentionTasks || [];
  const allowedTaskIds = Array.isArray(displayTaskIds) ? new Set(displayTaskIds) : null;
  const tasks = allowedTaskIds
    ? rawTasks.filter((task) => allowedTaskIds.has(task.id))
    : rawTasks;
  const groupedTasks = severityOrder
    .map((severity) => ({
      severity,
      label: severityLabel[severity],
      tasks: tasks.filter((task) => task.severity === severity),
    }))
    .filter((group) => group.tasks.length > 0);
  const scopedAttentionCount = tasks.filter((task) => task.severity !== "optional").length;
  const statusCount = allowedTaskIds ? scopedAttentionCount : completion.attentionCount;
  const hasCritical = allowedTaskIds
    ? tasks.some((task) => task.severity === "critical")
    : completion.criticalCount;
  const attentionText =
    statusCount > 0
      ? `${statusCount} item${statusCount === 1 ? "" : "s"} need attention`
      : "Candidate contact details are ready";

  if (collapseWhenComplete && groupedTasks.length === 0) {
    return (
      <section className={`profile-completion-module complete ${compact ? "compact" : ""}`}>
        <div className="profile-complete-badge">
          <span className="profile-complete-mark" aria-hidden="true" />
          <strong>Profile Complete</strong>
        </div>
      </section>
    );
  }

  return (
    <section className={`profile-completion-module ${compact ? "compact" : ""}`}>
      <div className="profile-completion-topline">
        <div>
          <span className="profile-completion-label">Profile Completion</span>
          <strong>{completion.score}%</strong>
        </div>
        <span className={`profile-completion-status ${hasCritical ? "critical" : ""}`}>
          {attentionText}
        </span>
      </div>

      {!compact && showNote && (
        <p className="profile-completion-note">
          These prompts are guidance only. Payments, job posting, and editing stay available.
        </p>
      )}

      {groupedTasks.length > 0 ? (
        <div className="profile-completion-groups">
          {groupedTasks.map((group) => (
            <div className={`profile-completion-group ${group.severity}`} key={group.severity}>
              {!compact && (
                <span className="profile-completion-group-title">{group.label}</span>
              )}
              <ul className="profile-completion-list">
                {group.tasks.map((task) => {
                  const content = (
                    <>
                      <span
                        className={`profile-task-check ${task.severity} ${
                          task.completed ? "completed" : ""
                        }`}
                        aria-hidden="true"
                      />
                      <span>
                        <strong>
                          {labelOverrides[task.id] ||
                            task.actionLabel ||
                            task.incompleteLabel ||
                            task.label}
                        </strong>
                        {!compact && showTaskDetails && (
                          <small>{task.whyItMatters || task.message}</small>
                        )}
                      </span>
                    </>
                  );

                  return (
                    <li key={task.id}>
                      {task.link ? (
                        <Link to={task.link} className={`profile-completion-task ${task.severity}`}>
                          {content}
                        </Link>
                      ) : (
                        <span className={`profile-completion-task ${task.severity}`}>
                          {content}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="profile-empty">Recommended profile details are complete.</p>
      )}
    </section>
  );
}
