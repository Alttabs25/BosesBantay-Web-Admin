# Document Management — current app integration

The active chatbot uses `services/chatbot/rag-bot`, Ollama `nomic-embed-text`, and Supabase `rag_documents`. The older Web Admin `documents` registry is not this index. Its old ingestion timers and browser-only test answers are no longer used by Document Management. No old records are deleted or migrated automatically.

## Local start

1. Start Ollama and the existing chatbot services as usual.
2. Run `services/document-admin/Start-Document-Admin.cmd`.
3. Run `npm run dev`; open Document Management while signed in.

The adapter listens only on `127.0.0.1:8766`. Vite proxies `/api/document-admin`. To use another existing rag-bot folder, set `BOSES_RAG_ROOT` before running the script. Python and dependencies are reused from that folder's `.venv`.

## Workflow

- Library: actual filenames, chunk counts, pages with text, and active state read from `rag_documents`.
- Add document: PDF/TXT up to 20 MB; server validates and previews through `preview_upload`.
- Index: uses the existing `ingest_upload` function, same model and database as the app. Filename must be new. Confirmed saved chunk count is checked before success.
- Open source: view stored chunks and original page metadata.
- Archive/activate: changes chunk metadata `active`, then verifies all rows; never deletes the source file or invents an approval status.

The UI keeps its staff controls. The local document service no longer has a second Supabase login requirement: a private server-to-server capability connects Vite to the adapter. Vite accepts these document requests only from loopback clients and same-origin browser requests; LAN clients and cross-site origins are denied. The adapter rejects direct calls without the capability. This is a trusted local administrator tool, not a public production API. The capability stays in ignored `services/document-admin/.private/local-proxy.key`, never in frontend bundles. The Supabase service key stays in rag-bot/.env. No database permissions or RLS rules are changed.

## Limits

This is a local service. A deployed website needs a separately hosted authenticated adapter and same-origin proxy. `VITE_DOCUMENT_ADMIN_URL` can identify such a proxy; the loopback adapter deliberately does not enable cross-origin browser requests.

The reused ingestion function and per-chunk status updates are not database transactions: interruption may leave partial changes. Failures are shown, and the library refreshes so operators can inspect actual counts. Replacement and permanent deletion are intentionally not exposed. Files are retained in rag-bot/docs. DOCX/scanned PDFs are not supported by the active ingestion function; convert to searchable PDF or UTF-8 TXT first. Menu topics remain in `menu_kb.json` and do not automatically regenerate after upload.

Library listing is paginated internally with a 50,000-chunk cap; larger collections require a database source-summary endpoint. No indexed status is simulated. Existing legacy registry data remains in Supabase but is not falsely presented as chatbot-ready.

Validation: `python tests/test_document_admin.py`, `npm run build`. Live checks: `/health` and direct `/documents` (must return 403), cross-site proxy request (403), localhost proxy request (200). No real files need to be indexed for these checks.
## Chunking presets

The Add document dialog offers Precise (900 chars, 150 overlap), Balanced (1500/200, existing default), and More context (2400/300). Sizes are characters, not tokens. Preview and indexing use the same selected values; these are stored in each new chunk's metadata. Selecting another preset re-extracts/recounts before indexing. Existing indexed sources remain unchanged. Apply `rag-ingest-presets.patch` after the performance patch when reproducing backend changes in another checkout.

Larger chunks can mean fewer embeddings and database rows but a bigger generation prompt and less precise matches. Smaller chunks increase indexing work and may separate prerequisites from an answer. The best preset depends on the document; no preset promises faster end-to-end answers. Compare representative English/Tagalog/Taglish questions before replacing a live source. Replacement is still intentionally unsupported by this upload workflow.
## Document details and pasted sources

Uploads now collect a document title, category, optional ordinance/reference number, and optional summary. The backend stores these as `document_title`, `document_type`, `reference_number`, and `summary` in each chunk's existing metadata JSON; no schema changes or legacy-document rewrites are required. Metadata cannot replace source filename, page, active state, embedding model, or chunk identity. The document library supports title/reference search and category filtering. These administrative categories do not automatically rewrite the chatbot's menu file.

The source form offers file upload or pasted text. Pasted content is saved as a named UTF-8 TXT file through the same validated ingestion pipeline. PDF extraction previews are read-only so changes cannot silently create false page citations. File uploads retain their original filename. DOCX remains unsupported by the current ingestion backend; convert it first. The summary is an administrative description, not independent evidence used to answer factual questions.
