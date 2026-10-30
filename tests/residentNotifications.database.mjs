import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const { PGlite } = createRequire(import.meta.url)(process.env.PGLITE_PATH || '@electric-sql/pglite')
const db = new PGlite()
const owner='00000000-0000-0000-0000-000000000001'
await db.exec(`create role anon; create role authenticated; create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
create table users(id uuid,first_name text,last_name text);
create table reports(id uuid default gen_random_uuid(),reference_no text,user_id uuid,status text,full_details jsonb,hearing_date timestamptz,hearing_note text,hearing_completed boolean,outcome text);
create table pre_blotters(blotter_id bigint,reference_no text,user_id uuid,status text,hearing_date timestamptz,hearing_note text,hearing_completed boolean,outcome text);
create table service_complaints(complaint_id uuid,reference_no text,user_id uuid,status text);
`)
await db.exec(readFileSync(new URL('../supabase/migrations/20261029_resident_report_notifications.sql',import.meta.url),'utf8'))
await db.exec(readFileSync(new URL('../supabase/migrations/20261029_resident_notification_venue.sql',import.meta.url),'utf8'))
await db.exec(readFileSync(new URL('../supabase/migrations/20261029_resident_notification_notes.sql',import.meta.url),'utf8'))
await db.query("insert into reports(reference_no,user_id,status,full_details) values('TEST',$1,'Under Review','{\"type\":\"blotter\"}')",[owner])
const rows=async()=> (await db.query('select * from resident_report_notifications order by created_at,id')).rows
assert.equal((await rows()).length,1)
await db.exec("update reports set status='Investigating' where reference_no='TEST'")
assert.match((await rows()).find(r=>r.event_kind==='status_changed').message,/Nakumpirma na.*kasalukuyan/)
await db.exec("update reports set hearing_date='2099-01-01T08:00:00+08:00',hearing_note=E'Earlier meeting\nVenue: Old room\nNew meeting\nVenue: Room 2, Barangay Hall' where reference_no='TEST'")
assert.equal((await rows()).length,3)
assert.match((await rows()).find(r=>r.event_kind==='hearing_scheduled').message, /Venue: Room 2, Barangay Hall/)
assert.ok(!(await rows()).find(r=>r.event_kind==='hearing_scheduled').message.includes('Old room'))
assert.ok((await rows()).some(r=>r.event_kind==='hearing_scheduled' && /Philippine time/.test(r.message)))
await db.exec("update reports set hearing_note='Session held',hearing_completed=true where reference_no='TEST'")
assert.equal((await rows()).length,4)
assert.match((await rows()).find(r=>r.event_kind==='hearing_update').message, /Tala:\nSession held/)
await db.exec("update reports set hearing_note='Session held',hearing_completed=true where reference_no='TEST'")
assert.equal((await rows()).length,4)
await db.exec("update reports set outcome='Settlement — Nagkaareglo',status='Resolved',hearing_note='Final outcome' where reference_no='TEST'")
assert.equal((await rows()).length,5)
assert.ok((await rows()).some(r=>r.event_kind==='resolved' && /Nagkaareglo/.test(r.message)))
await db.exec("insert into reports(reference_no,status) values('NO-OWNER','Under Review')")
assert.equal((await rows()).length,5)
await db.query("insert into pre_blotters(blotter_id,reference_no,user_id,status) values(1,'LEGACY',$1,'Sinuri')",[owner])
assert.equal((await rows()).length,6)
await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}'`)
assert.equal((await rows()).length,6)
await db.exec("set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'")
assert.equal((await rows()).length,0)
await assert.rejects(db.exec("insert into resident_report_notifications(user_id) values('00000000-0000-0000-0000-000000000002')"),/permission denied/)
await db.close()
console.log('Notification checks passed: intake, confirmation, hearing, notes, resolution, no-op deduplication, legacy reports and account privacy.')
