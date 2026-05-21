# Random Sutta Reader

A fast, focus-oriented reader for Early Buddhist Texts (EBT), designed for a seamless reading experience with robust offline capabilities.
Data is sourced from SuttaCentral's [Bilara](https://github.com/suttacentral/sc-data) project and Digital Pāḷi Dictionary ([DPD](https://digitalpalidictionary.github.io/)).

## 🌟 Key Features

- **Random Sutta:** Instantly discover a random discourse from the Nikayas.
- **SQLite Engine:** Powered by `wa-sqlite` (SQLite compiled to WebAssembly) for high-performance searching and filtering in the browser.
- **Smart PWA Offline:** 
  - Automatically caches core engine and UI.
  - Downloadable SQLite "DB Bundles" for 100% offline access to thousands of Suttas.
- **Magic Navigation:** Integrated Breadcrumbs, Table of Contents (TOC), and "Magic Nav" for seamless context awareness.
- **Bilingual & Dictionary Support:** 
  - Parallel display of Pāli and English (Bhante Sujato's translation).
  - Integrated Pāḷi-English Dictionary (DPD) for instant word lookup.
- **Cross-Platform:** Available as a Web App (PWA), Android (Capacitor), and MacOS (Tauri) with deep-linking support (`randomsutta://`).
- **Customization:** Dark Mode, Sepia (Night Shift) mode, and adjustable font sizes.

## 🛠️ Tech Stack

- **Frontend:** Vanilla JS (ES6 Modules), CSS3, HTML5 (with custom Partial Compiler).
- **Build Tool:** [Vite](https://vitejs.dev/) with [Vite PWA](https://vite-pwa-org.netlify.app/).
- **Database:** SQLite (via `wa-sqlite`).
- **Processing:** Python 3.10+ for data ingestion and optimization.
- **Native Wrappers:** [Capacitor](https://capacitorjs.com/) (Android/iOS) and [Tauri](https://tauri.app/) (MacOS).

## 🚀 Installation & Build Guide

### 1\. Clone the repository

```bash
git clone https://github.com/vjjda/random-sutta.git
cd random-sutta
```

### 2\. Environment Setup

We use `direnv` or manual virtual environment for Python tools.

```bash
# Setup Git hooks
make setup

# Install Node dependencies
npm install
```

### 3\. Fetch & Process Data

The project requires raw data (Bilara texts, SC API metadata, and DPD dictionary).

```bash
# Sync ALL data sources (takes time)
make sync

# Process JSON into optimized SQLite databases
make data

# Build Dictionaries
make da
```

### 4\. Development & Build

```bash
# Start Vite Dev Server (HMR)
make dev

# Full Production Build (Web)
make build

# Build Android APK
make apk

# Build MacOS App
make app
```

## 📂 Project Structure

- `src/`: Python source code (Build Tools).
  - `data_fetcher/`: Synchronizes raw data from Bilara & API.
  - `sutta_processor/`: Core logic to convert JSON -> SQLite Databases.
  - `dict_builder/`: Builds Digital Pāḷi Dictionary assets.
  - `release_system/`: Handles versioning and GitHub releases.
- `web/`: Frontend Application.
  - `assets/modules/`: Modularized JS logic (`core`, `ui`, `services`).
  - `assets/libs/`: Third-party libraries like `wa-sqlite`.
  - `public/assets/db/`: Generated SQLite databases (Ignored by Git).
  - `partials/`: HTML components used by the internal compiler.
- `android/`: Capacitor Android project.
- `src-tauri/`: Tauri MacOS/Desktop project.

## 🐞 Development & Debugging

Append `?debug=1` to the URL to enable verbose logging and performance metrics in the browser console.

**Example:** `http://localhost:8000/?q=mn1&debug=1`

- **⏱️ Render:** UI rendering performance.
- **📥 Data Fetch:** Cache vs. Network latency.
- **[DEBUG]:** Internal state transitions and repository queries.

## 📄 License

- **Content:** SuttaCentral (CC0), DPD (CC BY-NC-SA 4.0).
- **Source Code:** MIT License.
