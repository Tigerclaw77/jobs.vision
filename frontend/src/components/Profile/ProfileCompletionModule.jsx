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
}) {
  if (!completion || completion.score === null || completion.score === undefined) return null;

  const tasks = includeOptional
    ? completion.tasks || []
    : completion.attentionTasks || [];
  const groupedTasks = severityOrder
    .map((severity) => ({
      severity,
      label: severityLabel[severity],
      tasks: tasks.filter((task) => task.severity === severity),
    }))
    .filter((group) => group.tasks.length > 0);
  const attentionText =
    completion.attentionCount > 0
      ? `${completion.attentionCount} item${completion.attentionCount === 1 ? "" : "s"} need attention`
      : "Candidate contact details are ready";

  return (
    <section className={`profile-completion-module ${compact ? "compact" : ""}`}>
      <div className="profile-completion-topline">
        <div>
          <span className="profile-completion-label">Profile Completion</span>
          <strong>{completion.score}%</strong>
        </div>
        <span className={`profile-completion-status ${completion.criticalCount ? "critical" : ""}`}>
          {attentionText}
        </span>
      </div>

      {!compact && (
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
                        <strong>{task.actionLabel || task.incompleteLabel || task.label}</strong>
                        {!compact && <small>{task.whyItMatters || task.message}</small>}
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
        <p className="profile-empty">No critical or recommended profile items need attention.</p>
      )}
    </section>
  );
}
