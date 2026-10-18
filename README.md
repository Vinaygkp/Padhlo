# 📚 Padhlo — Padho. Seekho. Aage Badho.

**Padhlo** is a mobile-first Android learning application designed to help college students access academic resources in one place. It brings together study notes, PDF resources, visual short notes, exam schedules, syllabus topics, announcements, and an AI-powered study assistant.

Built with **React Native, Expo, Expo Router, Node.js, Express.js, MongoDB, and Appwrite**, Padhlo aims to make everyday college learning more organized and accessible.

---

## ✨ Features

### 👨‍💼 Admin Features
- Upload and manage study notes and PDF resources.
- Publish image-based short notes and learning materials.
- Manage exam schedules, dates, times, rooms, and instructions.
- Publish and organize syllabus topics and important units.
- Share announcements with students.
- Restrict administrative operations through role-based authorization.

### 🎓 Student Features
- **Student authentication:** Register and sign in to access learning resources.
- **Branch and year filtering:** Display relevant academic material according to student details and access rules.
- **Home dashboard:** View a personalized greeting, branch information, daily thought, recent resources, and upcoming exam information where available.
- **Notes archive:** Browse, search, and filter study notes.
- **PDF resources:** Preview supported PDFs and access available download or sharing options.
- **Short notes:** View visual notes, diagrams, mind maps, and formula sheets where provided.
- **Exam schedule:** Check published exam dates and timetable details.
- **Syllabus:** Explore available subjects, units, topics, and important exam-related content.
- **AI Study Assistant:** Get study-related help and explanations through the configured AI integration.
- **Secure sessions:** Use authenticated API requests and role-based access controls.

*Feature availability depends on the implemented screen, backend configuration, published content, and active third-party services.*

---

## 🎨 Design System

Padhlo uses a premium dark interface with a pure-black background and electric accent colors.

| UI element | Color |
|---|---|
| Background | `#000000` |
| Surface cards | `#101014` |
| Elevated surfaces | `#17171F` |
| Borders | `#292933` |
| Primary purple | `#A855F7` |
| Electric blue | `#38BDF8` |
| Neon pink | `#F472B6` |
| Cyan | `#22D3EE` |
| Success green | `#34D399` |
| Highlight gold | `#FBBF24` |
| Warning red | `#F87171` |

The interface is designed for mobile screens, clear navigation, and a consistent learning experience.

---

## 🧰 Technology Stack

### Frontend
- React Native
- Expo SDK
- Expo Router
- TypeScript
- SecureStore and AsyncStorage for supported local persistence

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT-based authentication and role authorization

### Storage and Integrations
- **Appwrite Storage:** Cloud storage for supported PDF and image resources.
- **MongoDB:** User accounts, academic resource metadata, schedules, and other application records.
- **SMTP:** Email delivery for configured authentication and notification flows.
- **AI services:** Configured provider integrations, subject to valid server-side API keys.
- **Expo Application Services (EAS):** Cloud builds for installable Android APKs.

---

## 📁 Project Structure

The project separates the mobile frontend from the backend API.

```text
Padhlo/
├── frontend/
│   ├── src/
│   │   ├── app/                  # Expo Router screens and navigation
│   │   ├── components/           # Reusable UI components
│   │   ├── constants/
│   │   │   └── api.ts            # API base URL configuration
│   │   ├── services/             # API and application services
│   │   ├── store/                # Shared application state
│   │   └── types/                # TypeScript definitions
│   ├── app.json                  # Expo app configuration
│   ├── eas.json                  # EAS build profiles
│   ├── package.json              # Frontend dependencies and scripts
│   └── .env                      # Local environment config; do not commit
│
├── backend/
│   ├── src/
│   │   ├── middleware/
│   │   │   └── auth.js           # Authentication and authorization
│   │   ├── models/
│   │   │   └── index.js          # MongoDB/Mongoose models
│   │   ├── seed-admin.js         # Initial admin setup, if required
│   │   └── server.js             # Express API and routes
│   ├── package.json              # Backend dependencies and scripts
│   └── .env                      # Server secrets; do not commit
│
├── .gitignore
└── README.md
```

*This is a high-level map of the project. Individual files and features may differ according to the current codebase.*

---

## ⚙️ Requirements

Install the following before running the project locally:

- Node.js 18 or later, subject to dependency compatibility.
- npm.
- Git.
- Expo Go for compatible development testing, or an Android device/emulator.
- Access to the configured MongoDB database and Appwrite project.
- Valid server-side credentials for any enabled email or AI integrations.

---

## 🚀 Run the Project Locally

### 1. Start the backend

Open a terminal in the backend directory:

```bash
cd backend
npm install
```

Create `backend/.env` and configure the environment variables required by the backend. Use your own database connection string and service credentials.

Start the API:

```bash
npm start
```

