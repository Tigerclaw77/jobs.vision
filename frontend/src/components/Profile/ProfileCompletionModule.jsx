import React from "react";
import { Link } from "react-router-dom";

const severityLabel = {
  critical: "Critical",
  recommended: "Recommended",
  optional: "Optional",
};

export default function ProfileCompletionModule({
  completion,
  compact = false,
  includeOptional = true,
}) {
  if (!completion || completion.score === null || completion.score === undefined) return null;

  const tasks = includeOptional
    ? completion.tasks || []
    : completion.attentionTasks || [];
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

      {tasks.length > 0 ? (
        <ul className="profile-completion-list">
          {tasks.map((task) => {
            const content = (
              <>
                <span className={`profile-task-check ${task.severity}`} aria-hidden="true">
                  {task.completed ? "✓" : "□"}
                </span>
                <span>
                  <strong>{task.incompleteLabel || task.label}</strong>
                  {!compact && (
                    <small>
                      {severityLabel[task.severity] || "Task"} - {task.whyItMatters || task.message}
                    </small>
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
                  <span className={`profile-completion-task ${task.severity}`}>{content}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="profile-empty">No critical or recommended profile items need attention.</p>
      )}
    </section>
  );
}
