# Nimble Insights

**Nimble Insights** is an AI-powered financial intelligence dashboard designed specifically for hotel operators. It automatically ingests actual P&L data from Excel and forecast targets from RMS reports, running them through a built-in rules engine to instantly detect financial anomalies—such as unexpected GOP variances, RevPAR drops, or cost overruns. 

An embedded AI assistant (powered by Google Gemini) acts as an expert financial analyst, interpreting these alerts and the raw data to provide actionable, plain-English recommendations for revenue management and profitability improvement, directly through an interactive chat interface.

---

## 🏗 Architecture

The project has been migrated from a Python/FastAPI structure to a robust **Node.js Monorepo** powered by `pnpm`, React, and SQLite.

### Tech Stack
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui (`@workspace/nimble-insights`)
- **Backend API:** Express, Zodios, Google Generative AI (`@workspace/api-server`)
- **Database:** SQLite, Drizzle ORM (`@workspace/db`)
- **Shared Code:** Zod schemas and auto-generated API clients (`@workspace/api-zod`, `@workspace/api-client-react`)

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** (v20+ recommended)
- **pnpm** (Package manager for the monorepo)
- **Gemini API Key** 

### 2. Install Dependencies
In the root directory of the project, install all workspace packages:
```bash
pnpm install
```

### 3. Environment Configuration
Create a `.env` file inside the `artifacts/api-server/` directory and configure the following variables:
```env
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=file:C:/path/to/your/repo/newinsights/sqlite.db
PORT=5000
NODE_ENV=development
```
*(Make sure to replace the `DATABASE_URL` path with the absolute path to your repository root where `sqlite.db` will be created).*

### 4. Initialize Database
Initialize your SQLite database by pushing the schema:
```bash
# Windows (PowerShell):
$env:DATABASE_URL="file:C:/path/to/your/repo/newinsights/sqlite.db"; pnpm --filter "@workspace/db" run push

# Mac/Linux:
DATABASE_URL="file:/path/to/your/repo/newinsights/sqlite.db" pnpm --filter "@workspace/db" run push
```

### 5. Start the Application
You'll need two terminal tabs to run the frontend and backend development servers concurrently.

**Start the Backend (Port 5000):**
```bash
pnpm --filter "@workspace/api-server" run dev
```

**Start the Frontend (Port 8001):**
```bash
pnpm --filter "@workspace/nimble-insights" run dev
```

### 6. Open the Dashboard
Navigate your browser to `http://localhost:8001/` to use the Nimble Insights dashboard and interact with the AI assistant!

---

## 📁 Repository Structure

```text
newinsights/
├── artifacts/
│   ├── api-server/         # Express backend handling Gemini, Excel parsing, and rules
│   └── nimble-insights/    # React + Vite frontend dashboard
├── lib/
│   ├── api-client-react/   # Auto-generated React Query hooks for the frontend
│   ├── api-spec/           # OpenAPI specs and Orval configuration
│   ├── api-zod/            # Shared Zod types and Zodios API definitions
│   └── db/                 # Drizzle ORM schema and Better-SQLite3 setup
├── attached_assets/        # Hotel P&L Excel files and RMS DOCX forecasts
├── package.json            # Monorepo root configurations
└── pnpm-workspace.yaml     # Workspace declaration
```
