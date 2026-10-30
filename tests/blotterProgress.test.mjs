import test from 'node:test'
import assert from 'node:assert/strict'
import { blotterProgress } from '../src/lib/blotterProgress.js'
import { scopedNextActions } from '../src/lib/scopedBlotterFlow.js'
test('review, accepted and scheduled reports have separate stages', () => { assert.equal(blotterProgress({status:'Sinuri'}).stageKey,'review'); assert.equal(blotterProgress({status:'Investigating'}).stageKey,'schedule_pending'); assert.equal(blotterProgress({status:'Investigating',hearingDate:'2099-01-01'}).stageKey,'scheduled') })
test('elapsed time never completes a hearing', () => { assert.equal(blotterProgress({status:'Investigating',hearingDate:'2000-01-01'}).stageKey,'scheduled') })
test('postponement and nonappearance require scheduling, not finalization', () => { for(const result of ['Ipinagpaliban','Hindi natuloy']) { const report={status:'Inimbestigahan',hearingDate:'2000-01-01',hearingNote:`Venue: Room 1\nKalagayan: ${result}`,hearingCompleted:false}; assert.deepEqual(scopedNextActions(report).actions,['schedule']); assert.notEqual(blotterProgress(report).stageKey,'scheduled') } })
test('a newly recorded schedule supersedes an older postponed session', () => { const report={status:'Investigating',hearingDate:'2099-01-01',hearingNote:'Kalagayan: Ipinagpaliban\nNew schedule\nVenue: Room 2'}; assert.equal(blotterProgress(report).stageKey,'scheduled') })
test('completed hearing awaits outcome', () => { assert.equal(blotterProgress({status:'Investigating',hearingCompleted:true}).stageKey,'outcome_pending') })
test('CFA and settlement close a report with different outcomes', () => { const cfa=blotterProgress({status:'Nareselba',outcome:'Certificate to File Action (CFA) — naisyung sertipikasyon'});const settled=blotterProgress({status:'Nareselba',outcome:'Settlement — Nagkaareglo'});assert.equal(cfa.statusLabel,'Closed');assert.equal(settled.statusLabel,'Closed');assert.equal(cfa.outcome,'CFA recorded');assert.equal(settled.outcome,'Settled') })
test('closed report without an explicit outcome never implies settlement', () => { assert.equal(blotterProgress({status:'Resolved',outcome:'Resolbado na.'}).outcome,'Not recorded') })
test('mentioning CFA later in a note does not override selected settlement', () => { assert.equal(blotterProgress({status:'Resolved',outcome:'Settlement — Nagkaareglo\nCFA discussed but not issued'}).outcome,'Settled') })
