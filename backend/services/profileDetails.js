const { query } = require("./db");

const PROFILE_COLUMNS = [
  "id",
  "email",
  "role",
  "first_name",
  "last_name",
  "company",
  "phone",
  "company_website",
  "company_description",
  "company_logo_url",
  "company_location",
  "application_use_account_email",
  "application_email",
  "application_phone",
  "application_website",
  "application_instructions",
  "email_notifications",
  "sms_notifications",
  "lead_notifications",
  "weekly_summary_emails",
  "saved_search_alerts",
  "specialty_interests",
  "created_at",
  "updated_at",
];

const PROFILE_COLUMN_FALLBACKS = {
  phone: "null::text as phone",
  company_website: "null::text as company_website",
  company_description: "null::text as company_description",
  company_logo_url: "null::text as company_logo_url",
  company_location: "null::text as company_location",
  application_use_account_email: "true::boolean as application_use_account_email",
  application_email: "null::text as application_email",
  application_phone: "null::text as application_phone",
  application_website: "null::text as application_website",
  application_instructions: "null::text as application_instructions",
  email_notifications: "true::boolean as email_notifications",
  sms_notifications: "false::boolean as sms_notifications",
  lead_notifications: "true::boolean as lead_notifications",
  weekly_summary_emails: "true::boolean as weekly_summary_emails",
  saved_search_alerts: "false::boolean as saved_search_alerts",
  specialty_interests: "array[]::text[] as specialty_interests",
};

let cachedColumns = null;
let cachedColumnsAt = 0;
const PROFILE_COLUMNS_CACHE_MS = 60_000;

