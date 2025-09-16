import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const EditJob = ({ jobToEdit, onSuccess }) => {
  const { jobId } = useParams();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    company: "",
    salary: "",
    jobRole: "Optometrist",
    hours: "full-time",
    practiceMode: "employed",
    setting: "private",
    chainAffiliation: "",
    ownershipTrack: "none",
    location: "",
    state: "",
    lat: "",
    lng: "",
  });

  // Fetch job if not passed as prop
  useEffect(() => {
    const loadJob = async () => {
      if (!jobToEdit && jobId) {
        try {
          const res = await axios.get(
            `http://localhost:5000/api/jobs/${jobId}`
          );
          const job = res.data;
          setFormData({
            ...job,
            location: job.location?.city || "",
            state: job.location?.state || "",
            lat: job.location?.coordinates?.lat || "",
            lng: job.location?.coordinates?.lng || "",
          });
        } catch (err) {
          console.error("Failed to fetch job:", err);
        }
      } else if (jobToEdit) {
        setFormData({
          ...jobToEdit,
          location: jobToEdit.location?.city || "",
          state: jobToEdit.location?.state || "",
          lat: jobToEdit.location?.coordinates?.lat || "",
          lng: jobToEdit.location?.coordinates?.lng || "",
        });
      }
    };

    loadJob();
  }, [jobId, jobToEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const updatedPayload = {
      ...formData,
      location: {
        city: formData.location,
        state: formData.state,
        coordinates: {
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
        },
      },
    };

    try {
      await axios.put(
        `http://localhost:5000/api/jobs/${jobId}`,
        updatedPayload
      );
      alert("Job updated successfully!");
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Error updating job:", err.message);
      alert("Failed to update job.");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="title"
        placeholder="Title"
        value={formData.title}
        onChange={handleChange}
      />
      <textarea
        name="description"
        placeholder="Description"
        value={formData.description}
        onChange={handleChange}
      />
      <input
        name="company"
        placeholder="Company"
        value={formData.company}
        onChange={handleChange}
      />
      <input
        name="salary"
        placeholder="Salary"
        value={formData.salary}
        onChange={handleChange}
      />

      <select name="jobRole" value={formData.jobRole} onChange={handleChange}>
        <option value="Optometrist">Optometrist</option>
        <option value="Ophthalmologist">Ophthalmologist</option>
        <option value="Optician">Optician</option>
      </select>

      <select name="hours" value={formData.hours} onChange={handleChange}>
        <option value="full-time">Full-time</option>
        <option value="part-time">Part-time</option>
        <option value="per diem">Per Diem</option>
      </select>

      <select
        name="practiceMode"
        value={formData.practiceMode}
        onChange={handleChange}
      >
        <option value="employed">Employed</option>
        <option value="contract">Contract</option>
        <option value="lease">Lease</option>
        <option value="associate">Associate</option>
      </select>

      <select name="setting" value={formData.setting} onChange={handleChange}>
        <option value="private">Private Practice</option>
        <option value="retail">Retail</option>
        <option value="medical">Medical Group</option>
        <option value="surgical">Surgical Center</option>
      </select>

      <input
        name="chainAffiliation"
        placeholder="Chain Affiliation (e.g. Luxottica)"
        value={formData.chainAffiliation}
        onChange={handleChange}
      />

      <select
        name="ownershipTrack"
        value={formData.ownershipTrack}
        onChange={handleChange}
      >
        <option value="none">None</option>
        <option value="available">Available</option>
        <option value="required">Required</option>
      </select>

      <input
        name="location"
        placeholder="City"
        value={formData.location}
        onChange={handleChange}
      />
      <input
        name="state"
        placeholder="State"
        value={formData.state}
        onChange={handleChange}
      />
      <input
        name="lat"
        placeholder="Latitude"
        value={formData.lat}
        onChange={handleChange}
      />
      <input
        name="lng"
        placeholder="Longitude"
        value={formData.lng}
        onChange={handleChange}
      />

      <button type="submit">Update Job</button>
    </form>
  );
};

export default EditJob;
