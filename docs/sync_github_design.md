# Sync Solution: GitHub Backend (Geeky Approach)

## 1. Overview
This document details the migration from Google Drive to a **GitHub-based synchronization system**. Instead of a central database (like Supabase), users will provide a GitHub Personal Access Token (PAT). The application will sync their data (bookmarks, history, settings) to a private repository owned by the user.

## 2. Analysis of the Tentative Plan

### Strengths
*   **Data Sovereignty:** Users own their data completely. No central database liability.
*   **Free Infrastructure:** Relies on GitHub's generous API limits (5000 requests/hour for authenticated users).
*   **Built-in Versioning:** GitHub natively tracks changes via `sha`, making conflict detection robust.

### Flaws & Improvements
1.  **UX Friction (Repo Creation):** Asking users to manually create a repository is prone to errors.
    *   *Improvement:* The app will use the PAT to automatically check for the existence of a specific repo (e.g., `rsnote`). If it doesn't exist, the app will auto-create it as a private repository.
2.  **Security of PAT:** Storing a Classic PAT with broad `repo` access in `localStorage` is risky.
    *   *Improvement:* Provide clear instructions in the UI for generating a **Fine-grained PAT** that is restricted *only* to the `rsnote` repository, rather than a Classic PAT.
3.  **Conflict Resolution Burden:** Asking the user to manually resolve JSON conflicts is bad UX.
    *   *Improvement:* Implement an automatic **Deep Smart Merge**. Since we know the schema (Arrays for bookmarks, Objects for history), we can merge at the item level based on timestamps, rather than just the file level. The UI prompt (Keep Local vs. Keep Cloud vs. Smart Merge) should default to "Smart Merge".

## 3. Architecture & Data Flow

### 3.1. Authentication
*   User inputs a GitHub PAT.
*   App validates the token by calling `GET /user`.
*   App checks for repo `GET /repos/{owner}/rsnote`. If 404, calls `POST /user/repos` to create it (private).

### 3.2. Sync Payload
The repository will contain:
*   `sync.json`: Application state (bookmarks, history, settings).
*   `notes/`: Markdown files for personal sutta annotations, organized by Nikaya.
    *   Example: `notes/mn/mn1.md` for Majjhima Nikaya 1.

### 3.3. Smart Merge Logic (The `sha` Check)
The application will track two local variables:
*   `sync_github_sha`: The `sha` of `sync.json` from the last successful sync.
*   `sync_local_update_timestamp`: The timestamp of the last local change.

**Sync Cycle:**
1.  **Fetch Cloud Data:** `GET /repos/{owner}/random-sutta-sync/contents/sync.json`.
2.  **Compare:**
    *   If `cloud_sha` == `sync_github_sha`: Cloud hasn't changed.
        *   If `sync_local_update_timestamp` > last sync time: Push local to cloud.
        *   Else: Do nothing.
    *   If `cloud_sha` != `sync_github_sha`: Cloud has changed (e.g., from another device).
        *   If `sync_local_update_timestamp` < last sync time (No local changes): Pull and apply cloud data.
        *   If `sync_local_update_timestamp` > last sync time (Local changed too): **CONFLICT DETECTED**.
3.  **Conflict Handling:**
    *   Execute **Deep Smart Merge**: Combine items from local and cloud based on individual item timestamps (e.g., latest bookmark wins).
    *   Upload the merged result back to GitHub to resolve the conflict.

## 4. Implementation Steps
1.  **Phase 1:** Create `github_api.js` wrapper for fetching, creating repos, and updating files.
2.  **Phase 2:** Rewrite `sync_orchestrator.js` to use GitHub API and implement the Deep Smart Merge using `sha`.
3.  **Phase 3:** Update `sync_ui_manager.js` to accept PAT and show GitHub-specific statuses.
4.  **Phase 4:** Remove old Google Drive code.
