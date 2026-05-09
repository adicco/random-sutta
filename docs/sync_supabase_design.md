# Sync Solution: Supabase Strategy

This document outlines the proposed migration from Google Drive API to **Supabase** for cross-platform data synchronization (Web, Android, MacOS).

## 1. Why Supabase?

The previous Google Drive integration suffered from complex OAuth redirect handling across platforms and unstable file-based merging. Supabase provides:

*   **Unified Auth:** Consistent PKCE/OAuth flow for Web, Capacitor, and Tauri.
*   **Structured Sync:** Syncing individual records (bookmarks, annotations) instead of monolithic JSON files.
*   **Real-time:** Instant updates across devices.
*   **Scalability:** PostgreSQL backend capable of handling millions of user-generated Pali word annotations.

## 2. Security Model: Exclusive Access

To protect the Free Tier and maintain a high-quality initial testing phase, the system will operate on an **Invite-Only** basis.

### Mechanism: Restricted Signup
1.  **Disable Public Signup:** In Supabase Auth settings, "Allow new users to sign up" will be disabled.
2.  **Admin Invitation:** Access is granted by manually adding user emails to the Supabase Auth dashboard or via a custom admin script.
3.  **Row Level Security (RLS):** Policies will ensure that even authenticated users can only `SELECT`, `INSERT`, `UPDATE`, or `DELETE` records where `user_id == auth.uid()`.

## 3. Future Feature: Word Annotations

The primary goal of this sync system is to allow users to save custom meanings and notes for Pali words encountered in specific suttas.

### Proposed Schema

#### Table: `user_annotations`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier for the annotation. |
| `user_id` | UUID (FK) | Reference to `auth.users.id`. |
| `sutta_id` | Text | The UID of the sutta (e.g., `mn1`). |
| `word_key` | Text | The specific Pali word or segment identifier. |
| `definition` | Text | User's custom meaning for the word. |
| `notes` | Text | Additional study notes. |
| `updated_at`| Timestamp | For conflict resolution (Last-Write-Wins). |

## 4. Implementation Phases

1.  **Infrastructure:** Set up Supabase project and define PostgreSQL schemas.
2.  **Auth Integration:** Replace `GoogleAuthManager` with `SupabaseAuthManager`.
3.  **Sync Logic:** Implement a "Local-First" sync strategy using IndexedDB as a buffer and Supabase as the source of truth.