The server uses `process.env.PORT` when provided and falls back to port `5000` for local development.

### 2. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
```

Configure the frontend API URL in `frontend/.env`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:5000
```

Replace `YOUR_COMPUTER_LAN_IP` with your computer's reachable local network IP address for physical-device development. Do not use this local URL in a production APK.

Start Expo:

```bash
npx expo start
```

For compatible Expo Go testing, connect your Android phone and computer to the same Wi-Fi network and scan the QR code.

## ☁️ File Storage and Database

### MongoDB
MongoDB stores application records such as user accounts, resource metadata, and academic information.

Use a reachable database for deployment. A local URI such as `mongodb://127.0.0.1:27017/...` points to the machine running the backend and is not a substitute for a production database.

### Appwrite Storage
Appwrite is configured as the cloud storage provider for supported uploaded files.

- Configure the correct Appwrite endpoint, project ID, API key, and existing bucket ID.
- Store resource metadata and file references in the database as implemented by the backend.
- Verify upload, access control, preview, and download behavior against the deployed service.
- Do not assume that files in a temporary server filesystem will persist across redeployments.

The Appwrite API key must remain private. Use the existing configured bucket where required by your plan; do not create a second bucket unless your account supports it and the application needs it.

---

## 🌐 Deploy the Backend to Render

The backend must have a public HTTPS URL before a standalone production APK can communicate with it outside your local network.

1. Push the project to a GitHub repository.
2. Open the [Render Dashboard](https://dashboard.render.com/).
3. Create a **New Web Service** and connect the repository.
4. Configure the service using the actual repository structure:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Environment | Add required backend variables securely |

Choose an available instance plan. Free-tier availability, limits, and sleep behavior can change.

Add the required environment variables through Render's private environment settings. Do not upload your local `.env` file.

After deployment, copy the actual HTTPS service URL provided by Render. Confirm that the backend starts successfully and that its health endpoint, database connection, authentication, and storage integrations work.

**Deployment status:** The production Render URL must be configured and verified before the production APK is built. A sample URL is not a working deployment.

---

## 📱 Production API Configuration

The frontend API configuration is maintained in:

```text
frontend/src/constants/api.ts
```

Set `EXPO_PUBLIC_API_URL` to the actual deployed backend HTTPS URL for the production build.

For production, the API configuration is designed to reject insecure or local addresses, including localhost and private LAN IPs, rather than silently falling back to a development URL.

After changing the production URL, rebuild the APK. A previously built APK will not automatically receive a newly configured API URL.

---

## 📦 Build an Installable Android APK

Padhlo uses Expo Application Services (EAS) to build Android packages in the cloud.

### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

### 2. Log in

```bash
eas login
```

### 3. Check the EAS configuration

The project includes `frontend/eas.json` with APK build profiles. The `production-apk` and `preview` profiles are configured for direct Android installation using:

```json
{
  "android": {
    "buildType": "apk"
  }
}
```

Keep the existing complete configuration in `eas.json`; the snippet above only illustrates the Android build setting.

### 4. Build the APK

Run the commands from the frontend directory:

```bash
cd frontend
eas build --platform android --profile production-apk
```

Use the `preview` profile instead if that is the intended configured profile.

Wait for EAS to finish the cloud build, then use the actual build page to download the generated `.apk` file.

**Important:** Complete backend deployment and production API configuration before creating the final APK. An APK build alone does not verify that login, email delivery, database access, or file storage works.

---

## ✅ Pre-Release Testing Checklist

Before sharing the APK with students, test the installed build on a real Android device.

- [ ] App opens and navigation works.
- [ ] Student registration and login work.
- [ ] OTP or email verification works if enabled.
- [ ] Student sessions remain valid as expected.
- [ ] Admin-only screens and API endpoints reject student access.
- [ ] Branch/year restrictions are enforced by the backend.
- [ ] Notes, syllabus, announcements, and exam schedules load from the deployed API.
- [ ] PDF previews and external links work.
- [ ] Supported uploads, downloads, and image previews work with Appwrite.
- [ ] AI features work with valid configured credentials.
- [ ] Production requests use HTTPS and no local development URL.
- [ ] No secrets are exposed in the APK, logs, or repository.

---

## 📌 Current Project Status

- **Frontend preparation:** Reported complete.
- **Backend deployment preparation:** Reported complete.
- **TypeScript and ESLint checks:** Reported passing in the latest project audit.
- **EAS APK configuration:** Reported prepared.
- **Production backend URL:** Pending deployment and verification.
- **Final production APK:** Pending production URL configuration, build, and device testing.

These statuses describe the latest reported preparation; they do not independently certify a live deployment or a tested production APK.

---

## 👨‍💻 Project

**Padhlo — Padho. Seekho. Aage Badho.**

A student-focused Android learning application built to organize college study materials and make academic resources easier to access.

**Developed by Vinay Kumar**

