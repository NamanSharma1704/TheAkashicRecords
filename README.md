# 🌌 AKASHIC RECORDS: THE SYSTEM

[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Threejs](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

> **STATUS: Pulse Active.**
> *Welcome, Hunter. The Akashic Records have synchronized with your reality. This repository contains the source code for the "System"—an immersive, RPG-styled interface designed to track and catalog your journey through various stories, manhwas, and archives.*

---

## 👁️ What is Akashic Records?

Akashic Records is a high-performance web application that transforms the mundane task of tracking reading progress into a gamified, immersive experience. Built with a sleek, neon-infused "System" aesthetic—inspired by modern hunter/leveling manhwas—it provides a centralized hub for archiving your progress across multiple web-based sources.

### Why use The System?

- **Immersive RPG UI**: Experience a cinematic interface powered by **Three.js** and **Tailwind CSS**, featuring glitch effects, nebula backgrounds, and dynamic rank animations.
- **Divine Spire**: A vertical, sector-based visualization of your entire library, allowing you to scale the tower of your achievements.
- **Metadata Synchronization**: Automatic fetching of story details (covers, titles, descriptions) from major archives including **AniList**, **MangaDex**, and **MyAnimeList**.
- **The Divine Mandate**: A built-in quest system that tracks daily reading streaks and encourages consistent progress.
- **Cross-Platform Rank System**: Watch your status evolve from *E-Rank Hunter* to *Sovereign* as you conquer more "gates" (stories).

---

## 🛠️ Architecture

The project is structured as a modern full-stack monorepo:

- `/src` - **The Frontend Cortex**: A React application utilizing Three.js for visual effects and Lucide-react for iconography.
- `/backend` - **The Archive Engine**: An Express.js server managing MongoDB connections, authentication proxying, and metadata retrieval.
- `/system` - **The Build Hub**: Vite-based configuration for high-speed development and production bundling.

---

## 🚀 Getting Started

To initialize The System in your local environment, follow these mandates.

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **MongoDB**: A running instance (local or Atlas)
- **Git**

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/Akashic_Records.git
   cd Akashic_Records
   ```

2. **Install Root Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the `backend/` directory:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=a_long_random_string
   SYSTEM_ADMIN_SECRET=another_long_random_string
   NODE_ENV=development
   ```

   `JWT_SECRET` is mandatory — the Archive Engine throws at startup without it rather
   than falling back to a default. `SYSTEM_ADMIN_SECRET` gates the two administrative
   routes (`/api/auth/upsert-sovereign` and `/api/admin/reap-sandboxes`); omit it and
   both simply refuse every caller.

   One optional flag: `ALLOW_REGISTRATION=true` re-opens `POST /api/auth/register`,
   which is closed by default. The app ships no registration UI — the owner account is
   created through `upsert-sovereign` and visitors use guest mode — so leaving it closed
   is correct for a single-owner deployment.

   For deployment, set the same values as Vercel environment variables, and add
   `SYSTEM_ADMIN_SECRET` as a GitHub Actions repository secret so the scheduled
   workflow can drive the guest-sandbox reaper.

---

## 🔐 Security posture

The deployment is single-owner with a public guest demo. What that means concretely:

| Area | Behaviour |
|---|---|
| **Sessions** | The JWT is issued as an `httpOnly`, `SameSite=Strict`, `Secure` cookie. Page scripts cannot read it, so injected code has no reusable credential to steal, and `SameSite=Strict` is what defends state-changing routes against CSRF. |
| **Lifetimes** | Sovereign sessions last 7 days; guest sessions last 2 hours, matching the sandbox TTL so a token can never outlive the database it points at. |
| **Revocation** | Changing the Sovereign password stamps `passwordChangedAt`, and any session issued earlier is refused on its next request. |
| **Role integrity** | `SOVEREIGN` is re-read from the database on every request rather than trusted from the token. Guests keep the zero-lookup path — their tenant is a disposable sandbox keyed to their own id. |
| **Accounts** | Registration is closed. Role is never accepted from a request body. |
| **Tenancy** | Guests get a physically separate database, not a filtered collection, so cross-tenant reads are impossible by construction. |
| **Guest demo** | Deliberately frictionless. Bounded by a per-IP rate limit and a concurrent-sandbox cap that reaps expired sandboxes before it ever refuses anyone, and which fails open if the cluster will not report counts. |
| **Brute force** | Failed logins are limited to 10 per 15 minutes per IP; successful ones do not count against the budget. |
| **Headers** | Strict CSP (no `unsafe-eval`, no inline script), HSTS, `frame-ancestors 'none'`, `nosniff`, `no-referrer`, and a Permissions-Policy denying device APIs. The document policy lives in both `vercel.json` and `backend/utils/securityHeaders.js`; a test asserts the two never drift apart. |
| **Image relay** | `/api/proxy/image` re-validates every redirect hop against the SSRF guard, serves only bitmap content types, caps responses at 8 MB, and refuses third-party hotlinking. |
| **Third-party text** | Synopses are sanitized through an allowlist before rendering. |

> [!NOTE]
> `npm audit` reports two advisories against `vite`/`esbuild`. Both affect the **development
> server only** and require a Vite major upgrade to clear. Nothing vulnerable ships in the
> production bundle or the serverless function.

### Running The System

Both halves run together from the repository root:

```bash
npm run dev
```

That starts the Archive Engine (`backend/server.js`, port 5000) and the Frontend Cortex
(Vite, port 5173) concurrently, with `/api` proxied from Vite to the backend. To run
them separately, use `npm run dev-backend` and `npm run dev-frontend`.

**Checks:**
```bash
npm run type-check
npm run lint
```

**Production bundle:**
```bash
npm run build
```

---

## 📜 Usage

- **Creating Gates**: Use the "CREATE_GATE" button in the header to add a new story to your library.
- **Conquering Chapters**: Use the `Sword` (Conquer) button on the main dash to increment your progress.
- **Divine Spire**: Drag through the Spire sectors to browse your history in a 3D-accelerated environment.
- **Theme Toggle**: Switch between *Light Mode (Aureic)* and *Dark Mode (Void)* using the Celestial toggle in the header.

---

## 🤝 Contributing & Support

The Akashic Records are ever-evolving. If you wish to contribute:

1. Fork the project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

**Need Help?**
If the System encounters a critical failure, please open an Issue or refer to the internal [System Console](src/components/system/SystemConsole.tsx).

---

## 👤 Maintainers

- **Lead Architect**: [Naman](https://github.com/your-profile)

---

> [!IMPORTANT]
> This project is designed for enthusiasts of the "System" genre. It is highly visual and may require a modern browser with WebGL support for the best experience.
