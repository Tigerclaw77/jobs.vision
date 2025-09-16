# Updating Job Fields in Opportometry

## When to Update Different Files
| **Change**                        | **Files to Update**                                  |
|-----------------------------------|--------------------------------------------------|
| Add/Remove a Job Field            | `models/Job.js`, `routes/jobs.js`, `AddJob.jsx`, `JobList.jsx` |
| Make a Field Required/Optional    | `models/Job.js`, `routes/jobs.js`                |
| Update Job Form Inputs (Frontend) | `AddJob.jsx`                                      |
| Change Job Display (Frontend)     | `JobList.jsx`                                    |

## Steps to Apply Changes
1. **Update the necessary files based on the table above**.
2. **Restart your backend (`node server.js`) and frontend (`npm start`)**.
3. **Test by submitting and retrieving jobs**.


# Updating Job Fields in Opportometry

## When to Update Different Files

|   |
| - |

| **Change**                        | **Files to Update**                                            |
| --------------------------------- | -------------------------------------------------------------- |
| Add/Remove a Job Field            | `models/Job.js`, `routes/jobs.js`, `AddJob.jsx`, `JobList.jsx` |
| Make a Field Required/Optional    | `models/Job.js`, `routes/jobs.js`                              |
| Update Job Form Inputs (Frontend) | `AddJob.jsx`                                                   |
| Change Job Display (Frontend)     | `JobList.jsx`                                                  |

## Steps to Apply Changes

1. **Update the necessary files based on the table above**.
2. **Restart your backend (**``**) and frontend (**``**)**.
3. **Test by submitting and retrieving jobs**.

## Example: Making `practiceMode` Optional

### **1️⃣ Modify **``

Find this line:

```javascript
practiceMode: { type: String, enum: ["employed", "contract", "lease", "associate"], required: true },
```

Replace with:

```javascript
practiceMode: { type: String, enum: ["employed", "contract", "lease", "associate"], default: null },
```

### **2️⃣ Modify **``

Find:

```javascript
const { title, description, company, practiceMode, corporation = null } = req.body;
```

Replace with:

```javascript
const { title, description, company, corporation = null } = req.body;
const practiceMode = req.body.practiceMode || null; // Default to null if missing
```

### **3️⃣ Restart Backend and Test Again**

```bash
node server.js
```

Then test posting a job:

```bash
curl -X POST http://localhost:5000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Surgeon",
    "description": "Fix stuff",
    "company": "Delta",
    "location": "Toronto",
    "salary": "100k"
  }'
```

✅ **Expected Output:**

```json
{
  "message": "Job posted successfully!",
  "job": {
    "_id": "65e4b12345b6cdef7890abcd",
    "title": "Surgeon",
    "description": "Fix stuff",
    "company": "Delta",
    "location": "Toronto",
    "salary": "100k",
    "practiceMode": null,
    "createdAt": "2025-02-19T12:00:00Z"
  }
}
```

# Updating Recruiter Registration Fields in Opportometry

## When to Update Different Files

| **Change**                        | **Files to Update**                                      |
|-----------------------------------|------------------------------------------------------|
| Add/Remove a Recruiter Field      | `models/User.js`, `routes/auth.js`, `RecruiterRegistration.jsx` |
| Make a Field Required/Optional    | `models/User.js`, `routes/auth.js`                    |
| Update Registration Form (Frontend) | `RecruiterRegistration.jsx`                           |
| Display Recruiter Data After Login | `RecruiterDashboard.js`                              |

## Steps to Apply Changes

1. **Update the necessary files based on the table above**.
2. **Restart your backend (`node server.js`) and frontend (`npm start`)**.
3. **Test by registering a recruiter and ensuring all fields are stored correctly**.

---

## Example: Adding `companyName` & `recruiterType` to Recruiter Registration

### **1️⃣ Modify `RecruiterRegistration.jsx`**
Find this section:

```javascript
const [formData, setFormData] = useState({
  name: "",
  email: "",
  password: "",
});
```

Replace with:

```javascript
const [formData, setFormData] = useState({
  name: "",
  email: "",
  password: "",
  companyName: "",  // ✅ New Field
  recruiterType: "independent",  // ✅ Default Value
});
```

Then, add input fields inside the form:

