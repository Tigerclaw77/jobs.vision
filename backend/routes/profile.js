const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { buildUpdate, one } = require("../services/db");
const {
  completionTasksForProfile,
  getProfileColumnSet,
  getProfileSelectList,
  profileCompletionForProfile,
  shapeProfile,
  trimOrNull,
} = require("../services/profileDetails");

const router = express.Router();

function normalizeBool(value) {
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
}

function normalizeTextArray(value) {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function pick(body, ...keys) {
  for (const key of keys) {
    if (body?.[key] !== undefined) return body[key];
  }
  return undefined;
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const selectList = await getProfileSelectList();
    const data = await one(
      `select ${selectList} from public.profiles where id = $1`,
      [req.user.id]
    );
    if (!data) return res.status(404).json({ error: "Profile not found" });

    const shaped = shapeProfile(data);
    return res.json({
      ...shaped,
      completionTasks: completionTasksForProfile(shaped),
      profileCompletion: profileCompletionForProfile(shaped),
    });
  } catch (err) {
    console.error("GET /api/profile error", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.put("/", requireAuth, async (req, res) => {
  try {
    const updates = {};
    const firstName = pick(req.body, "firstName", "first_name");
    const lastName = pick(req.body, "lastName", "last_name");
    const company = pick(req.body, "companyName", "company", "company_name");

    if (firstName !== undefined) updates.first_name = trimOrNull(firstName);
    if (lastName !== undefined) updates.last_name = trimOrNull(lastName);
    if (company !== undefined) updates.company = trimOrNull(company);

    const fieldMap = {
      phone: ["phone"],
      company_website: ["companyWebsite", "company_website"],
      company_description: ["companyDescription", "company_description"],
      company_logo_url: ["companyLogoUrl", "company_logo_url"],
      company_location: ["companyLocation", "company_location"],
      application_email: ["applicationEmail", "application_email"],
      application_phone: ["applicationPhone", "application_phone"],
      application_website: ["applicationWebsite", "application_website"],
      application_instructions: ["applicationInstructions", "application_instructions"],
    };

    for (const [column, keys] of Object.entries(fieldMap)) {
      const value = pick(req.body, ...keys);
      if (value !== undefined) updates[column] = trimOrNull(value);
    }

    const boolMap = {
      application_use_account_email: ["applicationUseAccountEmail", "application_use_account_email"],
      email_notifications: ["emailNotifications", "email_notifications"],
      sms_notifications: ["smsNotifications", "sms_notifications"],
      lead_notifications: ["leadNotifications", "lead_notifications"],
      weekly_summary_emails: ["weeklySummaryEmails", "weekly_summary_emails"],
      saved_search_alerts: ["savedSearchAlerts", "saved_search_alerts"],
    };

    for (const [column, keys] of Object.entries(boolMap)) {
      const value = pick(req.body, ...keys);
      if (value !== undefined) updates[column] = normalizeBool(value);
    }

    const specialtyInterests = pick(req.body, "specialtyInterests", "specialty_interests");
    const normalizedInterests = normalizeTextArray(specialtyInterests);
    if (normalizedInterests !== undefined) updates.specialty_interests = normalizedInterests;

    const columnSet = await getProfileColumnSet();
    for (const column of Object.keys(updates)) {
      if (!columnSet.has(column)) delete updates[column];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No supported profile fields provided" });
    }

    updates.updated_at = new Date().toISOString();

    const selectList = await getProfileSelectList();
    const update = buildUpdate("public.profiles", updates, "id = $" + (Object.keys(updates).length + 1), [req.user.id], {
      returning: selectList,
    });
    const data = await one(update.text, update.params);
    if (!data) return res.status(404).json({ error: "Profile not found" });

    const shaped = shapeProfile(data);
    return res.json({
      message: "Profile updated successfully",
      ...shaped,
      completionTasks: completionTasksForProfile(shaped),
      profileCompletion: profileCompletionForProfile(shaped),
    });
  } catch (err) {
    console.error("PUT /api/profile error", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
