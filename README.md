# DepositDesk — Security Deposit & FDR Management

A centralized administrative lifecycle management platform for institutional Security Deposits and Fixed Deposit Receipts (FDRs). Built for AICTE problem statement **26265**, DepositDesk streamlines instrument registration, document verification, multi-stage scrutiny, automated maturity reminders, replacement chains, and formal release requests.

---

## 🔑 Demo Login Credentials

All seeded demo accounts share the uniform password: **`DemoPassword123!`**

| Role | Name / Organization | Email | Password |
| :--- | :--- | :--- | :--- |
| **System Administrator** | Admin User | `admin@depositdesk.invalid` | `DemoPassword123!` |
| **Scrutiny Officer** | Officer Priya Sharma | `officer.priya@depositdesk.invalid` | `DemoPassword123!` |
| **Scrutiny Officer** | Officer Rahul Verma | `officer.rahul@depositdesk.invalid` | `DemoPassword123!` |
| **Approving Authority** | Authority Anita Mehta | `authority.anita@depositdesk.invalid` | `DemoPassword123!` |
| **Institution User** | Sunrise Tech (Vikram Patel) | `vikram@sunrise.invalid` | `DemoPassword123!` |
| **Institution User** | Coastal Engineering (Meera Nair) | `meera@coastal.invalid` | `DemoPassword123!` |
| **Institution User** | Hillside Medical (Sanjay Kumar) | `sanjay@hillside.invalid` | `DemoPassword123!` |
| **Institution User** | Northern Institution | `registrar@northern.invalid` | `DemoPassword123!` |
| **Institution User** | Southern Institution | `registrar@southern.invalid` | `DemoPassword123!` |
| **Institution User** | Eastern Institution | `registrar@eastern.invalid` | `DemoPassword123!` |
| **Institution User** | Central Institution | `registrar@central.invalid` | `DemoPassword123!` |
| **Institution User** | Western Institution | `registrar@western.invalid` | `DemoPassword123!` |

> **Tip**: Sign out to switch between different roles and test the multi-tier workflow (*Institution* ➔ *Scrutiny Officer* ➔ *Approving Authority* ➔ *Administrator*).

---

## ✨ Key Features

* **Instrument Registry**: Centralized repository for Fixed Deposit Receipts (FDR) and Bank Guarantees, tracking amounts, issuing banks, branch details, maturity dates, and joint account details.
* **Scrutiny Queue & Discrepancies**: Officers review submissions, inspect document attachments, raise itemized discrepancies, and request resubmissions.
* **Maturity Monitoring & Alerts**: Automated daily checks and threshold warnings (90, 60, 30, 15, 7, 1 days) before FDR expiration, with escalation flags.
* **Instrument Replacement**: Direct renewal and replacement chains linking new instruments to matured predecessors while retaining immutable history.
* **Release & Refund Lifecycle**: Structured release requests, required scrutiny checklists, competent-authority approvals, and evidenced completion.
* **Tamper-Evident Audit Trail**: Append-only audit logging for every submission, review decision, status change, and administrative action.
* **Role-Based Access Control (RBAC)**: Strict data isolation ensuring institutions only access their own records, while scrutiny officers and authorities operate within assigned jurisdictions.

---

## 🛠️ Technology Stack

* **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Recharts
* **Backend**: Node.js, Express, TypeScript, Prisma ORM, Argon2id, Connect-PG-Simple
* **Database**: PostgreSQL 16
* **Architecture**: Monorepo with shared validation schemas (`@depositdesk/shared`)

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
* **Node.js** v20.6+ (v22 recommended)
* **npm** v10+
* **PostgreSQL 16** (or Docker Desktop)

### 1. Clone & Install
```powershell
git clone https://github.com/No-Reed/Security-Deposit-FDR-Management.git
cd Security-Deposit-FDR-Management
npm ci
```

### 2. Configure Environment
```powershell
Copy-Item .env.example .env
```

### 3. Start Database & Seed
If using Docker:
```powershell
docker compose up -d --wait db db-test
```
Generate Prisma client, apply migrations, and seed demo records:
```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 4. Run Development Server
```powershell
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser. The backend API runs on port `4000`.

---

## ☁️ Deployment on Render

This project is pre-configured for one-click deployment using **Render Blueprints** via [`render.yaml`](render.yaml):

1. Push your repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** ➔ **Blueprint**.
3. Select your repository (`Security-Deposit-FDR-Management`).
4. Click **Apply**. Render will automatically provision:
   * **Managed PostgreSQL 16 Database** (`depositdesk-db`)
   * **Unified Web Service** (`depositdesk`) serving both the API and compiled React frontend on a single URL.

---

## 🧪 Testing & Verification

```powershell
# Run unit & API boundary tests
npm test

# Run database workflow integration tests (requires local test DB)
npm run test:integration

# Verify TypeScript compilation and production build
npm run build
```
