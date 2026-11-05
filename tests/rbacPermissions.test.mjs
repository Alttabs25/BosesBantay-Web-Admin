import test from 'node:test'
import assert from 'node:assert/strict'
import { ROLES, can, hasModuleAccess, normalizeRole } from '../src/config/permissions.js'

const expected = {
  [ROLES.SECRETARY]: ['dashboard','gis','serviceComplaints','blotter','userAccounts','knowledgeBase','directory','alerts','reports'],
  [ROLES.TANOD]: ['dashboard','gis','serviceComplaints','blotter','directory','alerts'],
  [ROLES.LUPON]: ['dashboard','blotter','directory','alerts','reports'],
  [ROLES.KAGAWAD]: ['dashboard','gis','serviceComplaints','directory','alerts','reports'],
  [ROLES.CAPTAIN]: ['dashboard','gis','serviceComplaints','blotter','userAccounts','knowledgeBase','directory','alerts','reports','auditLogs'],
}
const modules = ['dashboard','gis','serviceComplaints','blotter','userAccounts','knowledgeBase','services','directory','alerts','reports','auditLogs']

for (const [role, visible] of Object.entries(expected)) {
  test(`${role} has the required module set`, () => {
    assert.deepEqual(modules.filter(module => hasModuleAccess(role, module)), visible)
  })
}

test('legacy database role names normalize to the canonical officer roles', () => {
  assert.equal(normalizeRole('Lupon Member'), ROLES.LUPON)
  assert.equal(normalizeRole('Kagawad (Committee Chair)'), ROLES.KAGAWAD)
  assert.equal(normalizeRole('Barangay Captain'), ROLES.CAPTAIN)
})

test('sensitive actions stay separated', () => {
  assert.equal(can(ROLES.SECRETARY, 'userAccounts', 'verify'), true)
  assert.equal(can(ROLES.SECRETARY, 'userAccounts', 'approve'), false)
  assert.equal(can(ROLES.TANOD, 'blotter', 'confirm'), false)
  assert.equal(can(ROLES.LUPON, 'blotter', 'finalize'), false)
  assert.equal(can(ROLES.CAPTAIN, 'auditLogs', 'read'), true)
  assert.equal(can(ROLES.CAPTAIN, 'auditLogs', 'delete'), false)
  assert.equal(can(ROLES.KAGAWAD, 'alerts', 'create'), true)
  assert.equal(can(ROLES.KAGAWAD, 'serviceComplaints', 'update'), false)
})

test('System Administrator keeps all pre-existing modules', () => {
  assert.deepEqual(modules.filter(module => hasModuleAccess(ROLES.ADMIN, module)), modules)
})
