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
   NODE_ENV=development
   ```

### Running The System

The project requires both the Archive Engine (Backend) and the Frontend Cortex to be active.

**Start the Archive Engine:**
```bash
npm run dev-backend
```

**Start the Frontend Cortex:**
```bash
npm run build
# Then navigate to the system directory to serve
cd system
npm run dev
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
