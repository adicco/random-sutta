# Random Sutta - Vertical Sharded Architecture (SQLite + OPFS)

This document describes the sharded SQLite database architecture and the advanced OPFS implementation used in the Random Sutta application.

## Database Philosophy
To overcome file size limits (GitHub Pages) and mobile memory constraints (iOS Jetsam), the system uses a vertical sharding strategy. Data is split between a **Core** database for navigation and **Content** shards for high-volume text.

## Schema Specification

### 1. `sutta_core.db` (The Orchestrator)
*   **Purpose:** Global metadata, structural hierarchy, and application configuration.
*   **Tables:**
    *   `config (key PK, value TEXT)`: App-wide constants (e.g., `author_priority`).
    *   `metadata (uid PK, ...)`: Contains 17 fields including `root_lang` (e.g., 'pi', 'lzh'), `acronym`, `translated_title`, `original_title`, `blurb`, `parent_uid`, `children` (JSON), and `nav_prev`/`nav_next`.
    *   `structure (book_id PK, tree_json TEXT)`: Pre-computed navigation trees for every book.
    *   `random_pools (book_id, sutta_uid, PK(book_id, sutta_uid))`: Mapping for the random sutta generator.

### 2. `sutta_content_{category}.db` (Vertical Content Shards)
*   **Categories:** 
    *   **Pali:** `major` (DN, MN, SN, AN), `minor` (KN), `vinaya`, `abhidhamma`.
    *   **Chinese (Lzh):** `lzh_major` (Agamas), `lzh_vinaya_dg`, `lzh_vinaya_mg`, `lzh_vinaya_sarv`, `lzh_vinaya_other`, `lzh_abhidhamma`, `lzh_minor`.
*   **Purpose:** Normalized storage of all segmented text.
*   **Table:** `content_segments`
    *   `sutta_uid`, `segment_id`, `segment_order`, `type` (pli/eng/html), `lang`, `author_uid`, `content`.
    *   **Primary Key:** `(sutta_uid, segment_id, type, lang, author_uid)`.
    *   **Indexes:** Optimized for sequential reading (`sutta_uid`, `segment_order`) and filtering (`type`, `lang`, `author_uid`).

## Storage Implementation: OPFSAnyContextVFS

The application utilizes `wa-sqlite` with a specialized VFS implementation to handle the persistent storage of SQLite databases on the web.

### Key Features:
*   **OPFSAnyContextVFS:** Unlike the standard `AccessHandleVFS` which restricts access to a single Web Worker, `OPFSAnyContextVFS` allows the database to be accessed from any context (Main Thread, Web Worker, or Service Worker) using the **Origin Private File System (OPFS)**.
*   **AccessHandle Mechanism:** It uses the synchronous `FileSystemSyncAccessHandle` inside a dedicated worker to provide near-native disk I/O performance.
*   **Mutex Locking:** A JavaScript-level mutex (`withLock`) ensures that sensitive SQLite operations (opening, closing, writing) are serialized to prevent memory corruption, especially on iOS.

### Performance & Memory Optimization (iOS Jetsam-Ready):
To prevent crashes on iOS devices with strict memory limits, the following PRAGMAs are applied to every database connection:
*   `journal_mode = DELETE`: Reduces overhead for read-heavy workloads.
*   `synchronous = NORMAL`: Balancing safety and write speed.
*   `cache_size = -5000`: Limits cache to ~5MB per database.
*   `mmap_size = 256MB`: Enables memory-mapped I/O for significantly faster read access on supported platforms.

## Build Pipeline
The `src.sutta_processor` Python package generates these databases by transforming Bilara JSON data into a vertically-integrated relational structure, ensuring that metadata is separated from heavy content to maintain UI responsiveness.
