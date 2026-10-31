# Chatbot response configuration and real tests

Open `/chatbot-settings` (Barangay Bot in navigation, or Bot settings & testing in Document Management). This uses the protected localhost document adapter.

- Draft settings affect only the test request via a Python ContextVar; they never overwrite the app's live settings.
- Apply to app writes the validated preferences atomically to rag-bot/.private/response-settings.json. The app reads that file on its next generated request after the updated backend has been loaded. Restart an already-running old chatbot process once after installing the code patch.
- Settings: friendly/professional tone, brief/standard/detailed length, related suggestions, maximum 3–8 retrieved passages, similarity threshold 0.2–0.7.
- Hard rules cannot be disabled: barangay scope, document evidence, citations, language matching, technical-error handling and existing bounded validation retry.
- No user-editable system prompt, model-memory answering, or auto-generated legal decisions.
- Menus, greetings, navigation, curated exact answers, and deterministic fallbacks keep their existing wording. Style settings apply to generated answers, not every deterministic message.
- Test conversation uses the SAME stream_session_message engine, session routing, Supabase retrieval, Ollama model and citation validators as the mobile chatbot. Sessions are ephemeral in memory and isolated by random test IDs. Sources returned by the engine and total response time are displayed. Test metadata is diagnostic, not an accuracy score. Service failures are shown as such.
- New test clears conversation context. Selecting a suggested question fills the input; Send test runs it. Each reply retains the tone/length used for that turn. Test questions and replies are kept only in browser state; the backend session store keeps the existing canonical navigation history, not raw personal messages.

Backend integration changes are captured in `services/document-admin/rag-response-settings.patch`; apply after the preceding performance patch. `response_settings.py` also has a copy beside server.py. The authoritative runtime copy belongs in rag-bot.

Validation: 43 existing chat/citation/guide tests, four schema/override/save tests, build. No benchmark implies an accuracy guarantee; compare real documented questions in English, Tagalog and Taglish and check citations manually before applying aggressive retrieval thresholds.
## Website service controls

Document Management and Chatbot Configuration include the same local controls. Ollama and the mobile API are managed through the existing `ServiceController`, which verifies project process identity before stopping anything. Port conflicts remain untouched. Ingestion can be enabled/paused for new preview/index requests; existing chunks remain searchable. Ingestion resets to enabled when the local adapter restarts. Pausing/stopping is blocked while an adapter indexing/test task holds the task lock. No force-cancel of partial indexing is offered.

Only the `ollama`, `api`, and `ingestion` service IDs and `start`/`stop` actions are accepted. Expo and arbitrary processes cannot be controlled through this endpoint. Controls remain behind the localhost proxy capability; no public remote control API is exposed. The document adapter itself must be started with its existing script; the panel cannot start itself while offline.

Status is checked every 10 seconds while the page is visible, with no overlapping polls. The API may take a moment to reach Ready after Start. Stopping it also disables its shared transcription gateway. Ollama required models are checked from the installed model list; missing models are reported, not downloaded automatically.
Status performance update: process ownership is scanned asynchronously every 30 seconds (and after control actions), with a 90-second freshness limit. Page requests check API/Ollama health in parallel with one-second timeouts and use cached ownership only for presentation; start/stop still performs the service manager's fresh identity checks. The browser keeps the last status across navigation, shares in-flight status requests, skips identical state updates, and polls every 15 seconds while visible.
## Follow-up context

The app and tester recognize conversational references (for example explain more/why/ano ibig sabihin niyan) when a topic is already selected. Retrieval queries include that topic and the selected detail; prior replies are not treated as factual evidence. Explicit topic changes still override the old topic, and unrelated requests keep the scope boundary. Direct questions preserve their actual wording and requested detail instead of silently becoming an overview request. When an established conversation lacks a supported result, the chatbot retains its topic and offers a focused detail clarification rather than clearing memory. First-message missing results retain the existing hall/category fallback. No extra routing LLM call is added.

Patch: `rag-conversation-context.patch`. Tests: existing menu/session/chat/citation suites plus `test_followup_context.py` (64 total).