```javascript
<input type="text" name="companyName" placeholder="Company Name" value={formData.companyName} onChange={handleChange} />
<select name="recruiterType" value={formData.recruiterType} onChange={handleChange}>
  <option value="independent">Independent</option>
  <option value="corporate">Corporate</option>
</select>
```

---

### **2️⃣ Modify `models/User.js`**
Find the `recruiterInfo` schema and add the new fields:

```javascript
const recruiterInfoSchema = new mongoose.Schema({
  recruiterType: { type: String, enum: ["corporate", "independent"], default: "independent" },
  corporation: { type: String, default: null },
  companyName: { type: String, required: true }, // ✅ New Field
});
```

Then, ensure `recruiterInfo` is included in `userSchema`:

```javascript
const userSchema = new mongoose.Schema({
  userID: { type: String, default: uuidv4, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["candidate", "recruiter", "admin"], required: true },
  recruiterInfo: recruiterInfoSchema,  // ✅ Ensure recruiter info is included
});
```

---

### **3️⃣ Modify `routes/auth.js`**
Find the registration endpoint and modify it to handle the new fields:

```javascript
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, companyName, recruiterType } = req.body;

    const user = new User({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role,
      recruiterInfo: role === "recruiter" ? { companyName, recruiterType } : undefined,
    });

    await user.save();
    res.status(201).json({ message: "User registered successfully!", userID: user.userID });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Registration failed." });
  }
});
```

---

### **4️⃣ Update `RecruiterDashboard.js` to Display New Fields**
Modify the recruiter dashboard to display `companyName` and `recruiterType` after login:

```javascript
useEffect(() => {
  const fetchRecruiterInfo = async () => {
    try {
      const response = await axiosInstance.get("/auth/me");
      setRecruiterInfo(response.data.recruiterInfo);
    } catch (error) {
      console.error("Error fetching recruiter info:", error);
    }
  };

  fetchRecruiterInfo();
}, []);

return (
  <div>
    <h1>Recruiter Dashboard</h1>
    <h2>Company: {recruiterInfo?.companyName}</h2>
    <h3>Recruiter Type: {recruiterInfo?.recruiterType}</h3>
  </div>
);
```

✅ **Now, recruiters will see their `companyName` and `recruiterType` displayed in their dashboard.**


