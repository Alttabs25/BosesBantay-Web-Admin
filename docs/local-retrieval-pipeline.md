# Local retrieval pipeline

The supplied RAG guide is a design reference. The live web-admin adapter continues to use the existing local Ollama `qwen3:8b`, `nomic-embed-text` embeddings and Supabase `rag_documents` vectors. No cloud AI provider, new database schema, paid service or document reindex is introduced.

Implemented stages:

1. Existing deterministic greeting/menu/scope routing, with configurable lowercase shorthand normalization. The original redacted message remains the generation question.
2. Search-only bilingual concept expansion from `retrieval_glossary.json`. At most two query variants are searched; expansions are retrieval hints, not evidence. They are not full LLM translations.
3. Existing keyword/fuzzy and vector retrieval, active-source filtering, threshold checks and bounded candidate lists. Up to 30 unique candidates enter final ranking.
4. Reciprocal rank fusion with a small character-trigram overlap tie-break. This is a local lexical reranker, **not** bge-reranker-v2-m3 or a calibrated relevance probability.
5. Source-aware follow-ups: only source IDs are held transiently per session/generation. Active rows are fetched again before use. New topics do not inherit old evidence. This memory resets on backend restart.
6. Local answer generation, structured short-answer claims, code-built citations and a shared one-repair budget. No routine LLM audit/routing/rewrite calls are added.

Configure concepts and shorthand in the backend copy of `retrieval_glossary.json`; `BB_RETRIEVAL_GLOSSARY` can point to another file. Restart the backend after changes. Glossary entries should describe vocabulary equivalence only; never place factual answers, fees or policies in them.

Unchanged or deferred: embedding model/dimensions, parent-child storage, automatic generated retrieval questions, policy effective-date precedence, OCR/DOCX, cross-encoder reranking, multi-part LLM query decomposition and model self-check. Those require separate ingestion/data/model work and evaluation; they are not implied by this implementation. Existing PDF page-aware extraction and configurable paragraph/sentence-aware character chunks remain in use. Existing indexed sources are retained.

Validation: 4 query-preparation/ranking checks, 15 existing chat tests and 5 follow-up regression tests pass. These are deterministic safeguards, not evidence of improved multilingual Recall@k; a labeled resident-question set and Filipino-language review are still needed. Two-query expansion can increase database/embedding work, though it adds no generation-model call. Monitor existing retrieval timing logs.
