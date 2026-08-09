import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchNewJobsCount } from "../utils/api.supabase";
import {
  beginNewJobsVisit,
  buildNewJobsHref,
  newJobsMessage,
  shouldShowNewJobs,
} from "../utils/newJobsVisit";
import "../styles/NewJobsNotice.css";

export default function NewJobsNotice() {
  const [notice, setNotice] = useState(null);
  const startedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (startedRef.current) {
      return () => {
        mountedRef.current = false;
      };
    }
    startedRef.current = true;

    const visit = beginNewJobsVisit({
      localStorage: window.localStorage,
      sessionStorage: window.sessionStorage,
    });

    if (visit) {
      fetchNewJobsCount(visit.cutoff)
        .then((count) => {
          if (mountedRef.current && shouldShowNewJobs(count)) {
            setNotice({ ...visit, count });
          }
        })
        .catch(() => {
          // This optional signal should never interfere with normal navigation.
        });
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (!notice) return null;

  const message = newJobsMessage(notice.count, notice.mode);

  return (
    <aside
      className="new-jobs-notice"
      aria-label="New jobs available"
      aria-live="polite"
      role="status"
    >
      <Link
        className="new-jobs-notice-link"
        to={buildNewJobsHref(notice.cutoff)}
        onClick={() => setNotice(null)}
      >
        {message}
      </Link>
      <button
        type="button"
        className="new-jobs-notice-dismiss"
        aria-label="Dismiss new jobs notification"
        onClick={() => setNotice(null)}
      >
        &times;
      </button>
    </aside>
  );
}
