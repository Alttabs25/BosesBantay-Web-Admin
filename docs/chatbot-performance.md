# Ingestion and retrieval performance update

Applied to the existing local rag-bot backend. Reproducible code diff: `services/document-admin/rag-performance.patch` (apply from that backend folder with `git apply`). Cache source and isolated tests are also retained in this Web Admin repo.

- `EMBED_KEEP_ALIVE=5m`: avoid unloading the embedding model after every chunk batch and question. Set `0s` for memory-constrained machines; Ollama may still evict models when RAM/VRAM is needed.
- `EMBED_BATCH_SIZE=16`: configurable batch size, bounded to 1–64. Previously 8; no concurrent model jobs or changes to chunk boundaries, embeddings, pages, or citations.
- `QUERY_CACHE_SIZE=128`, `QUERY_CACHE_TTL=300`: bounded LRU/TTL memory-only question embedding cache, keyed by host/model/dimensions/exact trimmed query. Keys are hashed; cache retains vectors, not raw query text. Failed/invalid vectors are never cached. Results and answers are NOT cached, so every factual lookup still queries Supabase and applies active-source checks.
- Separate private timings for keyword lookup, embeddings/cache hits, vector RPC, total retrieval, ingestion embedding, and database writes. No question text is included in these timing messages.

One local run (same short English question, existing nomic-embed-text): old unload request 10,513.5 ms; first new request 2,127.7 ms; subsequent warm uncached request 36.0 ms; cache hit 0.030 ms. This is embedding latency only, not complete answer latency; machine state, cold starts and GPU memory influence results. The keyword-first path does not need embeddings when it already finds a match.

39 existing ingestion/chat/citation tests passed against the updated files. Four new cache tests cover repeat hits, expiry/model isolation, LRU capacity/disable, and failure exclusion. No indexed documents or database schema were modified. Generation with qwen3:8b still depends on laptop speed and can remain the largest response-time cost.
## Retrieval-specific tuning

Keyword ranking now short-circuits exact vocabulary hits, caches tokenization by immutable chunk content (512 entries), and prunes fuzzy comparisons using mathematical upper bounds while retaining the original scores/order. Database rows are still fetched on every search, so active-state changes are respected.

Embedding defaults are now 30-minute keep-alive, 256 cached query vectors, and 30-minute cache TTL, configurable with existing environment controls. Ollama can still evict models under memory pressure. This does not cache answer text or database results. No vector thresholds, chunk lengths, or answer model were changed by this optimization.

An isolated equivalent-score keyword microbenchmark measured 240.0 ms before and 27.8 ms after. One live Tagalog retrieval-only query measured 2,966 ms first run and 349.2 ms repeated, with five passages each. These are sample measurements, not a guarantee for every query. Cold model loads, internet/database latency, and new questions still add time. 39 existing chat/citation/ingestion tests passed; the change is captured in `rag-retrieval-speed.patch`.
