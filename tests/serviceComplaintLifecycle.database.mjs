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

await db.exec(`alter table users add column role_id int; create table roles(role_id int,role_name text); insert into roles values(1,'System Administrator'); insert into users values('00000000-0000-0000-0000-000000000009','Staff','Admin',1); grant select on users,roles to authenticated;`)
await db.exec(readFileSync(new URL('../supabase/migrations/20261030_service_complaint_lifecycle.sql',import.meta.url),'utf8'))
const inserted=await db.query("insert into reports(reference_no,user_id,status,full_details) values('SERVICE',$1,'Under Review','{\"type\":\"service_complaint\"}') returning id",[owner]);
const id=inserted.rows[0].id;
await db.exec("set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000009'")
let last=null, number=0;
const save=async(action,note='Actual staff note',expected=last,requestId=null)=>{
 const request=requestId||`00000000-0000-0000-0001-${String(++number).padStart(12,'0')}`;
 const result=await db.query('select (public.save_service_complaint_action($1,$2,$3,$4,$5,$6)).*',['reports',id,action,note,request,expected]);
 last=result.rows[0].id;return result.rows[0];
};
await assert.rejects(save('resolve'),/Confirm receipt/);
const started=await save('start'); assert.equal(started.stage,'in_progress');
await assert.rejects(save('resolve','',last),/Enter a note/);
await assert.rejects(save('note','Stale update',null),/updated/);
assert.equal((await save('follow_up')).stage,'follow_up');
assert.equal((await save('close_unresolved','Referred to responsible office')).stage,'closed_unresolved');
await assert.rejects(save('note'),/Reopen/);
assert.equal((await save('reopen','New information received')).stage,'in_progress');
const request='00000000-0000-0000-0002-000000000001';
const resolved=await save('resolve','Repaired and verified',last,request);assert.equal(resolved.stage,'resolved');
const again=await save('resolve','Repaired and verified',resolved.id,request);assert.equal(again.id,resolved.id);
await db.exec('reset role');
assert.equal((await db.query("select status from reports where id=$1",[id])).rows[0].status,'Resolved');
assert.equal((await db.query("select count(*)::int as n from resident_report_notifications where report_id=$1",[id])).rows[0].n,6);
const legacy='00000000-0000-0000-0003-000000000001';
await db.query("insert into service_complaints(complaint_id,reference_no,user_id,status) values($1,'OLD-SERVICE',$2,'Under Review')",[legacy,owner]);
await db.exec("set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000009'");
await db.query("select public.save_service_complaint_action('service_complaints',$1,'start','Received by staff','00000000-0000-0000-0004-000000000001',null)",[legacy]);
await db.exec('reset role');
assert.equal((await db.query('select status from service_complaints where complaint_id=$1',[legacy])).rows[0].status,'Investigating');
assert.equal((await db.query('select count(*)::int as n from resident_report_notifications where report_id=$1',[legacy])).rows[0].n,2);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}'`);
await assert.rejects(save('reopen'),/Not authorized/);
assert.equal((await db.query('select * from bb_service_events')).rows.length,0);
await assert.rejects(db.exec("insert into bb_service_events(note) values('Forgery')"),/permission denied/);
await db.close();console.log('Service lifecycle checks passed: transitions, required notes, unresolved closure, reopening, idempotency, stale saves, one notification per action and access checks.');
