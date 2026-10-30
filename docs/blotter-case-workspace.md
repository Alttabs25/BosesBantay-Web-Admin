# Blotter case workspace

## Active scope (supersedes the extended design below)

The active route now uses `ScopedBlotterWorkspace` and `scopedBlotterFlow`.
It implements only the study's intake/status-management scope: verify an intake,
flag spam, advance Under Review to Investigating, set the next hearing, record a
short session/follow-up note, and record Resolved with either an actual settlement
or an already-issued CFA. The original form, paper view and evidence remain
readable. Document issuance and the actual barangay proceedings remain outside
the application. Mobile tracking continues to read the existing report records.

The extended lifecycle UI, registry projection, document-management screens,
Pangkat/arbitration workflows and legal reminders are no longer used by the
active route. Previously created tables and records are retained; nothing was
dropped or erased. The material below describes the retained, inactive extended
implementation and does not define the current study scope.

Active-flow checks: `node --test tests/scopedBlotterFlow.test.mjs`.

The registry opens a case workspace with persistent identity, tabs, independent
content/sidebar scrolling, a record-derived stage, next action and advisory dates.

## Workflow

1. Review the original complaint. Record jurisdiction/eligibility, venue and route:
   KP, incident documentation, urgent referral, or outside-KP referral. The app
   does not classify legal eligibility from complaint keywords.
2. Assign a handler. The logged-in actor identity is separately recorded by the
   database on every action; a handler and an action's author are distinct.
3. Schedule an independent meeting. Rescheduling adds an event and retains the
   original interval and reason. Only one active meeting per case is permitted.
4. Record summons issuance and service separately. These are records of actual
   staff actions, not an electronic delivery service.
5. Open any meeting to record attendance, actual times/place, participant roles,
   absences/reasons, both parties' statements, discussion, evidence references,
   agreements, unresolved issues, official actions, responsibilities and next
   steps. Postponements and missed sessions have distinct statuses. Minutes are
   verified with a separate event and can be printed/saved as PDF.
6. Record the applicable branch: further meeting, reviewed Pangkat constitution,
   written voluntary arbitration agreement, signed settlement, or referral.
7. Monitor settlement obligations or repudiation. Record disposition separately:
   settled, CFA, referral, documentation, or arbitration award. A missed session
   never creates a CFA automatically. Staff must record a supporting reference,
   legal basis where applicable, and explicit approval.
8. Add follow-up/compliance developments and archive only after disposition.
   Corrections are addenda that point to an original event, never silent edits.

## Data and security

`bb_blotter_events` is a versioned, append-only event store keyed by the existing
source table and reference. Each meeting has its own UUID and chronological
record. The client projects meetings, notices, stages and document references
from these events. There is no inferred or fabricated meeting history.

`bb_record_case_event` checks the authenticated staff role, current case version,
required data and transitions under a per-case transaction lock. Request UUIDs
make retries idempotent. Event insertion and updates to the existing common
resident status/hearing fields are atomic. Direct authenticated inserts, updates
and deletes on the event table are not granted. Existing tables/policies remain
structurally unchanged.

At the user's request, all currently supported blotter staff roles, including
System Administrators and Lupon members, have full access to these workflow
actions for now; assignment is informational. Anonymous users and residents do
not gain access. The database gate is in the RPC and read policy helper, not just
in the UI. Restore finer role/assignment permissions before a stricter rollout.

Legacy hearing notes and outcomes remain visible as legacy information. They
are not automatically converted into verified meeting records. Empty lifecycle
history is not represented as completed legal work.

## Documents and limits

The requested scope is process documentation. The Documents tab registers
references for notices, minutes, agreements, referrals and certifications; no
new evidence storage bucket or upload flow is installed. Existing intake
attachments remain available. Generated meeting minutes are a printable record,
not an automatically issued or legally approved instrument.

Advisory periods are configurable in `DEFAULT_CASE_RULES`. Reminders use actual
recorded trigger dates; they do not account for every exception, holiday,
extension, nullification, court action or local procedure. Staff must verify the
applicable rules. No deadline automatically disposes a case. Physical signatures,
service, document issuance and substantive legal decisions remain staff duties.

Legal sources: RA 7160 §§399–422 and the DILG enhanced KP training manual, linked
in the Procedures tab. Statutory time references must be reviewed when procedures
or governing law change.

## Verification

`node --test tests/blotterLifecycle.test.mjs`

Database isolation checks use PGlite (a separate temporary install); set
`PGLITE_PATH` to the installed package and run
`node tests/blotterLifecycle.database.mjs`. This creates a disposable database
with minimal fixtures; it does not write live case records.

`npm run build`

The live migration is `supabase/migrations/20261029_blotter_case_lifecycle.sql`.
The local preview requires an authenticated staff login for a full interactive
walkthrough.
