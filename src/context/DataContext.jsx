import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'
import { MOCK_USERS } from '../data/mockUsers'
import { MOCK_INCIDENTS } from '../data/mockIncidents'
import { MOCK_BLOTTER } from '../data/mockBlotter'
import { MOCK_DOCUMENTS } from '../data/mockDocuments'
import { MOCK_AUDIT_LOGS } from '../data/mockAuditLogs'
import {
  ROLES,
  ALWAYS_ON_MODULES,
  ASSIGNABLE_MODULE_ROLES,
  defaultModuleAccessMap,
  hasModuleAccess,
} from '../config/permissions'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [incidents, setIncidents] = useState([])
  const [blotterReports, setBlotterReports] = useState([])
  const [documents, setDocuments] = useState([])
  const [alertHistory, setAlertHistory] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [roleModuleAccess, setRoleModuleAccess] = useState(defaultModuleAccessMap)
  const [emergencyContacts, setEmergencyContacts] = useState([])
  const [loading, setLoading] = useState(true)

  // Seed database if empty
  const seedDatabaseIfEmpty = async () => {
    try {
      // 1. Check roles table
      const { data: currentRoles } = await supabase.from('roles').select('*')
      if (!currentRoles || currentRoles.length === 0) return

      const roleMap = {}
      currentRoles.forEach(r => {
        roleMap[r.role_name] = r.role_id
      })

      // 2. Check and seed sectors
      const { data: sectors } = await supabase.from('barangay_sectors').select('*')
      let dbSectors = sectors || []
      if (dbSectors.length === 0) {
        const { data: insertedSectors } = await supabase
          .from('barangay_sectors')
          .insert([
            { sector_name: 'Sector 1' },
            { sector_name: 'Sector 2' },
            { sector_name: 'Sector 3' }
          ])
          .select()
        dbSectors = insertedSectors || []
      }

      const sectorMap = {}
      dbSectors.forEach(s => {
        sectorMap[s.sector_name] = s.sector_id
      })

      // 3. Check and seed documents
      const { count: docCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
      if (docCount === 0) {
        const docsToInsert = MOCK_DOCUMENTS.map(d => ({
          title: d.title,
          document_type: d.title.includes('Ordinance') ? 'Lokal na Ordinansa' : 'Executive Order',
          file_path: `/uploads/${d.title}`,
          approval_status: d.officialStatus === 'Opisyal' ? 'Approved' : 'Pending',
          is_active: true
        }))
        await supabase.from('documents').insert(docsToInsert)
      }

      // 4. Check and seed pre_blotters
      const { count: pbCount } = await supabase
        .from('pre_blotters')
        .select('*', { count: 'exact', head: true })
      if (pbCount === 0) {
        for (let i = 0; i < MOCK_INCIDENTS.length; i++) {
          const inc = MOCK_INCIDENTS[i]
          const { data: ext } = await supabase
            .from('ai_extractions')
            .insert([{
              incident_type: inc.title,
              incident_datetime: inc.dateISO,
              incident_location: inc.location,
              narrative_summary: inc.excerpt,
              json_output: {
                what: inc.excerpt,
                who: 'Unknown Suspect',
                where: inc.location,
                when: inc.dateISO,
                why: 'Unknown',
                how: 'Reported by resident'
              }
            }])
            .select()

          if (ext && ext[0]) {
            const matchingBlotter = MOCK_BLOTTER.find(b => b.title === inc.title) || {}
            await supabase
              .from('pre_blotters')
              .insert([{
                reference_no: inc.ref,
                extraction_id: ext[0].extraction_id,
                sector_id: sectorMap[inc.sector] || null,
                latitude: inc.lat,
                longitude: inc.lng,
                status: matchingBlotter.status || 'Sinuri',
                remarks: matchingBlotter.hearingNote || ''
              }])
          }
        }
      }
      // 5. Check and seed emergency_contacts
      const { count: contactsCount } = await supabase
        .from('emergency_contacts')
        .select('*', { count: 'exact', head: true })
      if (contactsCount === 0) {
        const contactsToInsert = [
          { agency_name: 'BFP Milagrosa', contact_person: 'Fire Department', phone_number: '0912-345-6789', category: 'Emergency', is_active: true },
          { agency_name: 'PNP Station 5', contact_person: 'Police Department', phone_number: '0923-456-7890', category: 'Emergency', is_active: true },
          { agency_name: 'Barangay Hall', contact_person: 'Desk Officer', phone_number: '0934-567-8901', category: 'Barangay Services', is_active: true },
          { agency_name: 'Barangay Tanod', contact_person: 'BPSO Chief', phone_number: '0945-678-9012', category: 'Barangay Services', is_active: true },
          { agency_name: 'Barangay Health Center', contact_person: 'Health Worker', phone_number: '0956-789-0123', category: 'Barangay Services', is_active: true },
        ]
        await supabase.from('emergency_contacts').insert(contactsToInsert)
      }
    } catch (err) {
      console.error('Error seeding database:', err)
    }
  }

  // Fetch all tables from Supabase
  const fetchData = async () => {
    try {
      // 1. Fetch Users
      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select('*, roles(role_name)')
      
      if (!usersErr && usersData) {
        const mappedUsers = usersData
          .filter(u => u.roles?.role_name !== 'System Administrator')
          .map(u => ({
            id: u.id,
            name: `${u.first_name} ${u.last_name}`.trim(),
            role: u.roles?.role_name || 'Residente',
            verified: u.verification_status === 'Verified' ? 'Verified' : 'Pending',
            status: u.approval_status || 'Pending',
            email: u.email,
            phone: u.mobile_number || '',
            address: u.address || '',
            dateRegistered: new Date(u.created_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })
          }))
        setUsers(mappedUsers)
      }

      // 2. Fetch Pre Blotters & Incidents
      const { data: pbsData, error: pbsErr } = await supabase
        .from('pre_blotters')
        .select('*, ai_extractions(*), barangay_sectors(*)')
      
      if (!pbsErr && pbsData) {
        // Map to Incidents for GIS
        const mappedIncidents = pbsData.map(b => ({
          ref: b.reference_no,
          title: b.ai_extractions?.incident_type || 'Kaso',
          classification: b.ai_extractions?.incident_type || 'Kaso',
          severity: 'Katamtaman',
          excerpt: b.ai_extractions?.narrative_summary || b.remarks || '',
          location: b.ai_extractions?.incident_location || 'Quezon City',
          dateISO: b.submitted_at,
          lat: parseFloat(b.latitude) || 14.6760,
          lng: parseFloat(b.longitude) || 121.0450,
          sector: b.barangay_sectors?.sector_name || 'Sector 1'
        }))
        setIncidents(mappedIncidents)

        // Map to Blotter reports
        const mappedBlotter = pbsData.map(b => {
          const json = b.ai_extractions?.json_output || {}
          return {
            id: b.reference_no,
            title: b.ai_extractions?.incident_type || 'Kaganapan',
            status: b.status || 'Sinuri',
            datetime: new Date(b.submitted_at).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            }).toUpperCase(),
            filedBy: json.complainant || b.ai_extractions?.complainant || 'Residente',
            what: json.what || b.ai_extractions?.narrative_summary || '',
            who: json.who || b.ai_extractions?.respondent || '',
            where: json.where || b.ai_extractions?.incident_location || '',
            when: json.when || '',
            why: json.why || '',
            how: json.how || '',
            hearingDate: '',
            hearingNote: b.remarks || '',
            hearingCompleted: b.status === 'Nareselba' || b.status === 'Spam',
            outcome: b.status === 'Nareselba' ? (b.remarks || 'Resolbado na.') : ''
          }
        })
        // Fetch Manual Form Reports submitted by residents
        const { data: reportsData, error: reportsErr } = await supabase
          .from('reports')
          .select('*, users(first_name, last_name)')

        let mappedReports = []
        if (!reportsErr && reportsData) {
          mappedReports = reportsData.map(r => {
            const filedBy = r.users ? `${r.users.first_name} ${r.users.last_name}`.trim() : 'Residente'
            return {
              id: `REP-${String(r.report_id).padStart(5, '0')}`,
              dbId: r.report_id,
              isFormReport: true,
              title: 'Resident Form Report',
              status: r.status === 'Pending' ? 'Sinuri' : (r.status || 'Sinuri'),
              datetime: new Date(r.created_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              }).toUpperCase(),
              filedBy,
              what: r.incident_details || '',
              who: r.other_party || 'Hindi Alam',
              where: r.location || 'N/A',
              when: r.date_time || 'N/A',
              why: '',
              how: r.incident_details || '',
              hearingDate: '',
              hearingNote: r.witnesses ? `Saksi: ${r.witnesses}` : '',
              hearingCompleted: r.status === 'Nareselba' || r.status === 'Spam',
              outcome: r.status === 'Nareselba' ? 'Resolbado na.' : ''
            }
          })
        }
        setBlotterReports([...mappedBlotter, ...mappedReports])
      }

      // 3. Fetch Documents
      const { data: docsData, error: docsErr } = await supabase
        .from('documents')
        .select('*')
      
      if (!docsErr && docsData) {
        const mappedDocs = docsData.map(d => ({
          title: d.title,
          dateUploaded: new Date(d.upload_date).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }),
          status: 'Fully Indexed',
          officialStatus: d.approval_status === 'Approved' ? 'Opisyal' : 'Naghihintay ng Pag-apruba'
        }))
        setDocuments(mappedDocs)
      }

      // 4. Fetch Audit Logs
      const { data: logsData, error: logsErr } = await supabase
        .from('audit_logs')
        .select('*, users(first_name, last_name, roles(role_name))')
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (!logsErr && logsData) {
        const mappedLogs = logsData.map(l => {
          const actorName = l.users ? `${l.users.first_name} ${l.users.last_name}`.trim() : 'System'
          const actorRole = l.users?.roles?.role_name || '—'
          
          let color = 'blue'
          if (l.action_type?.toLowerCase().includes('suspend') || l.action_type?.toLowerCase().includes('reject')) color = 'orange'
          else if (l.action_type?.toLowerCase().includes('delete') || l.action_type?.toLowerCase().includes('deactivate')) color = 'red'
          else if (l.action_type?.toLowerCase().includes('create') || l.action_type?.toLowerCase().includes('upload') || l.action_type?.toLowerCase().includes('approve') || l.action_type?.toLowerCase().includes('resolve')) color = 'green'

          return {
            id: l.audit_id,
            actorName,
            actorRole,
            action: l.details || l.action_type,
            timestamp: new Date(l.created_at).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            }),
            color
          }
        })
        setAuditLog(mappedLogs)
      }

      // 5. Fetch Emergency Contacts
      const { data: contactsData, error: contactsErr } = await supabase
        .from('emergency_contacts')
        .select('*')
        .order('contact_id', { ascending: true })

      if (!contactsErr && contactsData) {
        setEmergencyContacts(contactsData.map(c => ({
          id: c.contact_id,
          agencyName: c.agency_name,
          contactPerson: c.contact_person || '',
          phoneNumber: c.phone_number,
          category: c.category || 'Emergency',
          isActive: c.is_active ?? true,
          authorizedBy: c.authorized_by || null
        })))
      }
    } catch (err) {
      console.error('Error loading data from Supabase:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load and seed on start
  useEffect(() => {
    const init = async () => {
      await seedDatabaseIfEmpty()
      await fetchData()
    }
    init()
  }, [user])

  const addAuditEntry = async (action, { color = 'blue', actorName, actorRole } = {}) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      await supabase
        .from('audit_logs')
        .insert([{
          actor_id: authUser?.id || null,
          action_type: action.substring(0, 50),
          details: action
        }])
      
      // Reload local state logs
      fetchData()
    } catch (err) {
      console.error('Error adding audit entry:', err)
    }
  }

  const updateUser = async (id, patch) => {
    try {
      let updateFields = {}
      if (patch.name) {
        const parts = patch.name.trim().split(' ')
        updateFields.first_name = parts[0]
        updateFields.last_name = parts.slice(1).join(' ')
      }
      if (patch.phone) updateFields.mobile_number = patch.phone
      if (patch.address) updateFields.address = patch.address
      if (patch.status) updateFields.approval_status = patch.status
      if (patch.verified) updateFields.verification_status = patch.verified === 'Verified' ? 'Verified' : 'Pending'
      
      if (patch.role) {
        const { data: roleObj } = await supabase
          .from('roles')
          .select('role_id')
          .eq('role_name', patch.role)
          .single()
        if (roleObj) {
          updateFields.role_id = roleObj.role_id
        }
      }

      await supabase
        .from('users')
        .update(updateFields)
        .eq('id', id)

      fetchData()
    } catch (err) {
      console.error('Error updating user:', err)
    }
  }

  const addUser = async (newUser) => {
    try {
      const { data: roleObj } = await supabase
        .from('roles')
        .select('role_id')
        .eq('role_name', newUser.role || 'Residente')
        .single()

      const parts = newUser.name.trim().split(' ')
      const first_name = parts[0] || 'New'
      const last_name = parts.slice(1).join(' ') || 'User'

      await supabase
        .from('users')
        .insert([{
          id: newUser.id || undefined,
          first_name,
          last_name,
          role_id: roleObj?.role_id,
          email: newUser.email,
          mobile_number: newUser.phone,
          address: newUser.address || 'N/A',
          verification_status: newUser.verified === 'Verified' ? 'Verified' : 'Pending',
          approval_status: newUser.status || 'Pending'
        }])

      fetchData()
    } catch (err) {
      console.error('Error adding user:', err)
    }
  }

  const removeUser = async (id) => {
    try {
      await supabase
        .from('users')
        .delete()
        .eq('id', id)
      fetchData()
    } catch (err) {
      console.error('Error removing user:', err)
    }
  }

  const suspendUserByName = async (name) => {
    try {
      const parts = name.trim().split(' ')
      const first_name = parts[0] || ''
      const last_name = parts.slice(1).join(' ') || ''
      
      await supabase
        .from('users')
        .update({ approval_status: 'Suspended' })
        .eq('first_name', first_name)
        .eq('last_name', last_name)

      fetchData()
    } catch (err) {
      console.error('Error suspending user:', err)
    }
  }

  const addEmergencyContact = async (contact) => {
    try {
      await supabase.from('emergency_contacts').insert([{
        agency_name: contact.agencyName,
        contact_person: contact.contactPerson || '',
        phone_number: contact.phoneNumber,
        category: contact.category,
        is_active: contact.isActive ?? true,
        authorized_by: user?.id || null
      }])
      fetchData()
    } catch (err) {
      console.error('Error adding emergency contact:', err)
    }
  }

  const updateEmergencyContact = async (id, patch) => {
    try {
      const updateFields = {}
      if (patch.agencyName !== undefined) updateFields.agency_name = patch.agencyName
      if (patch.contactPerson !== undefined) updateFields.contact_person = patch.contactPerson
      if (patch.phoneNumber !== undefined) updateFields.phone_number = patch.phoneNumber
      if (patch.category !== undefined) updateFields.category = patch.category
      if (patch.isActive !== undefined) {
        updateFields.is_active = patch.isActive
        if (patch.isActive) {
          updateFields.authorized_by = user?.id || null
        }
      }

      await supabase
        .from('emergency_contacts')
        .update(updateFields)
        .eq('contact_id', id)
      fetchData()
    } catch (err) {
      console.error('Error updating emergency contact:', err)
    }
  }

  const deleteEmergencyContact = async (id) => {
    try {
      await supabase
        .from('emergency_contacts')
        .delete()
        .eq('contact_id', id)
      fetchData()
    } catch (err) {
      console.error('Error deleting emergency contact:', err)
    }
  }

  const addIncident = async (incident) => {
    try {
      const { data: sectorObj } = await supabase
        .from('barangay_sectors')
        .select('sector_id')
        .eq('sector_name', incident.sector || 'Sector 1')
        .single()

      const { data: ext, error: extErr } = await supabase
        .from('ai_extractions')
        .insert([{
          incident_type: incident.title,
          incident_datetime: incident.dateISO || new Date().toISOString(),
          incident_location: incident.location,
          narrative_summary: incident.excerpt,
          json_output: {
            what: incident.excerpt,
            who: 'Unknown',
            where: incident.location,
            when: incident.dateISO,
            why: 'N/A',
            how: 'N/A'
          }
        }])
        .select()

      if (extErr) return

      await supabase
        .from('pre_blotters')
        .insert([{
          reference_no: incident.ref || `REF-${Date.now()}`,
          extraction_id: ext[0].extraction_id,
          sector_id: sectorObj?.sector_id || null,
          latitude: incident.lat,
          longitude: incident.lng,
          status: 'Sinuri',
          remarks: ''
        }])

      fetchData()
    } catch (err) {
      console.error('Error adding incident:', err)
    }
  }

  const replaceIncident = async (ref, record) => {
    try {
      const { data: pb } = await supabase
        .from('pre_blotters')
        .select('blotter_id, extraction_id')
        .eq('reference_no', ref)
        .single()

      if (!pb) return

      await supabase
        .from('ai_extractions')
        .update({
          incident_type: record.title,
          incident_location: record.location,
          narrative_summary: record.excerpt
        })
        .eq('extraction_id', pb.extraction_id)

      await supabase
        .from('pre_blotters')
        .update({
          latitude: record.lat,
          longitude: record.lng
        })
        .eq('blotter_id', pb.blotter_id)

      fetchData()
    } catch (err) {
      console.error('Error replacing incident:', err)
    }
  }

  const updateBlotterReport = async (id, patch) => {
    try {
      if (id.startsWith('REP-')) {
        const dbId = parseInt(id.replace('REP-', ''), 10)
        const updateFields = {}
        if (patch.status) updateFields.status = patch.status
        if (patch.hearingNote !== undefined) updateFields.witnesses = patch.hearingNote // Save notes to witnesses field or keep it simple
        await supabase
          .from('reports')
          .update(updateFields)
          .eq('report_id', dbId)
      } else {
        const { data: pb } = await supabase
          .from('pre_blotters')
          .select('blotter_id, extraction_id')
          .eq('reference_no', id)
          .single()

        if (!pb) return

        let pbPatch = {}
        if (patch.status) pbPatch.status = patch.status
        if (patch.hearingNote !== undefined) pbPatch.remarks = patch.hearingNote
        if (patch.remarks !== undefined) pbPatch.remarks = patch.remarks

        await supabase
          .from('pre_blotters')
          .update(pbPatch)
          .eq('blotter_id', pb.blotter_id)

        if (patch.outcome) {
          await supabase
            .from('pre_blotters')
            .update({ remarks: patch.outcome })
            .eq('blotter_id', pb.blotter_id)
        }
      }
      fetchData()
    } catch (err) {
      console.error('Error updating blotter report:', err)
    }
  }

  const addDocument = async (doc) => {
    try {
      await supabase
        .from('documents')
        .insert([{
          title: doc.title,
          document_type: doc.type || 'Lokal na Ordinansa',
          file_path: `/uploads/${doc.title}`,
          approval_status: doc.officialStatus === 'Opisyal' ? 'Approved' : 'Pending',
          is_active: true
        }])

      fetchData()
    } catch (err) {
      console.error('Error adding document:', err)
    }
  }

  const updateDocument = async (title, patch) => {
    try {
      let docPatch = {}
      if (patch.officialStatus) docPatch.approval_status = patch.officialStatus === 'Opisyal' ? 'Approved' : 'Pending'
      if (patch.title) docPatch.title = patch.title

      await supabase
        .from('documents')
        .update(docPatch)
        .eq('title', title)

      fetchData()
    } catch (err) {
      console.error('Error updating document:', err)
    }
  }

  const addAlert = (entry) => {
    // Keep local in memory or optionally insert into notifications
    setAlertHistory((prev) => [entry, ...prev])
  }

  const setModuleAccess = (role, moduleKey, enabled) => {
    if (!ASSIGNABLE_MODULE_ROLES.includes(role)) return
    setRoleModuleAccess((prev) => ({
      ...prev,
      [role]: { ...prev[role], [moduleKey]: enabled },
    }))
  }

  const hasDynamicModuleAccess = (role, moduleKey) => {
    if (ALWAYS_ON_MODULES.includes(moduleKey)) return true
    if (role === ROLES.ADMIN) return hasModuleAccess(role, moduleKey)
    const override = roleModuleAccess[role]?.[moduleKey]
    if (override !== undefined) return override
    return hasModuleAccess(role, moduleKey)
  }

  return (
    <DataContext.Provider
      value={{
        users,
        updateUser,
        addUser,
        removeUser,
        suspendUserByName,
        incidents,
        addIncident,
        replaceIncident,
        blotterReports,
        updateBlotterReport,
        documents,
        addDocument,
        updateDocument,
        alertHistory,
        addAlert,
        auditLog,
        addAuditEntry,
        roleModuleAccess,
        setModuleAccess,
        hasDynamicModuleAccess,
        emergencyContacts,
        addEmergencyContact,
        updateEmergencyContact,
        deleteEmergencyContact,
        loading,
        fetchData,
      }}
    >
      {!loading && children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
