# Random Sutta - SQLite Database Architecture

This document describes the schema and rationale for `sutta_data.db`, the core database serving the Random Sutta offline PWA/APK.

## Philosophy
The database blends **Relational Normalization** for efficient content querying with **Materialized JSON Views** for high-performance UI rendering on low-end mobile devices.

## Schema Details

### 1. `config` Table
Stores global application constants previously held in `constants.js`.
*   **Columns:**
    *   `key` (TEXT, PK): E.g., `'primary_books'`, `'secondary_books'`, `'sub_books_map'`.
    *   `value` (TEXT): A JSON-stringified array or object containing the configuration data.

### 2. `metadata` Table
Stores the essential metadata for every node in the universe (Roots, Branches, Leaves, Aliases).
*   **Columns:**
    *   `uid` (TEXT, PK): Unique identifier (e.g., `'mn1'`).
    *   `book_id` (TEXT, Indexed): The root book this UID belongs to (e.g., `'mn'`).
    *   `type` (TEXT): Node type (`'leaf'`, `'branch'`, `'alias'`, `'root'`, `'super_book'`).
    *   `acronym` (TEXT): Short code (e.g., `'MN 1'`).
    *   `translated_title` (TEXT): English/Translated title.
    *   `original_title` (TEXT): Pali title.
    *   `blurb` (TEXT): Short summary.
    *   `author_uid` (TEXT): Translator ID.
    *   `parent_uid` (TEXT): The immediate parent node UID in the hierarchy.
    *   `target_uid` (TEXT): Used only by `alias` type to point to the actual physical file.
    *   `hash_id` (TEXT): Used by aliases to scroll to a specific paragraph.
    *   `nav_prev` (TEXT): The UID of the logically preceding sutta.
    *   `nav_next` (TEXT): The UID of the logically succeeding sutta.

### 3. `content_segments` Table
The heavily normalized table storing the actual reading material. Segmenting allows for lightning-fast localized queries (e.g., Pali word lookups) without loading entire HTML documents into memory.
*   **Columns:**
    *   `sutta_uid` (TEXT, PK): The leaf sutta UID.
    *   `segment_id` (TEXT, PK): The exact bilara segment ID (e.g., `'mn1:1.1'`).
    *   `segment_order` (INTEGER, Indexed): The numerical order to ensure correct sequential rendering.
    *   `pli` (TEXT): Raw Pali text.
    *   `eng` (TEXT): Raw English translated text.
    *   `html` (TEXT): HTML markup wrappers (e.g., `<p>{}</p>`).
    *   `comm` (TEXT): Commentary or footnote text for this segment.

### 4. `structure` Table (Materialized View)
Stores the pre-calculated hierarchical tree of each book. 
*   **Rationale:** Parsing a pre-built JSON tree via native browser `JSON.parse()` is exponentially faster and more battery-efficient for rendering the massive Table of Contents (TOC) drawer on mobile devices compared to recursively querying the `metadata` table to reconstruct the tree in JavaScript.
*   **Columns:**
    *   `book_id` (TEXT, PK): The root book ID.
    *   `tree_json` (TEXT): The deeply nested JSON object representing the entire navigational hierarchy of the book.

### 5. `random_pools` Table
A highly optimized relational table replacing the in-memory array pools.
*   **Rationale:** Allows the app to pick a random sutta across multiple selected books using native SQLite optimization: `SELECT sutta_uid FROM random_pools WHERE book_id IN ('mn', 'dn') ORDER BY RANDOM() LIMIT 1;`. This consumes 0 bytes of persistent RAM in the JS thread.
*   **Columns:**
    *   `book_id` (TEXT, PK)
    *   `sutta_uid` (TEXT, PK)

## Frontend Implementation Guidelines (Phase 2)
1. **wa-sqlite integration:** Use OPFS (Origin Private File System) for the highest I/O performance on iOS/Android WebViews.
2. **Direct Queries:** Replace `fetchContentChunk` with `SELECT * FROM content_segments WHERE sutta_uid = ? ORDER BY segment_order`.
3. **Menu Rendering:** Use `SELECT tree_json FROM structure WHERE book_id = ?` to instantly build the Magic Nav TOC.