```
Opportometry
├─ backend
│  ├─ config
│  │  └─ database.js
│  ├─ controllers
│  │  ├─ adminController.js
│  │  ├─ authController.js
│  │  └─ jobController.js
│  ├─ middleware
│  │  └─ verifyRole.js
│  ├─ models
│  │  ├─ Job.js
│  │  └─ User.js
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ routes
│  │  ├─ adminRoutes.js
│  │  ├─ authRoutes.js
│  │  ├─ candidateRoutes.js
│  │  ├─ jobRoutes.js
│  │  ├─ paymentRoutes.js
│  │  ├─ profileRoutes.js
│  │  ├─ recommendationRoutes.js
│  │  ├─ registerRoutes.js
│  │  └─ userRoutes.js
│  ├─ scripts
│  │  ├─ generateHash.js
│  │  ├─ generateToken.js
│  │  ├─ seedJobs.js
│  │  └─ testEmail.js
│  ├─ server.js
│  └─ services
│     └─ emailService.js
├─ frontend
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ public
│  │  ├─ images
│  │  │  ├─ admin.jpg
│  │  │  ├─ advanced-search.jpg
│  │  │  ├─ basic-search.jpg
│  │  │  ├─ bg0.jpg
│  │  │  ├─ bg1.jpg
│  │  │  ├─ bg2.jpg
│  │  │  ├─ bg3.jpg
│  │  │  ├─ bg4.jpg
│  │  │  ├─ bg5.jpg
│  │  │  ├─ bg6.jpg
│  │  │  ├─ bg7.jpg
│  │  │  ├─ bg8.jpg
│  │  │  ├─ bg9.webp
│  │  │  ├─ browse-jobs.jpg
│  │  │  ├─ candidate.jpg
│  │  │  ├─ candidate2.jpg
│  │  │  ├─ edit-jobs.jpg
│  │  │  ├─ eyedoctor.jpg
│  │  │  ├─ eyedoctor2.jpg
│  │  │  ├─ mobile-banner.jpg
│  │  │  ├─ ol1.jpg
│  │  │  ├─ optician.jpg
│  │  │  ├─ post-job.jpg
│  │  │  ├─ post-resume.jpg
│  │  │  ├─ receptionist.jpg
│  │  │  ├─ recruiter.jpg
│  │  │  ├─ staff.jpg
│  │  │  ├─ tech.jpg
│  │  │  └─ upgrade.jpg
│  │  ├─ index.html
│  │  ├─ manifest.json
│  │  └─ robots.txt
│  ├─ README.md
│  ├─ src
│  │  ├─ App.js
│  │  ├─ axiosInstance.js
│  │  ├─ components
│  │  │  ├─ AdminDashboard
│  │  │  │  ├─ AdminDashboard.css
│  │  │  │  ├─ AdminDashboard.jsx
│  │  │  │  ├─ AdminJobs.jsx
│  │  │  │  ├─ IncomeWidget.jsx
│  │  │  │  ├─ StatsCards.jsx
│  │  │  │  └─ UserTable.jsx
│  │  │  ├─ Candidate
│  │  │  │  ├─ CandidateDashboard.jsx
│  │  │  │  ├─ CandidateProfile.jsx
│  │  │  │  ├─ CandidateRegistration.jsx
│  │  │  │  ├─ RecommendedJobs.jsx
│  │  │  │  ├─ SavedJobs.jsx
│  │  │  │  ├─ SearchJobs.jsx
│  │  │  │  ├─ TODO-ApplyJobs.jsx
│  │  │  │  ├─ TODO-CandidateHistory.jsx
│  │  │  │  └─ TODO-Favorites.jsx
│  │  │  ├─ Card.js
│  │  │  ├─ EmailVerification.jsx
│  │  │  ├─ Footer.jsx
│  │  │  ├─ ForgotPassword.jsx
│  │  │  ├─ Header.jsx
│  │  │  ├─ Home.jsx
│  │  │  ├─ JobList.jsx
│  │  │  ├─ Login.jsx
│  │  │  ├─ Logout.jsx
│  │  │  ├─ LogoutSuccess.jsx
│  │  │  ├─ OptionsSection.jsx
│  │  │  ├─ PricingTable.jsx
│  │  │  ├─ Recruiter
│  │  │  │  ├─ AddJob.jsx
│  │  │  │  ├─ EditJob.jsx
│  │  │  │  ├─ JobStats.jsx
│  │  │  │  ├─ PricingTiers.jsx
│  │  │  │  ├─ RecruiterDashboard.jsx
│  │  │  │  ├─ RecruiterRegistration.jsx
│  │  │  │  ├─ RecruiterTour.jsx
│  │  │  │  ├─ TODO-ManageJobs.jsx
│  │  │  │  ├─ TODO-RecruiterAccount.jsx
│  │  │  │  └─ TODO-RecruiterHistory.jsx
│  │  │  ├─ Register.jsx
│  │  │  ├─ ResetPassword.jsx
│  │  │  ├─ TODO-Common
│  │  │  │  ├─ AboutUs.jsx
│  │  │  │  ├─ ContactUs.jsx
│  │  │  │  ├─ FAQ.jsx
│  │  │  │  ├─ NotFound.jsx
│  │  │  │  └─ PrivacyPolicy.jsx
│  │  │  ├─ ui
│  │  │  │  ├─ button.jsx
│  │  │  │  ├─ ButtonSubmit.jsx
│  │  │  │  ├─ CheckboxInput.jsx
│  │  │  │  ├─ GlassTextField.jsx
│  │  │  │  ├─ input.jsx
│  │  │  │  ├─ label.jsx
│  │  │  │  ├─ LoadingSpinner.jsx
│  │  │  │  ├─ SelectInput.jsx
│  │  │  │  ├─ textarea.jsx
│  │  │  │  └─ TextInput.jsx
│  │  │  ├─ Users.jsx
│  │  │  └─ VerifyEmail.jsx
│  │  ├─ index.js
│  │  ├─ ProtectedRoute.jsx
│  │  ├─ routes.js
│  │  ├─ store
│  │  │  ├─ authSlice.js
│  │  │  ├─ jobSlice.js
│  │  │  └─ store.js
│  │  ├─ styles
│  │  │  ├─ Card.css
│  │  │  ├─ Forms-old.css
│  │  │  ├─ Forms.css
│  │  │  ├─ Header.css
│  │  │  ├─ Home.css
│  │  │  ├─ JobCard.css
│  │  │  ├─ PricingTable.css
│  │  │  ├─ Profile.css
│  │  │  └─ Register.css
│  │  ├─ styles.css
│  │  ├─ theme.js
│  │  └─ utils
│  │     └─ api.js
│  └─ z-archive
│     ├─ adminAuth.js
│     ├─ auth.js
│     ├─ authController copy.js
│     ├─ authDevMode.js
│     ├─ authMiddleware.js
│     ├─ GlassBackground.jsx
│     ├─ GlassCard.jsx
│     ├─ GlassCardGrid.jsx
│     ├─ GlassDashboard.jsx
│     ├─ GlassForm.jsx
│     ├─ GlassLogin.jsx
│     ├─ JobCard-old.css
│     ├─ OptionsSection copy.jsx
│     ├─ project-structure.txt
│     ├─ register copy.js
│     ├─ zOld-Footer.css
│     ├─ zOLD-GlassMorphism.js
│     └─ zOLD-Home.css
├─ package-lock.json
├─ package.json
└─ README.md

```
```
Opportometry
├─ backend
│  ├─ config
│  │  └─ database.js
│  ├─ controllers
│  │  ├─ adminController.js
│  │  ├─ authController.js
│  │  └─ jobController.js
│  ├─ middleware
│  │  └─ verifyRole.js
│  ├─ models
│  │  ├─ Job.js
│  │  └─ User.js
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ routes
│  │  ├─ adminRoutes.js
│  │  ├─ authRoutes.js
│  │  ├─ candidateRoutes.js
│  │  ├─ jobRoutes.js
│  │  ├─ paymentRoutes.js
│  │  ├─ profileRoutes.js
│  │  ├─ recommendationRoutes.js
│  │  ├─ registerRoutes.js
│  │  └─ userRoutes.js
│  ├─ scripts
│  │  ├─ generateHash.js
│  │  ├─ generateToken.js
│  │  ├─ seedJobs.js
│  │  └─ testEmail.js
│  ├─ server.js
│  └─ services
│     └─ emailService.js
├─ frontend
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ public
│  │  ├─ images
│  │  │  ├─ admin.jpg
│  │  │  ├─ advanced-search.jpg
│  │  │  ├─ basic-search.jpg
│  │  │  ├─ bg0.jpg
│  │  │  ├─ bg1.jpg
│  │  │  ├─ bg2.jpg
│  │  │  ├─ bg3.jpg
│  │  │  ├─ bg4.jpg
│  │  │  ├─ bg5.jpg
│  │  │  ├─ bg6.jpg
│  │  │  ├─ bg7.jpg
│  │  │  ├─ bg8.jpg
│  │  │  ├─ bg9.webp
│  │  │  ├─ browse-jobs.jpg
│  │  │  ├─ candidate.jpg
│  │  │  ├─ candidate2.jpg
│  │  │  ├─ edit-jobs.jpg
│  │  │  ├─ eyedoctor.jpg
│  │  │  ├─ eyedoctor2.jpg
│  │  │  ├─ mobile-banner.jpg
│  │  │  ├─ ol1.jpg
│  │  │  ├─ optician.jpg
│  │  │  ├─ post-job.jpg
│  │  │  ├─ post-resume.jpg
│  │  │  ├─ receptionist.jpg
│  │  │  ├─ recruiter.jpg
│  │  │  ├─ staff.jpg
│  │  │  ├─ tech.jpg
│  │  │  └─ upgrade.jpg
│  │  ├─ index.html
│  │  ├─ manifest.json
│  │  └─ robots.txt
│  ├─ README.md
│  ├─ src
│  │  ├─ App.js
│  │  ├─ axiosInstance.js
│  │  ├─ components
│  │  │  ├─ AdminDashboard
│  │  │  │  ├─ AdminDashboard.css
│  │  │  │  ├─ AdminDashboard.jsx
│  │  │  │  ├─ AdminJobs.jsx
│  │  │  │  ├─ IncomeWidget.jsx
│  │  │  │  ├─ StatsCards.jsx
│  │  │  │  └─ UserTable.jsx
│  │  │  ├─ Candidate
│  │  │  │  ├─ CandidateDashboard.jsx
│  │  │  │  ├─ CandidateProfile.jsx
│  │  │  │  ├─ CandidateRegistration.jsx
│  │  │  │  ├─ RecommendedJobs.jsx
│  │  │  │  ├─ SavedJobs.jsx
│  │  │  │  ├─ SearchJobs.jsx
│  │  │  │  ├─ TODO-ApplyJobs.jsx
│  │  │  │  ├─ TODO-CandidateHistory.jsx
│  │  │  │  └─ TODO-Favorites.jsx
│  │  │  ├─ Card.js
│  │  │  ├─ EmailVerification.jsx
│  │  │  ├─ Footer.jsx
│  │  │  ├─ ForgotPassword.jsx
│  │  │  ├─ Header.jsx
│  │  │  ├─ Home.jsx
│  │  │  ├─ JobList.jsx
│  │  │  ├─ Login.jsx
│  │  │  ├─ Logout.jsx
│  │  │  ├─ LogoutSuccess.jsx
│  │  │  ├─ OptionsSection.jsx
│  │  │  ├─ PricingTable.jsx
│  │  │  ├─ Recruiter
│  │  │  │  ├─ AddJob.jsx
│  │  │  │  ├─ EditJob.jsx
│  │  │  │  ├─ JobStats.jsx
│  │  │  │  ├─ PricingTiers.jsx
│  │  │  │  ├─ RecruiterDashboard.jsx
│  │  │  │  ├─ RecruiterRegistration.jsx
│  │  │  │  ├─ RecruiterTour.jsx
│  │  │  │  ├─ TODO-ManageJobs.jsx
│  │  │  │  ├─ TODO-RecruiterAccount.jsx
│  │  │  │  └─ TODO-RecruiterHistory.jsx
│  │  │  ├─ Register.jsx
│  │  │  ├─ ResetPassword.jsx
│  │  │  ├─ TODO-Common
│  │  │  │  ├─ AboutUs.jsx
│  │  │  │  ├─ ContactUs.jsx
│  │  │  │  ├─ FAQ.jsx
│  │  │  │  ├─ NotFound.jsx
│  │  │  │  └─ PrivacyPolicy.jsx
│  │  │  ├─ ui
│  │  │  │  ├─ button.jsx
│  │  │  │  ├─ ButtonSubmit.jsx
│  │  │  │  ├─ CheckboxInput.jsx
│  │  │  │  ├─ GlassTextField.jsx
│  │  │  │  ├─ input.jsx
│  │  │  │  ├─ label.jsx
│  │  │  │  ├─ LoadingSpinner.jsx
│  │  │  │  ├─ SelectInput.jsx
│  │  │  │  ├─ textarea.jsx
│  │  │  │  └─ TextInput.jsx
│  │  │  ├─ Users.jsx
│  │  │  └─ VerifyEmail.jsx
│  │  ├─ index.js
│  │  ├─ ProtectedRoute.jsx
│  │  ├─ routes.js
│  │  ├─ store
│  │  │  ├─ authSlice.js
│  │  │  ├─ jobSlice.js
│  │  │  └─ store.js
│  │  ├─ styles
│  │  │  ├─ Card.css
│  │  │  ├─ Forms-old.css
│  │  │  ├─ Forms.css
│  │  │  ├─ Header.css
│  │  │  ├─ Home.css
│  │  │  ├─ JobCard.css
│  │  │  ├─ PricingTable.css
│  │  │  ├─ Profile.css
│  │  │  └─ Register.css
│  │  ├─ styles.css
│  │  ├─ theme.js
│  │  └─ utils
│  │     └─ api.js
│  └─ z-archive
│     ├─ adminAuth.js
│     ├─ auth.js
│     ├─ authController copy.js
│     ├─ authDevMode.js
│     ├─ authMiddleware.js
│     ├─ GlassBackground.jsx
│     ├─ GlassCard.jsx
│     ├─ GlassCardGrid.jsx
│     ├─ GlassDashboard.jsx
│     ├─ GlassForm.jsx
│     ├─ GlassLogin.jsx
│     ├─ JobCard-old.css
│     ├─ OptionsSection copy.jsx
│     ├─ project-structure.txt
│     ├─ register copy.js
│     ├─ zOld-Footer.css
│     ├─ zOLD-GlassMorphism.js
│     └─ zOLD-Home.css
├─ package-lock.json
├─ package.json
└─ README.md

```