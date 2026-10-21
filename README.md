# Interview AI

Interview AI is a web application for preparing for job interviews. It uses a resume and job description to generate a personalized interview plan, then lets the user practice in a text-based live mock interview and receive an AI-generated evaluation.

## Features

- User registration, login, session restoration, and logout.
- AI-generated interview plan based on a resume and job description.
- Match score, technical and behavioral question suggestions, model answers, skill gaps, and a day-by-day preparation roadmap.
- Saved interview plans and recent report history.
- Authenticated, text-based live mock interview using Socket.IO.
- Final interview feedback with a score, summary, strengths, areas for improvement, and transcript, saved to MongoDB.
- AI-generated, downloadable resume PDF tailored to the job description.

## Technology

| Area | Technologies |
| --- | --- |
| Frontend | React 19, Vite, React Router, Axios, Socket.IO Client, Sass, Lucide React |
| Backend | Node.js, Express 5, Socket.IO, Mongoose, JWT, bcryptjs, Multer |
| AI | Google GenAI SDK (`gemini-3-flash-preview`), Zod structured output |
| PDF | `pdf-parse` for resume text extraction; Puppeteer for generated PDF output |
| Database | MongoDB |

## Project Structure

```text
.
|-- Backend/
|   |-- server.js                 # HTTP, Express, Socket.IO and database startup
|   `-- src/
|       |-- app.js                # Express middleware and API registration
|       |-- config/database.js    # MongoDB connection
|       |-- controllers/          # Authentication and interview HTTP handlers
|       |-- middlewares/          # JWT authentication and in-memory file upload
|       |-- models/               # User, token blacklist, and interview report schemas
|       |-- routes/               # REST API routes
|       |-- services/             # AI report/PDF generation and live interview logic
|       `-- sockets/              # Live interview socket event handlers
`-- Frontend/
    |-- src/
    |   |-- App.jsx               # Application providers and root composition
    |   |-- app.routes.jsx        # Login, registration, home, and report routes
    |   `-- features/
    |       |-- auth/             # Auth pages, context, hooks, and API client
    |       `-- interview/        # Home, report, live interview, and API client
    `-- vite.config.js
```

## Requirements

- Node.js and npm.
- A MongoDB instance and connection URI.
- A Google GenAI API key with access to the configured Gemini model.
- Google Chrome installed for Puppeteer PDF generation, or a Puppeteer-compatible browser runtime.

## Configuration

Create `Backend/.env`:

```dotenv
PORT=3001
MONGO_URI=mongodb://127.0.0.1:27017/interview-ai
JWT_SECRET=replace-with-a-long-random-secret
GOOGLE_GENAI_API_KEY=your-google-genai-api-key
```

Set `MONGO_URI` to your own MongoDB connection string. `JWT_SECRET` is used to sign authentication tokens. `GOOGLE_GENAI_API_KEY` is used by both AI services.

Create `Frontend/.env` only if your backend is not using the default local URL:

```dotenv
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

The frontend defaults both URLs to `http://localhost:3001`. Vite environment variables must start with `VITE_`. Restart the Vite server after changing them.

## Run Locally

Install backend dependencies and start the backend from the project root:

```bash
cd Backend
npm install
npm run dev
```

The backend development script runs `nodemon server.js`. Set `PORT` in `Backend/.env`; the server does not define a fallback port.

In another terminal, install frontend dependencies and start Vite:

