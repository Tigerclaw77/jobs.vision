require("dotenv").config();
console.log("🔹 MONGO_URI from .env:", process.env.MONGO_URI);

const mongoose = require("mongoose");
const Job = require("../models/Job"); // Import Job model

// ✅ Dummy job data to insert into the database
const dummyJobs = [
  {
    title: "Optometrist",
    description: "Join our growing clinic offering excellent benefits and a competitive salary.",
    corporation: "Optometrist Corp",
    company: "Optometry Solutions",
    hours: "full-time",
    jobRole: "Optometrist",
    practiceMode: "employed",
    createdBy: null,
    createdAt: new Date(),
    savedBy: [],
  },
  {
    title: "Optometrist or Ophthalmologist",
    description: "Part-time opportunity at a well-established clinic with flexible hours.",
    corporation: "EyeCare Group",
    company: "Houston Eye Clinic",
    hours: "part-time",
    jobRole: "Optometrist",
    practiceMode: "contract",
    createdBy: null,
    createdAt: new Date(),
    savedBy: [],
  },
  {
    title: "Optometrist (Locum Tenens)",
    description: "Temporary locum tenens opportunity with great pay and flexible schedule.",
    corporation: "Locum Tenens Group",
    company: "Eyeworks Solutions",
    hours: "per diem",
    jobRole: "Optometrist",
    practiceMode: "associate",
    createdBy: null,
    createdAt: new Date(),
    savedBy: [],
  },
];

const seedJobs = async () => {
  try {
    // ✅ Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // ✅ Check if jobs already exist
    const existingJobs = await Job.countDocuments();
    if (existingJobs > 0) {
      console.log("⚠️ Jobs already exist. Skipping seeding.");
      mongoose.connection.close();
      return;
    }

    // ✅ Use insertMany to insert jobs in bulk
    await Job.insertMany(dummyJobs);
    console.log("✅ Jobs inserted successfully!");

    // ✅ Close connection
    mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error seeding jobs:", error);
    mongoose.connection.close();
  }
};

// ✅ Run the function to seed jobs
seedJobs();
