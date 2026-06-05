export const defaultProfile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  companyName: "",
  companyWebsite: "",
  companyDescription: "",
  companyLogoUrl: "",
  companyLocation: "",
  applicationUseAccountEmail: true,
  applicationEmail: "",
  applicationPhone: "",
  applicationWebsite: "",
  applicationInstructions: "",
  emailNotifications: true,
  smsNotifications: false,
  leadNotifications: true,
  weeklySummaryEmails: true,
  savedSearchAlerts: false,
  specialtyInterests: [],
};

export function shapeProfileForm(profile = {}, fallbackUser = {}) {
  return {
    ...defaultProfile,
    firstName: profile.firstName || profile.first_name || fallbackUser.firstName || "",
    lastName: profile.lastName || profile.last_name || fallbackUser.lastName || "",
    email: profile.email || fallbackUser.email || "",
    phone: profile.phone || "",
    companyName: profile.companyName || profile.company || fallbackUser.company || "",
    companyWebsite: profile.companyWebsite || profile.company_website || "",
    companyDescription: profile.companyDescription || profile.company_description || "",
    companyLogoUrl: profile.companyLogoUrl || profile.company_logo_url || "",
    companyLocation: profile.companyLocation || profile.company_location || "",
    applicationUseAccountEmail:
      profile.applicationUseAccountEmail ??
      profile.application_use_account_email ??
      true,
    applicationEmail: profile.applicationEmail || profile.application_email || "",
    applicationPhone: profile.applicationPhone || profile.application_phone || "",
    applicationWebsite: profile.applicationWebsite || profile.application_website || "",
    applicationInstructions:
      profile.applicationInstructions || profile.application_instructions || "",
    emailNotifications:
      profile.emailNotifications ?? profile.email_notifications ?? true,
    smsNotifications:
      profile.smsNotifications ?? profile.sms_notifications ?? false,
    leadNotifications:
      profile.leadNotifications ?? profile.lead_notifications ?? true,
    weeklySummaryEmails:
      profile.weeklySummaryEmails ?? profile.weekly_summary_emails ?? true,
    savedSearchAlerts:
      profile.savedSearchAlerts ?? profile.saved_search_alerts ?? false,
    specialtyInterests:
      profile.specialtyInterests || profile.specialty_interests || [],
  };
}

export function profileSavePayload(form) {
  return {
    firstName: form.firstName,
    lastName: form.lastName,
    phone: form.phone,
    companyName: form.companyName,
    companyWebsite: form.companyWebsite,
    companyDescription: form.companyDescription,
    companyLogoUrl: form.companyLogoUrl,
    companyLocation: form.companyLocation,
    applicationUseAccountEmail: form.applicationUseAccountEmail,
    applicationEmail: form.applicationEmail,
    applicationPhone: form.applicationPhone,
    applicationWebsite: form.applicationWebsite,
    applicationInstructions: form.applicationInstructions,
    emailNotifications: form.emailNotifications,
    smsNotifications: form.smsNotifications,
    leadNotifications: form.leadNotifications,
    weeklySummaryEmails: form.weeklySummaryEmails,
    savedSearchAlerts: form.savedSearchAlerts,
    specialtyInterests: form.specialtyInterests,
  };
}

export function splitInterests(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinInterests(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

export function recruiterContactMethodCount(profile) {
  let count = 0;
  if (profile.applicationUseAccountEmail && profile.email) count += 1;
  if (profile.applicationEmail) count += 1;
  if (profile.applicationPhone) count += 1;
  if (profile.applicationWebsite) count += 1;
  return count;
}

export function recruiterCompletionCriteria(profile) {
  const hasContactMethod = recruiterContactMethodCount(profile) > 0;
  const notificationPrefsSet =
    profile.emailNotifications || profile.leadNotifications || profile.weeklySummaryEmails;

  return [
    {
      id: "profile:recruiter:application-email",
      severity: "critical",
      weight: 40,
      completed: hasContactMethod,
      label: "Add Application Email",
      incompleteLabel: "No candidate contact method",
      message: "Candidates currently have no contact method for this account.",
      whyItMatters: "Candidates cannot currently contact you.",
      target: "application-preferences",
      link: "/recruiter/profile#application-preferences",
      actionLabel: "Add Application Email",
    },
    {
      id: "profile:recruiter:company-name",
      severity: "recommended",
      weight: 20,
      completed: !!profile.companyName,
      label: "Add Company Name",
      incompleteLabel: "Company name missing",
      message: "Add your company name so candidates know who they are contacting.",
      whyItMatters: "Company names make job posts feel credible and specific.",
      target: "company-information",
      link: "/recruiter/profile#company-information",
      actionLabel: "Add Company Name",
    },
    {
      id: "profile:recruiter:company-description",
      severity: "recommended",
      weight: 15,
      completed: !!profile.companyDescription,
      label: "Add Company Description",
      incompleteLabel: "Company description missing",
      message: "Add a company description to improve candidate response rates.",
      whyItMatters: "Candidates respond better when they understand the practice.",
      target: "company-information",
      link: "/recruiter/profile#company-information",
      actionLabel: "Add Company Description",
    },
    {
      id: "profile:recruiter:company-website",
      severity: "recommended",
      weight: 15,
      completed: !!profile.companyWebsite,
      label: "Add Company Website",
      incompleteLabel: "Company website missing",
      message: "Add a company website to increase trust and credibility.",
      whyItMatters: "A website helps candidates verify the opportunity.",
      target: "company-information",
      link: "/recruiter/profile#company-information",
      actionLabel: "Add Company Website",
    },
    {
      id: "profile:recruiter:company-logo",
      severity: "optional",
      weight: 5,
      completed: !!profile.companyLogoUrl,
      label: "Add Company Logo",
      incompleteLabel: "Company logo optional",
      message: "Add a company logo when available.",
      whyItMatters: "A logo can make listings easier to recognize.",
      target: "company-information",
      link: "/recruiter/profile#company-information",
      actionLabel: "Add Company Logo",
    },
    {
      id: "profile:recruiter:notification-preferences",
      severity: "optional",
      weight: 5,
      completed: !!notificationPrefsSet,
      label: "Review Notification Preferences",
      incompleteLabel: "Notification preferences optional",
      message: "Review notification preferences for future lead and summary alerts.",
      whyItMatters: "Notification preferences prepare your account for future alert delivery.",
      target: "notification-preferences",
      link: "/recruiter/profile#notification-preferences",
      actionLabel: "Review Notifications",
    },
  ];
}

export function recruiterCompletionSummary(profile) {
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
    score,
    criteria,
    tasks,
    attentionTasks,
    attentionCount: attentionTasks.length,
    criticalCount,
    recommendedCount,
    optionalCount,
    summary: attentionTasks.length
      ? `${attentionTasks.length} item${attentionTasks.length === 1 ? "" : "s"} need attention`
      : "Candidate contact details are ready",
  };
}

export function recruiterCompletionTasks(profile) {
  return recruiterCompletionSummary(profile).attentionTasks;
}

export function roleLabel(role) {
  const value = String(role || "").toLowerCase();
  if (value === "admin") return "Admin";
  if (value === "recruiter") return "Recruiter";
  if (value === "candidate") return "Candidate";
  return "Account";
}