```bash
cd Frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

The root `package.json` does not define application scripts. Install and run each app from its own directory. The backend package's `start` script currently points to `app.js`; use `npm run dev` for the configured server entry point (`server.js`).

## Application Workflow

1. Register with a username, email, and password, then log in.
2. On the home page, provide the target job description and resume details, then generate an interview plan.
3. Review the report's match score, technical and behavioral questions, model answers, skill gaps, and preparation roadmap.
4. Open **Live Mock Interview** and answer questions in the text chat. The question count is selected from the job description length, with a default of five.
5. End the session to generate the final evaluation. On success, the backend marks the report as completed and saves the transcript and feedback fields to MongoDB.
6. Use **Download Resume** to generate and download a tailored PDF from the report's stored profile information.

## Frontend

The frontend is a single-page React application with these routes:

| Route | Access | Purpose |
| --- | --- | --- |
| `/register` | Public | Create an account |
| `/login` | Public | Sign in |
| `/` | Authenticated | Create a plan and browse recent reports |
| `/interview/:interviewId` | Authenticated | View a report, use the live interview, and download a resume PDF |

Authentication state is shared through React context. The API client sends the JWT as a Bearer token when available and also sends cookies (`withCredentials`). The live interview client sends the token in the Socket.IO handshake.

The home page calls the interview API with `multipart/form-data`. The report view loads the selected report, then displays its generated questions, answer guidance, skill gaps, and roadmap. The live session displays interviewer/candidate messages, supports retrying question generation, and shows the final evaluation when the server returns it.

## Backend

The Express app registers routes under `/api/auth` and `/api/interview`. JWT middleware protects the private REST routes. Passwords are hashed with bcryptjs; issued JWTs expire after one day. Logout clears the token cookie and records its token in the blacklist collection.

The AI report service extracts text from the uploaded resume, calls Gemini for structured report data, validates the response using a Zod schema, and creates an `InterviewReport` document. The live interview service asks questions based on the role, job description, resume, and recent transcript context. At the end of the session it validates the feedback and updates the report with its completion status, transcript, score, summary, strengths, and areas for improvement.

The resume PDF service asks Gemini for tailored resume HTML and uses Puppeteer to render it as an A4 PDF. The service checks common Windows Chrome locations before using Puppeteer's default browser.

### Interview Report Data

An interview report stores the job description, resume text, optional self-description, role title, initial match score, technical and behavioral question sets, skill gaps, and preparation plan. Live interview completion additionally stores:

- `status`: `In Progress` or `Completed`
- `transcript`: ordered interviewer and candidate messages
- `matchScore`: final mock-interview score
- `summary`: evaluation summary
- `strengths`: feedback strengths
- `areasForImprovement`: suggested improvements

Mongoose timestamps provide `createdAt` and `updatedAt` values.

## REST API

Private routes require a valid JWT, normally sent as `Authorization: Bearer <token>` or through the `token` cookie.

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Register with JSON `{ "username", "email", "password" }` |
| `POST` | `/api/auth/login` | Public | Log in with JSON `{ "email", "password" }` |
| `GET` | `/api/auth/logout` | Public | Clear the cookie and blacklist its token |
| `GET` | `/api/auth/get-me` | Private | Return the authenticated user |
| `POST` | `/api/interview/` | Private | Generate and store an interview plan; multipart fields: `resume`, `jobDescription`, and optional `selfDescription` |
| `GET` | `/api/interview/` | Private | List the current user's reports, newest first |
| `GET` | `/api/interview/report/:interviewId` | Private | Fetch one of the current user's reports |
| `POST` | `/api/interview/resume/pdf/:interviewReportId` | Private | Generate and return a PDF for a stored report |

The resume PDF endpoint returns `application/pdf`. The report-generation endpoint returns the created report in the `interviewReport` response property.

## Live Interview Socket Events

The Socket.IO connection authenticates with `auth: { token }`.

| Direction | Event | Data / behavior |
| --- | --- | --- |
| Client to server | `start-interview` | `{ interviewReportId }`; loads the report and starts a session |
| Server to client | `interview-started` | Confirms session startup |
| Server to client | `text-response` | `{ text, questionNumber }`; sends a question or completion notice |
| Client to server | `text-message` | `{ text }`; submits a candidate answer |
| Client to server | `retry-question` | Requests another attempt at generating the current question |
| Client to server | `end-interview` | Starts final feedback generation and persistence |
| Server to client | `generating-feedback` | Indicates that final evaluation is being generated |
| Server to client | `interview-ended` | `{ feedback }`; sends the evaluation after the save succeeds |
| Server to client | `session-error` | Reports a question-generation problem |
| Server to client | `error` | Reports a connection, session, or finalization error |

## Validation and Current Limitations

- The backend requires a resume file when generating a report and currently extracts PDF text. The frontend upload label mentions PDF or DOCX and says 5 MB, but the backend Multer limit is 3 MB and DOCX parsing is not implemented. Use a PDF no larger than 3 MB. The frontend also permits self-description without a resume, but the current backend endpoint rejects requests without an uploaded file.
- The live interview is text-based; it does not implement audio or video interviewing.
- Report creation and final feedback generation require a working Gemini API key and network access to Google GenAI.
- The Express CORS policy currently allows localhost and 127.0.0.1 origins. Update it before using a separately hosted frontend.
- REST report reads are scoped to the authenticated user. The current Socket.IO start handler authenticates the socket but loads the report by ID without checking report ownership; add an ownership check before deploying live interviews for multiple users.
- The backend currently has no configured automated test suite (`npm test` is a placeholder script).

## Useful Commands

Frontend production build and lint:

```bash
cd Frontend
npm run build
npm run lint
```

Backend development server:

```bash
cd Backend
npm run dev
```
