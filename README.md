# SplitSense – Full Stack Expense Sharing App

SplitSense is a full-stack web application for managing shared expenses across groups. It helps users track spending, split bills accurately, and understand balances in real time.

Live Demo: https://sakshyasinha.github.io/splitwise/

---

## Overview

SplitSense solves a common problem in shared finances — keeping track of who paid, who owes, and how much.

Users can create groups, add expenses, split costs among participants, and view clear settlement states. The system ensures fairness through accurate bill-splitting logic and a clean dashboard interface.

---

## Features

### Group Management

* Create groups (e.g., roommates, trips)
* Add participants dynamically
* Track active shared groups

### Expense Tracking

* Add expenses with title, amount, and category
* Assign payer and participants
* Split costs evenly across members

### Dashboard Metrics

* Total spending across groups
* Number of expenses
* Active groups
* Amount owed by the user

### Expense History

* View recent transactions
* Edit or delete expenses
* Per-person split breakdown

### Dues & Settlement

* Track who owes whom
* Clear "settled" vs "pending" states

### AI Assistant (Frontend Feature)

* Suggests settlement strategies
* Gives spending insights
* Helps reduce unnecessary transactions

---

## Tech Stack

### Frontend

* HTML, CSS, JavaScript
* Custom component-based UI system

### Backend

* Node.js
* Express.js

### Deployment

* GitHub Pages (frontend)
* Render (backend)

### CI/CD

* GitHub Actions for automated deployment

---

## Project Structure

```
splitwise/
│
├── client/        # Frontend (UI, dashboard, interactions)
├── server/        # Backend (API, logic, bill splitting)
├── docs/          # Static deployment files
├── .github/       # CI/CD workflows
├── render.yaml    # Deployment configuration
```

---

## How It Works

1. User creates a group
2. Adds members
3. Adds an expense (e.g., ₹1600 dinner)
4. System splits the bill across participants
5. Dashboard updates balances instantly
6. Users can track dues and settle accordingly

---

## Bill Splitting Logic

The backend ensures:

* Equal distribution of expenses among selected participants
* Accurate tracking of payer vs owed users
* Real-time calculation of balances

This logic was recently refined to handle edge cases and ensure correctness.

---

## Running Locally

### 1. Clone the repository

```
git clone https://github.com/sakshyasinha/splitwise.git
cd splitwise
```

### 2. Setup backend

```
cd server
npm install
npm start
```

### 3. Open frontend

Open `client/index.html` in your browser

---

## Deployment

* Frontend is hosted using GitHub Pages
* Backend is deployed on Render
* Automated deployment configured via GitHub Actions

---

## Design Approach

The application focuses on:

* **Clarity** → Users should instantly understand balances
* **Accuracy** → Reliable bill splitting logic
* **Simplicity** → Minimal steps to add and track expenses
* **Scalability** → Structured for backend and future expansion

---

## Future Improvements

* Authentication and user accounts
* Persistent database (MongoDB / PostgreSQL)
* Real-time updates (WebSockets)
* Payment integration
* Advanced analytics (charts, spending insights)

---

## Author

Developed by Sakshya Sinha as a full-stack project focused on building real-world financial tracking systems and improving frontend + backend architecture.

---