async function getProfileColumnSet() {
  const now = Date.now();
  if (cachedColumns && now - cachedColumnsAt < PROFILE_COLUMNS_CACHE_MS) {
    return cachedColumns;
  }

  const result = await query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
    `
  );

  cachedColumns = new Set(result.rows.map((row) => row.column_name));
  cachedColumnsAt = now;
  return cachedColumns;
}

async function getProfileSelectList() {
  const columnSet = await getProfileColumnSet();
  return PROFILE_COLUMNS
    .map((column) => {
      if (columnSet.has(column)) return column;
      return PROFILE_COLUMN_FALLBACKS[column] || `null as ${column}`;
    })
    .join(", ");
}

function trimOrNull(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function boolOrDefault(value, fallback) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

function arrayOrEmpty(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function shapeProfile(row = {}) {
  const specialtyInterests = arrayOrEmpty(row.specialty_interests);
  const profile = {
    id: row.id,
    email: row.email || null,
    role: row.role || null,
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    company: row.company || null,
    companyName: row.company || "",
    phone: row.phone || "",
    companyWebsite: row.company_website || "",
    companyDescription: row.company_description || "",
    companyLogoUrl: row.company_logo_url || "",
    companyLocation: row.company_location || "",
    applicationUseAccountEmail: boolOrDefault(row.application_use_account_email, true),
    applicationEmail: row.application_email || "",
    applicationPhone: row.application_phone || "",
    applicationWebsite: row.application_website || "",
    applicationInstructions: row.application_instructions || "",
    emailNotifications: boolOrDefault(row.email_notifications, true),
    smsNotifications: boolOrDefault(row.sms_notifications, false),
    leadNotifications: boolOrDefault(row.lead_notifications, true),
    weeklySummaryEmails: boolOrDefault(row.weekly_summary_emails, true),
    savedSearchAlerts: boolOrDefault(row.saved_search_alerts, false),
    specialtyInterests,
    first_name: row.first_name || "",
    last_name: row.last_name || "",
    company_website: row.company_website || "",
    company_description: row.company_description || "",
    company_logo_url: row.company_logo_url || "",
    company_location: row.company_location || "",
    application_use_account_email: boolOrDefault(row.application_use_account_email, true),
    application_email: row.application_email || "",
    application_phone: row.application_phone || "",
    application_website: row.application_website || "",
    application_instructions: row.application_instructions || "",
    email_notifications: boolOrDefault(row.email_notifications, true),
    sms_notifications: boolOrDefault(row.sms_notifications, false),
    lead_notifications: boolOrDefault(row.lead_notifications, true),
    weekly_summary_emails: boolOrDefault(row.weekly_summary_emails, true),
    saved_search_alerts: boolOrDefault(row.saved_search_alerts, false),
    specialty_interests: specialtyInterests,
  };

  return {
    id: row.id,
    email: row.email || null,
    role: row.role || null,
    userRole: row.role || null,
    profile,
  };
}

function contactMethodCount(profile = {}) {
  let count = 0;
  if (profile.applicationUseAccountEmail && profile.email) count += 1;
  if (profile.applicationEmail) count += 1;
  if (profile.applicationPhone) count += 1;
  if (profile.applicationWebsite) count += 1;
  return count;
}

function recruiterCompletionCriteria(profile = {}) {
  const hasContactMethod = contactMethodCount(profile) > 0;
  const notificationPrefsSet =
    profile.emailNotifications || profile.leadNotifications || profile.weeklySummaryEmails;

  return [
    {
      id: "profile:recruiter:application-email",
      field: "applicationEmail",
      severity: "critical",
      weight: 40,
      completed: hasContactMethod,
      label: "Add Application Email",
      incompleteLabel: "No candidate contact method",
      message: "Candidates currently have no contact method for this account.",
      whyItMatters: "Candidates cannot currently contact you.",
      link: "/recruiter/profile#application-preferences",
      actionLabel: "Add Application Email",
    },
    {
      id: "profile:recruiter:company-name",
      field: "companyName",
      severity: "recommended",
      weight: 20,
      completed: !!profile.company,
      label: "Add Company Name",
      incompleteLabel: "Company name missing",
      message: "Add your company name so candidates know who they are contacting.",
      whyItMatters: "Company names make job posts feel credible and specific.",
      link: "/recruiter/profile#company-information",
      actionLabel: "Add Company Name",
    },
    {
      id: "profile:recruiter:company-description",
      field: "companyDescription",
      severity: "recommended",
      weight: 15,
      completed: !!profile.companyDescription,
      label: "Add Company Description",
      incompleteLabel: "Company description missing",
      message: "Add a company description to improve candidate response rates.",
      whyItMatters: "Candidates respond better when they understand the practice.",
      link: "/recruiter/profile#company-information",
      actionLabel: "Add Company Description",
    },
    {
      id: "profile:recruiter:company-website",
      field: "companyWebsite",
      severity: "recommended",
      weight: 15,
      completed: !!profile.companyWebsite,
      label: "Add Company Website",
      incompleteLabel: "Company website missing",
      message: "Add a company website to increase trust and credibility.",
      whyItMatters: "A website helps candidates verify the opportunity.",
      link: "/recruiter/profile#company-information",
      actionLabel: "Add Company Website",
    },
    {
      id: "profile:recruiter:company-logo",
      field: "companyLogoUrl",
      severity: "optional",
      weight: 5,
      completed: !!profile.companyLogoUrl,
      label: "Add Company Logo",
      incompleteLabel: "Company logo optional",
      message: "Add a company logo when available.",
      whyItMatters: "A logo can make listings easier to recognize.",
      link: "/recruiter/profile#company-information",
      actionLabel: "Add Company Logo",
    },
    {
      id: "profile:recruiter:notification-preferences",
      field: "notificationPreferences",
      severity: "optional",
      weight: 5,
      completed: !!notificationPrefsSet,
      label: "Review Notification Preferences",
      incompleteLabel: "Notification preferences optional",
      message: "Review notification preferences for future lead and summary alerts.",
      whyItMatters: "Notification preferences prepare your account for future alert delivery.",
      link: "/recruiter/profile#notification-preferences",
      actionLabel: "Review Notifications",
    },
  ];
}

function profileCompletionForProfile(shaped = {}) {
  const profile = shaped.profile || shaped || {};
  const role = String(profile.role || shaped.role || "").toLowerCase();

  if (role !== "recruiter") {
    return {
      role,
      score: null,
      attentionCount: 0,
      criticalCount: 0,
      recommendedCount: 0,
      optionalCount: 0,
      criteria: [],
      tasks: [],
      summary: "Profile completion guidance is available for recruiter accounts.",
    };
  }

  const criteria = recruiterCompletionCriteria(profile);
  const totalWeight = criteria.reduce((sum, item) => sum + item.weight, 0);
  const completedWeight = criteria
    .filter((item) => item.completed)
    .reduce((sum, item) => sum + item.weight, 0);
  const score = Math.round((completedWeight / totalWeight) * 100);
  const tasks = criteria.filter((item) => !item.completed);
  const attentionTasks = tasks.filter((item) => item.severity !== "optional");
  const criticalCount = tasks.filter((item) => item.severity === "critical").length;
  const recommendedCount = tasks.filter((item) => item.severity === "recommended").length;
  const optionalCount = tasks.filter((item) => item.severity === "optional").length;

  return {
    role,
    score,
    attentionCount: attentionTasks.length,
    criticalCount,
    recommendedCount,
    optionalCount,
    criteria,
    tasks,
    attentionTasks,
    summary: attentionTasks.length
      ? `${attentionTasks.length} item${attentionTasks.length === 1 ? "" : "s"} need attention`
      : "Candidate contact details are ready",
  };
}

function completionTasksForProfile(shaped = {}) {
  const profile = shaped.profile || shaped || {};
  const role = String(profile.role || shaped.role || "").toLowerCase();
  const tasks = [];

  if (role === "recruiter") {
    return profileCompletionForProfile(shaped).attentionTasks.map((task) => ({
      id: task.id,
      severity: task.severity,
      message: task.message,
      link: task.link,
      actionLabel: task.actionLabel,
    }));
  }

  if (role === "candidate") {
    if (!profile.phone) {
      tasks.push({
        id: "profile:candidate:phone",
        severity: "recommended",
        message: "Add a phone number for future candidate alerts and contact preferences.",
        link: "/candidate/profile#contact-information",
        actionLabel: "Add phone",
      });
    }
    if (!profile.specialtyInterests?.length) {
      tasks.push({
        id: "profile:candidate:specialty-interests",
        severity: "optional",
        message: "Add specialty interests to prepare for future job alerts.",
        link: "/candidate/profile#specialty-interests",
        actionLabel: "Add interests",
      });
    }
  }

  return tasks;
}

function taskToNotification(task) {
  return {
    ...task,
    _id: task.id,
    isRead: false,
    type: "profile_completion",
    createdAt: null,
  };
}

module.exports = {
  PROFILE_COLUMNS,
  completionTasksForProfile,
  getProfileColumnSet,
  getProfileSelectList,
  profileCompletionForProfile,
  recruiterCompletionCriteria,
  shapeProfile,
  taskToNotification,
  trimOrNull,
};
