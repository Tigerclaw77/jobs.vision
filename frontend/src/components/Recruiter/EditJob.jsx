import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchJobById } from "../../utils/api";
import AddJob from "./AddJob";

export default function EditJob({ jobToEdit, onSuccess }) {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(jobToEdit || null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(jobId && !jobToEdit));

  useEffect(() => {
    let mounted = true;

    async function loadJob() {
      if (jobToEdit) {
        setJob(jobToEdit);
        setLoading(false);
        return;
      }
      if (!jobId) return;

      try {
        setLoading(true);
        const data = await fetchJobById(jobId);
        if (mounted) setJob(data);
      } catch (err) {
        if (mounted) setError(err?.message || "Failed to load job.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadJob();
    return () => {
      mounted = false;
    };
  }, [jobId, jobToEdit]);

  if (loading) return <p>Loading job...</p>;
  if (error) return <p>{error}</p>;
  if (!job) return <p>Job not found.</p>;

  return (
    <AddJob
      jobToEdit={job}
      onSuccess={(savedJob) => {
        if (onSuccess) onSuccess(savedJob);
        else navigate("/recruiter/dashboard");
      }}
    />
  );
}
