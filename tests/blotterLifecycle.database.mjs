// Run with PGLITE_PATH pointing to an installed @electric-sql/pglite package.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { PGlite } = require(process.env.PGLITE_PATH || '@electric-sql/pglite')
const db = new PGlite()
await db.exec(`create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
create table public.roles(role_id int primary key,role_name text);
create table public.users(id uuid primary key,first_name text,last_name text,role_id int);
create table public.reports(reference_no text primary key,full_details jsonb,status text,outcome text,hearing_date timestamptz,hearing_completed boolean);
create table public.pre_blotters(reference_no text primary key,status text,outcome text,hearing_date timestamptz,hearing_completed boolean);
insert into public.roles values(1,'Barangay Secretary'),(2,'Lupon Member'),(3,'System Administrator'),(4,'Residente');
insert into public.users values('00000000-0000-0000-0000-000000000001','Test','Secretary',1),('00000000-0000-0000-0000-000000000002','Test','Lupon',2),('00000000-0000-0000-0000-000000000003','Test','Admin',3),('00000000-0000-0000-0000-000000000004','Test','Resident',4);
insert into public.reports values('TEST','{"type":"blotter"}','Under Review',null,null,false);`)
await db.exec(readFileSync(new URL('../supabase/migrations/20261029_blotter_case_lifecycle.sql', import.meta.url), 'utf8'))
let actor = '00000000-0000-0000-0000-000000000001'
let version = 0
const past = new Date(Date.now() - 86400000).toISOString()
async function run(kind, payload, expected = version, id = crypto.randomUUID()) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${actor}'`)
  try { return (await db.query('select (public.bb_record_case_event($1,$2,$3,$4::jsonb,$5,$6::uuid)).*', ['reports','TEST',kind,JSON.stringify({ notes: 'Test notes', occurred_at: past, ...payload }),expected,id])).rows[0] }
  finally { await db.exec('reset role') }
}
const assessment = { route: 'kp', jurisdiction_basis: 'Officer assessed', venue_basis: 'Assessed', approved: true }
const request = crypto.randomUUID()
await run('assessment', assessment, version, request); version++
await run('assessment', assessment, 0, request)
assert.equal((await db.query('select count(*)::int as n from bb_blotter_events')).rows[0].n, 1)
await assert.rejects(run('assessment', assessment, 0), /Case changed/)
actor='00000000-0000-0000-0000-000000000003'
await run('assignment',{assigned_to:'00000000-0000-0000-0000-000000000003',assigned_name:'Test Admin'});version++
actor='00000000-0000-0000-0000-000000000004'
await assert.rejects(run('assessment',assessment), /Role cannot/)
actor='00000000-0000-0000-0000-000000000002'
await assert.rejects(run('meeting_scheduled',{}), /Meeting ID/)
actor='00000000-0000-0000-0000-000000000001'
await run('assignment',{assigned_to:'00000000-0000-0000-0000-000000000002',assigned_name:'Test Lupon'});version++
actor='00000000-0000-0000-0000-000000000002'
const meeting = { meeting_id: crypto.randomUUID(),type:'mediation',scheduled_at:new Date(Date.now()+86400000).toISOString(),ends_at:new Date(Date.now()+90000000).toISOString(),venue:'Hall',presiding:'Officer',agenda:'Discussion' }
await run('meeting_scheduled',meeting);version++
await assert.rejects(run('meeting_scheduled',{...meeting,meeting_id:crypto.randomUUID()}), /active meeting/)
await assert.rejects(run('meeting_recorded',{meeting_id:meeting.meeting_id}), /Required/)
const minutes={meeting_id:meeting.meeting_id,status:'completed',outcome:'continued',attendance:'both',actual_at:past,actual_end:past,actual_venue:'Hall',attendees:'Both parties',absence_reasons:'None',complainant_statement:'Statement A',respondent_statement:'Statement B',discussion:'Discussion',evidence:'None',agreements:'None yet',unresolved:'Dispute',official_actions:'Continue',responsibilities:'Parties to provide documents',next_steps:'Follow-up',minutes_reference:'MIN-1'}
await run('meeting_recorded',minutes);version++
await assert.rejects(run('meeting_recorded',minutes), /already exists/)
await assert.rejects(run('disposition',{disposition:'cfa',reference:'CFA',approved:true}), /legal basis/)
actor='00000000-0000-0000-0000-000000000001'
await run('meeting_verified',{meeting_id:meeting.meeting_id});version++
await assert.rejects(run('disposition',{disposition:'cfa',reference:'CFA',approved:true}), /legal basis/)
await db.exec(`set role authenticated; set request.jwt.claim.sub='${actor}'`)
await assert.rejects(db.exec(`update public.bb_blotter_events set actor_name='Fake'`), /permission denied/)
await assert.rejects(db.exec('delete from public.bb_blotter_events'), /permission denied/)
await db.exec('reset role')
const before = (await db.query('select count(*)::int as n from bb_blotter_events')).rows[0].n
await run('correction',{corrects_event_id:(await db.query("select id from bb_blotter_events where kind='meeting_recorded'")).rows[0].id,replacement:'Clarification'});version++
assert.equal((await db.query('select count(*)::int as n from bb_blotter_events')).rows[0].n,before+1)
assert.equal((await db.query("select payload->>'discussion' as discussion from bb_blotter_events where kind='meeting_recorded'")).rows[0].discussion,'Discussion')
await db.exec("set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000004'")
assert.equal((await db.query('select * from bb_blotter_events')).rows.length,0)
await db.exec('reset role')
await db.close()
console.log('Database lifecycle checks passed: migration, idempotency, concurrency, roles, assignment, meetings, minutes, CFA gates, immutable history and RLS.')
