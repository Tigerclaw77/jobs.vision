const Job = require("../models/Job");
const User = require("../models/User");
const sendAlertsForNewJob = require("../utils/sendAlertsForNewJob");

const corporationData = {
  luxottica: ["LensCrafters", "Pearle Vision", "Target Optical"],
  walmart: ["Walmart Vision Center", "Sam's Club"],
  visionworks: ["Visionworks"],
};

// ✅ POST a Job
const postJob = async (req, res) => {
  try {
    const {
      title,
      description,
      salary,
      company,
      hours,
      jobRole,
      practiceMode,
      setting,
      chainAffiliation,
      ownershipTrack,
      location,
      state,
      lat,
      lng,
    } = req.body;

    const user = await User.findById(req.user._id);
    if (user.userRole !== "recruiter") {
      return res.status(403).json({ message: "Only recruiters can post jobs." });
    }

    if (
      user.recruiterType === "corporate" &&
      !corporationData[user.corporation]?.includes(company)
    ) {
      return res.status(403).json({
        message: "You can only post jobs for your assigned corporation.",
      });
    }

    const newJob = new Job({
      title,
      description,
      salary,
      company,
      corporation: user.recruiterType === "corporate" ? user.corporation : null,
      hours,
      jobRole,
      practiceMode,
      setting,
      chainAffiliation,
      ownershipTrack,
      createdBy: user._id,
      location: {
        city: location,
        state,
        coordinates: { lat, lng },
      },
    });

    await newJob.save();

    // ✅ Trigger alerts for matching candidates (email/SMS + throttling inside utility)
    await sendAlertsForNewJob(newJob);

    res.status(201).json({ message: "Job posted successfully!", job: newJob });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ✅ Search Jobs
const searchJobs = async (req, res) => {
  try {
    const {
      jobRole,
      hours,
      practiceMode,
      setting,
      chainAffiliation,
      ownershipTrack,
      corporation,
      company,
      state,
    } = req.query;

    const query = {};
    if (jobRole) query.jobRole = jobRole;
    if (hours) query.hours = hours;
    if (practiceMode) query.practiceMode = practiceMode;
    if (setting) query.setting = setting;
    if (chainAffiliation) query.chainAffiliation = chainAffiliation;
    if (ownershipTrack) query.ownershipTrack = ownershipTrack;
    if (corporation) query.corporation = corporation;
    if (company) query.company = company;
    if (state) query["location.state"] = state;

    const jobs = await Job.find(query).sort({ createdAt: -1 });
    res.status(200).json(jobs);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ✅ Seed Jobs
const seedJobs = async (req, res) => {
  try {
    const existingJobs = await Job.find();
    if (existingJobs.length > 0) {
      return res.status(400).json({ message: "Jobs are already seeded." });
    }

    const dummyJobs = [
      {
        title: "Optometrist",
        description: "Full-time optometrist position with great benefits.",
        corporation: "luxottica",
        company: "LensCrafters",
        hours: "full-time",
        jobRole: "Optometrist",
        practiceMode: "employed",
        setting: "retail",
        chainAffiliation: "luxottica",
        ownershipTrack: "none",
        createdBy: req.user._id,
      },
      {
        title: "Ophthalmologist",
        description: "Part-time ophthalmologist needed for surgical consults.",
        corporation: "visionworks",
        company: "Visionworks",
        hours: "part-time",
        jobRole: "Ophthalmologist",
        practiceMode: "contract",
        setting: "private",
        chainAffiliation: "visionworks",
        ownershipTrack: "potential",
        createdBy: req.user._id,
      },
    ];

    await Job.insertMany(dummyJobs);
    res.status(201).json({ message: "Dummy jobs seeded successfully!", jobs: dummyJobs });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ✅ Update Job
const updateJob = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const updatedJobData = req.body;

    const updatedJob = await Job.findByIdAndUpdate(jobId, updatedJobData, { new: true });

    if (!updatedJob) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(200).json({ message: "Job updated successfully.", job: updatedJob });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ✅ Archive Job (Soft Delete)
const archiveJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    job.status = "archived";
    await job.save();

    res.status(200).json({ message: "Job archived successfully." });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ✅ Save Template
const saveJobTemplate = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.tier < 2) {
      return res.status(403).json({
        message: "Upgrade your account to save job templates.",
      });
    }

    user.jobTemplates.push(req.body);
    await user.save();

    res.status(201).json({
      message: "Template saved!",
      templates: user.jobTemplates,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ✅ Get Recruiter Jobs
const getRecruiterJobs = async (req, res) => {
  try {
    const filter = req.user.userRole === "admin"
      ? {}
      : { createdBy: req.user._id };

    const jobs = await Job.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: jobs.length,
      data: jobs,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch recruiter jobs." });
  }
};

module.exports = {
  postJob,
  searchJobs,
  seedJobs,
  updateJob,
  archiveJob,
  getRecruiterJobs,
  saveJobTemplate,
};
