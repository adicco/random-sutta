# Random Sutta - Multi-DB Sharded Architecture

This document describes the sharded SQLite database architecture serving the Random Sutta offline PWA/APK.

## Philosophy
To overcome file size limits (GitHub Pages 100MB) and mobile memory constraints (iOS Jetsam), the data is sharded into a **Core Database** and multiple **Content Shards**.

## Sharding Layout

### 1. `sutta_core.db` (~5-10MB)
*   **VFS:** Loaded into **MemoryVFS** (RAM).
*   **Purpose:** Instant UI rendering, navigation, and global metadata lookup.
*   **Tables:**
    *   `config`: Global app settings (author priority, etc.).
    *   `metadata`: All UIDs, titles, blurbs, and navigation links.
    *   `structure`: Materialized JSON trees for every book.
    *   `random_pools`: Relational mapping for random sutta selection.

### 2. `sutta_content_{category}.db` (~20-50MB each)
*   **VFS:** Loaded into **OPFS** (Persistent Disk Storage).
*   **Categories:** `major` (DN, MN, SN, AN), `minor` (KN), `vinaya`, `abhidhamma`.
*   **Purpose:** Large scale text content storage.
*   **Tables:**
    *   `content_segments`: The normalized Pali/English/HTML text segments.

## Future Expansion: Search (FTS5)
To support full-text search without ballooning the core or content databases:
1.  **`sutta_search_pali.db`**: Virtual FTS5 tables for Pali text.
2.  **`sutta_search_eng.db`**: Virtual FTS5 tables for English translations.
These will be lazy-loaded into **OPFS** only when the user opens the search interface.

## Implementation Details
*   **Frontend Logic:** `SuttaDB` manages multiple SQLite instances. `SuttaRepository` acts as an orchestrator, resolving the correct shard for each query.
*   **Build Pipeline:** `SqliteGenerator` automatically distributes data based on `book_id`.
