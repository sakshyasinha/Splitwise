# SplitSense - Full Stack Expense Sharing Platform

SplitSense is a full-stack web app for managing shared expenses, group balances, settlements, activity, notifications, receipts, recurring bills, and analytics.

**Live Demo:** [https://sakshyasinha.github.io/splitwise/](https://splitwise-qlql.vercel.app/)

---

## Overview

SplitSense helps groups track who paid, who participated, who owes money, and what still needs to be settled. It supports advanced split methods, group dashboards, real-time activity, payment-style settlement entries, and analytics for understanding shared spending.

Useful for:
- Roommates splitting rent, utilities, and recurring bills
- Travel groups tracking trip expenses
- Friends splitting food, events, and shared purchases
- Teams or families coordinating shared costs

---

## Current Features

### Authentication & Sessions
- Email/password registration and login
- Google sign-in support
- Google profile avatar support
- JWT access tokens and refresh-token infrastructure
- Current-user session refresh via `/api/auth/me`
- Protected frontend routes for dashboard, groups, activity, analytics, profile, and settings
- Session cleanup on auth expiry

### Dashboard
- Responsive dashboard with summary cards for spend, owed, lent, and group count
- Top navigation for Dashboard, Groups, Activity, Analytics, Profile, and Settings
- Profile menu with avatar or initials fallback
- Dashboard search for expenses and groups
- Quick actions for creating groups, adding expenses, and managing recurring bills
- Dark/light theme toggle
- Toast feedback and loading skeletons

### Group Management
- Create, edit, and delete groups
- Add and remove group members
- Group types such as trip, home, couple, project, and other
- Group detail modal with members, spending, outstanding balances, and related expenses
- Deduped group summaries for repeated/group-like records

### Expense Tracking
- Add, edit, delete, and view expenses
- Assign payer and participants
- Support for multiple split types:
  - Equal
  - Exact/custom amount
  - Percentage
  - Shares
  - Itemized
  - Adjustment
  - Payment/direct settlement-style entries
- Expense categories such as food, travel, utilities, shopping, rent, entertainment, healthcare, education, and other
- Expense notes, tags, date, and optional receipt attachment fields
- Audit logs for expense changes
- Per-expense chat entry point and unread indicators

### Debt & Settlements
- My Dues view for money the signed-in user owes
- My Lents view for money owed to the signed-in user
- Direct settle action for dues
- Settlement history endpoints
- Friend balance summaries
- Smart settlement services for group settlement suggestions, alternative payments, and settlement analysis

### Activity & Notifications
- Activity feed for user and group activity
- Unread notification count
- Notification dropdown
- Mark selected activities or all activities as read
- Real-time notification updates through Socket.IO events
- Email workflows for expense, settlement, invite, and payment reminder notifications

### Real-Time Messaging
- Expense-level message routes
- Socket.IO client/server support
- Unread message count handling
- Chat modal connected to expense rows

### Recurring Expenses
- Create recurring expenses
- Daily, weekly, monthly, and yearly recurrence support
- Pause and resume recurring expenses
- Generate an expense immediately from a recurring rule
- Process due recurring expenses
- Recurring expense stats

### Analytics
- User analytics overview
- Group analytics
- System analytics endpoint
- Spending, category, group, relationship, trend, and time-distribution calculations
- Analytics dashboard view with summary and breakdown components

### Receipt Management
- Upload one or multiple receipts for an expense
- View receipts linked to an expense
- Set a primary receipt
- Delete receipts
- Admin-style cleanup and storage stats endpoints

### AI Assistant
- Dashboard AI chat panel
- Intent-aware replies for settlement planning, overspending, savings, and general finance questions
- Local document retrieval helper for contextual answers

### Security, Reliability, And Performance
- Password hashing with bcrypt
- JWT auth middleware
- Joi validation middleware
- Rate limiting for auth and expense routes
- Helmet/security headers
- CORS configuration
- Redis-backed caching helpers
- Socket authentication support
- Winston logging and Sentry integration
- Soft-delete and audit-oriented expense handling

---

## Tech Stack

### Frontend
- React 18 with Vite
- React Router
- Zustand state management
- Axios API client
- Socket.IO client
- Custom CSS with CSS variables and dark mode

### Backend
- Node.js and Express
- MongoDB with Mongoose
- JWT authentication
- bcryptjs password hashing
- Joi validation
- Redis/ioredis caching
- Socket.IO
- Nodemailer email service
- Multer receipt uploads
- Winston and Sentry

### Tooling & Deployment
- Docker and Docker Compose
- PM2 production runtime
- GitHub Actions
- GitHub Pages frontend deployment
- Render backend deployment
- Mocha, Supertest, and NYC for backend tests

---

## Architecture

```text
splitwise/
├── client/
│   ├── app/                # Main React app and routes
│   ├── components/         # Dashboard, expense, group, analytics, chat, UI components
│   ├── hooks/              # useAuth, useExpenses, and shared hooks
│   ├── services/           # API service clients
│   ├── src/services/       # Socket service
│   ├── store/              # Zustand stores
│   ├── styles/             # Global CSS
│   └── utils/              # Formatting and transaction helpers
│
├── server/
│   ├── controllers/        # Express route handlers
│   ├── middleware/         # Auth, validation, rate limiting, upload, security
│   ├── models/             # Mongoose schemas
│   ├── routes/             # API routes
│   ├── schemas/            # Joi request schemas
│   ├── services/           # Business logic, analytics, activity, email, cache
│   ├── tests/              # Backend tests
│   └── utils/              # Logging and helpers
│
├── docs/
├── uploads/
└── docker-compose.yml
```

---

## How It Works

1. A user signs in with email/password or Google.
2. The user creates or joins groups.
3. Expenses are added with payer, participants, category, date, and split method.
4. The backend calculates participant balances and ledger rows.
5. Dashboard views show total spend, dues, lents, group summaries, and recent activity.
6. Users can settle dues, record payment-style entries, upload receipts, and discuss expenses in chat.
7. Analytics and AI assistant views help explain spending and settlement patterns.

### Split Example

Expense: `3000` for dinner

Payer: Alice  
Participants: Alice, Bob, Charlie

Equal split:
- Alice paid `3000`, owes `1000`, and is owed `2000`
- Bob owes `1000`
- Charlie owes `1000`

Custom split:
- Alice share: `2000`
- Bob share: `500`
- Charlie share: `500`

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a user
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/google/config` - Get Google auth client config
- `POST /api/auth/google` - Login with Google credential
- `GET /api/auth/me` - Get current authenticated user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Revoke refresh token

### Groups
- `GET /api/groups` - List groups
- `POST /api/groups` - Create group
- `GET /api/groups/:id` - Get group details
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group
- `PATCH /api/groups/:id/members/add` - Add member
- `PATCH /api/groups/:id/members/remove` - Remove member

### Expenses
- `GET /api/expenses` - List expenses
- `POST /api/expenses/add` - Add expense
- `GET /api/expenses/my` - Get my dues
- `GET /api/expenses/lent` - Get my lents
- `GET /api/expenses/breakdown` - Get expense breakdown
- `GET /api/expenses/friends` - Get friend balances
- `GET /api/expenses/:id` - Get expense by ID
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense
- `PATCH /api/expenses/:id/settle` - Settle a due
- `GET /api/expenses/group/:groupId` - Get group expenses
- `POST /api/expenses/:id/payers` - Add payer
- `GET /api/expenses/:id/audit` - Get expense audit log

### Settlements & Smart Settlement
- `POST /api/settlements` - Create settlement/payment record
- `GET /api/settlements/history` - Get settlement history
- `GET /api/settlements/group/:groupId` - Get settlements for a group
- `POST /api/settlements/nudge` - Send payment reminder
- `GET /api/groups/:groupId/smart-settlements` - Smart settlement suggestions
- `GET /api/groups/:groupId/alternative-payments` - Alternative payment options
- `GET /api/groups/:groupId/settlement-analysis` - Settlement analysis

### Activity & Notifications
- `GET /api/activity/feed` - Current user's activity feed
- `GET /api/activity/group/:groupId` - Group activity feed
- `GET /api/activity/unread-count` - Unread notification count
- `PUT /api/activity/read` - Mark activities as read
- `PUT /api/activity/read-all` - Mark all activities as read
- `GET /api/activity/statistics` - Activity statistics
- `POST /api/activity` - Create activity

### Messages
- `GET /api/messages/:expenseId` - Get expense messages
- `POST /api/messages/:expenseId` - Post expense message

### Analytics
- `GET /api/analytics/user` - User analytics
- `GET /api/analytics/group/:groupId` - Group analytics
- `GET /api/analytics/system` - System analytics

### Recurring Expenses
- `POST /api/recurring-expenses` - Create recurring expense
- `GET /api/recurring-expenses` - List recurring expenses
- `GET /api/recurring-expenses/stats` - Recurring expense stats
- `POST /api/recurring-expenses/process-due` - Process due recurring expenses
- `GET /api/recurring-expenses/:id` - Get recurring expense
- `PUT /api/recurring-expenses/:id` - Update recurring expense
- `POST /api/recurring-expenses/:id/pause` - Pause recurring expense
- `POST /api/recurring-expenses/:id/resume` - Resume recurring expense
- `POST /api/recurring-expenses/:id/generate` - Generate expense now
- `DELETE /api/recurring-expenses/:id` - Delete recurring expense

### Receipts
- `POST /api/receipts/:expenseId` - Upload receipt
- `POST /api/receipts/:expenseId/multiple` - Upload multiple receipts
- `GET /api/receipts/:expenseId` - List receipts for expense
- `PUT /api/receipts/:expenseId/primary` - Set primary receipt
- `DELETE /api/receipts/:expenseId` - Delete receipt
- `POST /api/receipts/cleanup` - Clean up orphaned files
- `GET /api/receipts/stats/storage` - Storage stats

### AI
- `POST /api/ai/chat` - Ask the AI assistant

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- MongoDB 5+
- Redis, recommended for cache/session features

### Backend

```bash
cd server
npm install
cp .env.example .env
npm start
```

### Frontend

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

Default local URLs:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

### Docker Compose

```bash
docker-compose up
```

---

## Environment Variables

### Backend

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/splitwise
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:5173
GOOGLE_CLIENT_ID=your-google-client-id
SENTRY_DSN=optional-sentry-dsn
```

Depending on your local setup, Redis and email variables may also be required for caching, notifications, and outgoing email.

### Frontend

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## Testing

```bash
cd server
npm test
npm run coverage
```

Suggested manual checks:
- Login with email/password and Google
- Verify avatar display after Google login and page refresh
- Create a group and add/remove members
- Add expenses with each split type
- Settle a due and verify dues/lents refresh
- Open activity and notification dropdown
- Send an expense chat message
- Upload and view a receipt
- Create, pause, resume, and generate a recurring expense
- Review analytics after creating expenses
- Toggle dark mode and test responsive layouts

---

## Deployment

### Frontend
- Vite static build
- GitHub Pages deployment

### Backend
- Render deployment
- PM2 runtime available through `npm run start:prod`

### Docker

```bash
docker build -t splitwise-client client/
docker build -t splitwise-server server/
docker-compose up -d
```

---

## Project Notes

- The app uses `sessionStorage` for the active browser session and clears stale auth state on `401`.
- Google avatars are stored as `avatarUrl`; the header falls back to initials if no image is available or loading fails.
- Expense and balance logic distinguishes normal expenses from payment-style settlement entries.
- Activity, unread counts, messages, and notification refreshes use a mix of API calls, browser events, and Socket.IO.
- Some admin-labeled endpoints are route-protected but do not yet include a dedicated admin role check.

---

## Roadmap

- Stronger role-based access control for admin-only endpoints
- More complete profile/settings editing
- Better receipt metadata extraction
- Export/reporting workflows
- Mobile-first polish for dense dashboard views
- Optional payment provider integration
- Offline support with sync

---

## Troubleshooting

**MongoDB connection failed**  
Check `MONGODB_URI` and confirm MongoDB is running.

**Google sign-in does not show**  
Set `GOOGLE_CLIENT_ID` on the backend and ensure the frontend origin is allowed in Google Cloud Console.

**Avatar still shows initials**  
Sign in again or refresh the session. The current user response should include `avatarUrl`.

**CORS errors**  
Set `CORS_ORIGIN` to the frontend URL, usually `http://localhost:5173` in development.

**Notifications or chat do not update live**  
Confirm the backend Socket.IO server is running and the client has a valid token.

---

## Author

Developed by **Sakshya Sinha** as a full-stack project focused on real-world shared-finance workflows, splitting logic, settlements, analytics, and scalable backend architecture.

---

**Last Updated:** June 2026  
**Version:** 1.0.0
