import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'
import { MOCK_INCIDENTS } from '../data/mockIncidents'
import { MOCK_BLOTTER } from '../data/mockBlotter'
import {
  ROLES,
  ALWAYS_ON_MODULES,
  ASSIGNABLE_MODULE_ROLES,
  defaultModuleAccessMap,
  hasModuleAccess,
} from '../config/permissions'

const DataContext = createContext(null)

function calculateAge(birthdateString) {
  if (!birthdateString) return ''
  const today = new Date()
  const birthDate = new Date(birthdateString)
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

function formatDateTimeLocal(dateString) {
  if (!dateString) return ''
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return ''
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  } catch (e) {
    return ''
  }
}

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
      const { data: currentRoles } = await supabase.from('roles').select('*')
      if (!currentRoles || currentRoles.length === 0) return

      const roleMap = {}
      currentRoles.forEach(r => {
        roleMap[r.role_name] = r.role_id
      })

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
                what: inc.title,
                who: 'Unknown Suspect',
                where: inc.location,
                when: inc.dateISO,
                why: 'Community hazard requiring barangay inspection and action',
                how: inc.excerpt
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
            verified: u.verification_status === 'Verified' || u.verification_status === 'pb_authorized' ? 'Verified' : 'Pending',
            barangayIdStatus: u.verification_status || 'unverified',
            status: u.approval_status === 'Suspended' || u.approval_status === 'Deactivated'
              ? u.approval_status
              : (u.verification_status === 'pb_authorized' ? 'Active' : (u.approval_status || 'Pending')),
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
      // 2. Fetch Pre Blotters & Incidents
      const { data: pbsData, error: pbsErr } = await supabase
        .from('pre_blotters')
        .select('*, ai_extractions(*), barangay_sectors(*)')
      
      let mappedBlotter = []
      let mappedIncidents = []

      if (!pbsErr && pbsData) {
        pbsData.forEach(b => {
          const json = b.ai_extractions?.json_output || {}
          const complainantName = json.complainant || b.ai_extractions?.complainant || 'Residente'
          
          const userObj = usersData?.find(u => u.id === b.user_id) ||
                          usersData?.find(u => `${u.first_name} ${u.last_name}`.trim().toLowerCase() === complainantName.toLowerCase())

          const rawLat = b.latitude != null ? parseFloat(b.latitude) : null
          const rawLng = b.longitude != null ? parseFloat(b.longitude) : null
          const hasValidCoords = rawLat != null && rawLng != null && !isNaN(rawLat) && !isNaN(rawLng) && rawLat >= -90 && rawLat <= 90 && rawLng >= -180 && rawLng <= 180

          const isMapped = b.is_mapped !== undefined && b.is_mapped !== null
            ? (Boolean(b.is_mapped) && hasValidCoords)
            : (hasValidCoords && (b.map_status === 'Approved' || b.map_status === undefined))

          const lat = hasValidCoords ? rawLat : null
          const lng = hasValidCoords ? rawLng : null

          const incidentItem = {
            id: b.reference_no,
            ref: b.reference_no,
            blotterId: b.blotter_id,
            title: json.what || b.ai_extractions?.incident_type || 'Kaso',
            classification: json.classification || b.ai_extractions?.incident_type || 'Kaso',
            severity: json.severity || 'Katamtaman',
            excerpt: b.ai_extractions?.narrative_summary || b.remarks || '',
            location: b.ai_extractions?.incident_location || 'Quezon City',
            address: b.ai_extractions?.incident_location || 'Quezon City',
            dateISO: b.ai_extractions?.incident_datetime || b.submitted_at,
            lat,
            lng,
            latitude: lat,
            longitude: lng,
            sector: b.barangay_sectors?.sector_name || 'Sector 1',
            mapStatus: isMapped ? 'Approved' : (b.map_status || 'Pending'),
            is_mapped: isMapped,
            isMapped,
            mapReviewedBy: b.map_reviewed_by || b.mapped_by || null,
            mapReviewedAt: b.map_reviewed_at || b.mapped_at || null,
            filedBy: complainantName,
            status: b.status || 'Sinuri',
          }

          // Incidents collection contains all incidents; mapped ones have is_mapped = true and lat/lng
          mappedIncidents.push(incidentItem)

          // Map to Blotter reports
          mappedBlotter.push({
            id: b.reference_no,
            ref: b.reference_no,
            blotterId: b.blotter_id,
            rawDate: b.submitted_at || b.created_at,
            title: b.ai_extractions?.incident_type || 'Kaganapan',
            status: b.status || 'Sinuri',
            datetime: new Date(b.submitted_at || Date.now()).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            }).toUpperCase(),
            filedBy: complainantName,
            what: json.what || b.ai_extractions?.incident_type || 'Kaganapan',
            who: json.who || b.ai_extractions?.respondent || 'Hindi Alam',
            where: json.where || b.ai_extractions?.incident_location || 'N/A',
            location: b.ai_extractions?.incident_location || 'N/A',
            address: b.ai_extractions?.incident_location || 'N/A',
            when: json.when || 'N/A',
            why: json.why || 'N/A',
            how: json.how || b.ai_extractions?.narrative_summary || 'N/A',
            severity: json.severity || 'Katamtaman',
            sector: b.barangay_sectors?.sector_name || 'Sector 1',
            lat,
            lng,
            latitude: lat,
            longitude: lng,
            is_mapped: isMapped,
            isMapped,
            hearingDate: formatDateTimeLocal(b.hearing_date),
            hearingNote: b.hearing_note || b.remarks || '',
            hearingCompleted: b.hearing_completed !== undefined && b.hearing_completed !== null ? b.hearing_completed : (b.status === 'Nareselba' || b.status === 'Spam'),
            outcome: b.outcome || (b.status === 'Nareselba' ? (b.remarks || 'Resolbado na.') : ''),
            complainantPhone: userObj?.mobile_number || json.phone || json.complainant_phone || userObj?.phone || 'N/A',
            complainantAddress: userObj?.address || json.address || json.complainant_address || 'N/A',
            complainantGender: userObj?.gender || json.gender || json.complainant_gender || 'N/A',
            complainantAge: userObj?.birthdate ? calculateAge(userObj.birthdate) : (json.age || json.complainant_age || ''),
            isMinor: userObj?.birthdate ? calculateAge(userObj.birthdate) < 18 : (json.is_minor || false),
            mapStatus: isMapped ? 'Approved' : (b.map_status || 'Pending'),
            mappedAt: b.mapped_at || b.map_reviewed_at || null,
            mappedBy: b.mapped_by || b.map_reviewed_by || null,
          })
        })
      }

      // 3. Fetch Mobile Form Reports submitted by residents from `reports` table
      const { data: reportsData, error: reportsErr } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })

      let mappedReports = []
      if (!reportsErr && reportsData) {
        mappedReports = reportsData.map(r => {
          const userObj = usersData?.find(u => u.id === r.user_id)
          const filedBy = r.full_details?.complainant_name || (userObj ? `${userObj.first_name} ${userObj.last_name}`.trim() : 'Residente')
          
          let adminStatus = 'Sinuri'
          if (r.status === 'Under Review' || r.status === 'Pending') adminStatus = 'Sinuri'
          else if (r.status === 'Investigating') adminStatus = 'Inimbestigahan'
          else if (r.status === 'Resolved' || r.status === 'Nareselba') adminStatus = 'Nareselba'
          else if (r.status === 'Spam') adminStatus = 'Spam'
          else if (r.status) adminStatus = r.status

          const finalAge = userObj?.birthdate ? calculateAge(userObj.birthdate) : (r.full_details?.age || '')
          const rawDateStr = r.created_at || r.submitted_at || new Date().toISOString()

          const rawRepLat = r.latitude != null ? parseFloat(r.latitude) : null
          const rawRepLng = r.longitude != null ? parseFloat(r.longitude) : null
          const repValid = rawRepLat != null && rawRepLng != null && !isNaN(rawRepLat) && !isNaN(rawRepLng) && rawRepLat >= -90 && rawRepLat <= 90 && rawRepLng >= -180 && rawRepLng <= 180
          const repIsMapped = r.is_mapped !== undefined && r.is_mapped !== null ? (Boolean(r.is_mapped) && repValid) : repValid

          const reportItem = {
            id: r.reference_no || (r.id ? `REP-${String(r.id).substring(0, 8)}` : `REP-${Math.floor(100000 + Math.random() * 900000)}`),
            ref: r.reference_no || (r.id ? `REP-${String(r.id).substring(0, 8)}` : `REP-${Math.floor(100000 + Math.random() * 900000)}`),
            dbId: r.id,
            isFormReport: true,
            rawDate: rawDateStr,
            title: r.category || r.summary || 'Resident Form Report',
            classification: r.category || r.summary || 'Resident Form Report',
            status: adminStatus,
            datetime: new Date(rawDateStr).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            }).toUpperCase(),
            filedBy,
            what: r.full_details?.what || r.category || r.summary || 'Unspecified Incident',
            who: r.full_details?.who || r.other_party || r.respondent || r.full_details?.otherParties || 'Hindi Alam',
            where: r.location || r.full_details?.where || r.full_details?.location || 'N/A',
            location: r.location || r.full_details?.where || r.full_details?.location || 'N/A',
            address: r.location || r.full_details?.where || r.full_details?.location || 'N/A',
            when: r.full_details?.when || r.date_time || r.incident_date || r.full_details?.incidentAt || 'N/A',
            why: r.full_details?.why || 'N/A',
            how: r.description || r.full_details?.how || r.incident_details || r.full_details?.description || 'N/A',
            excerpt: r.description || r.full_details?.how || r.incident_details || '',
            hearingDate: formatDateTimeLocal(r.hearing_date),
            hearingNote: r.hearing_note || ((r.witnesses || r.full_details?.witnesses) ? `Saksi: ${r.witnesses || r.full_details?.witnesses}` : ''),
            hearingCompleted: r.hearing_completed !== undefined && r.hearing_completed !== null ? r.hearing_completed : (adminStatus === 'Nareselba' || adminStatus === 'Spam'),
            outcome: r.outcome || (adminStatus === 'Nareselba' ? 'Resolbado na.' : ''),
            complainantPhone: r.full_details?.complainant_phone || userObj?.mobile_number || r.full_details?.phone || userObj?.phone || 'N/A',
            complainantAddress: r.full_details?.complainant_address || userObj?.address || r.full_details?.address || 'N/A',
            complainantGender: r.full_details?.complainant_gender || userObj?.gender || r.full_details?.gender || 'N/A',
            complainantAge: finalAge,
            isMinor: finalAge ? Number(finalAge) < 18 : false,
            lat: repValid ? rawRepLat : null,
            lng: repValid ? rawRepLng : null,
            latitude: repValid ? rawRepLat : null,
            longitude: repValid ? rawRepLng : null,
            is_mapped: repIsMapped,
            isMapped: repIsMapped,
            mapStatus: repIsMapped ? 'Approved' : 'Pending',
          }

          if (repIsMapped) {
            mappedIncidents.push(reportItem)
          }

          return reportItem
        })
      }

      setIncidents(mappedIncidents)

      // Combine and sort by newest date first
      const combinedBlotter = [...mappedBlotter, ...mappedReports].sort((a, b) => {
        const timeA = new Date(a.rawDate).getTime() || 0
        const timeB = new Date(b.rawDate).getTime() || 0
        return timeB - timeA
      })

      setBlotterReports(combinedBlotter)

      // 4. Fetch Documents
      const { data: docsData, error: docsErr } = await supabase
        .from('documents')
        .select('*')
        .order('document_id', { ascending: false })
      
      if (!docsErr && docsData) {
        const mappedDocs = docsData.map((d) => {
          const sections = d.sections || []
          const summary = d.summary || ''

          return {
            id: d.document_id,
            title: d.title,
            ordinanceNo: d.ordinance_no || '',
            category: d.document_type || 'Lokal na Ordinansa',
            dateUploaded: d.upload_date ? new Date(d.upload_date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            }) : 'Recently',
            fileFormat: d.file_format || (d.title.endsWith('.docx') ? 'DOCX' : 'PDF'),
            fileSize: d.file_size || '1.2 MB',
            isMachineReadable: d.is_machine_readable ?? true,
            chunkCount: d.chunk_count || 12,
            status: !d.is_active || d.approval_status === 'Retired' ? 'Retired' : (d.vector_status || 'Fully Indexed'),
            officialStatus: d.approval_status === 'Approved' ? 'Opisyal' : (d.approval_status === 'Retired' ? 'Naka-retire' : 'Naghihintay ng Pag-apruba'),
            summary,
            sections,
            isActive: d.is_active ?? true
          }
        })
        setDocuments(mappedDocs)
      }

      // 5. Fetch Audit Logs
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

      // 6. Fetch Emergency Contacts
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

      // 7. Fetch Notifications
      const { data: notificationsData, error: notificationsErr } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:users!sent_by (
            first_name,
            last_name,
            roles (
              role_name
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (!notificationsErr && notificationsData) {
        const mappedAlerts = notificationsData.map(n => {
          const titleStr = n.title || ''
          const match = titleStr.match(/^\[(.*?)\s*\|\s*(.*?)\]\s*(.*)$/)
          let target = 'Lahat ng Residente'
          let level = 'Normal na Pagpapayo'
          let actualTitle = titleStr
          if (match) {
            target = match[1]
            level = match[2]
            actualTitle = match[3]
          }
          
          const senderName = n.sender 
            ? `${n.sender.first_name} ${n.sender.last_name}`.trim()
            : 'System'

          return {
            id: n.id ?? n.notification_id,
            title: actualTitle,
            message: n.message,
            target,
            level,
            type: n.notification_type || 'Community Announcement',
            sentBy: senderName,
            sentAt: new Date(n.created_at).toLocaleString('en-PH', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
          }
        })
        setAlertHistory(mappedAlerts)
      }
    } catch (err) {
      console.error('Error loading data from Supabase:', err)
    } finally {
      setLoading(false)
    }
  }

  // Initial setup and Supabase Realtime Subscriptions
  useEffect(() => {
    const init = async () => {
      await seedDatabaseIfEmpty()
      await fetchData()
    }
    init()

    // Realtime listener for incoming mobile reports & blotters
    const realtimeChannel = supabase
      .channel('public-datacontext-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => {
          fetchData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pre_blotters' },
        () => {
          fetchData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(realtimeChannel)
    }
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
      
      const { data: logsData, error: logsErr } = await supabase
        .from('audit_logs')
        .select('*, users(first_name, last_name, roles(role_name))')
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (!logsErr && logsData) {
        const mappedLogs = logsData.map(l => {
          const name = l.users ? `${l.users.first_name} ${l.users.last_name}`.trim() : 'System'
          const role = l.users?.roles?.role_name || '—'
          let logColor = 'blue'
          if (l.action_type?.toLowerCase().includes('suspend') || l.action_type?.toLowerCase().includes('reject')) logColor = 'orange'
          else if (l.action_type?.toLowerCase().includes('delete') || l.action_type?.toLowerCase().includes('deactivate')) logColor = 'red'
          else if (l.action_type?.toLowerCase().includes('create') || l.action_type?.toLowerCase().includes('upload') || l.action_type?.toLowerCase().includes('approve') || l.action_type?.toLowerCase().includes('resolve')) logColor = 'green'

          return {
            id: l.audit_id,
            actorName: name,
            actorRole: role,
            action: l.details || l.action_type,
            timestamp: new Date(l.created_at).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            }),
            color: logColor
          }
        })
        setAuditLog(mappedLogs)
      }
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
      if (patch.barangayIdStatus) updateFields.verification_status = patch.barangayIdStatus
      
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

  const mapIncidentLocation = async (refOrId, { lat, lng, location, address } = {}) => {
    try {
      if (lat == null || lng == null) {
        throw new Error('Pumili muna ng lokasyon sa mapa bago i-map ang insidente.')
      }
      const parsedLat = parseFloat(lat)
      const parsedLng = parseFloat(lng)
      if (isNaN(parsedLat) || isNaN(parsedLng) || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
        throw new Error('Di-wastong coordinates ng lokasyon. Siguraduhing nasa wastong saklaw ang latitude at longitude.')
      }

      let reviewerId = null
      if (user?.id && users.some((u) => u.id === user.id)) {
        reviewerId = user.id
      }

      const existingReport = blotterReports.find(r => r.id === refOrId || r.ref === refOrId)
      const currentStatus = existingReport?.status || incidents.find(i => i.ref === refOrId || i.id === refOrId)?.status
      if (currentStatus === 'Sinuri' || currentStatus === 'Under Review' || currentStatus === 'Pending' || currentStatus === 'Spam') {
        throw new Error('Tanging mga nakumpirmang blotter incident (Investigating o Resolved) lamang ang maaaring i-map sa GIS Command Center.')
      }
      const targetLocation = location || address || existingReport?.location || existingReport?.where || 'Quezon City'

      if (existingReport?.isFormReport || String(refOrId).startsWith('REP-')) {
        const dbTarget = existingReport?.dbId || refOrId
        const isUuid = typeof dbTarget === 'string' && dbTarget.includes('-') && dbTarget.length > 20
        const updatePayload = {
          latitude: parsedLat,
          longitude: parsedLng,
          is_mapped: true,
          mapped_at: new Date().toISOString(),
          mapped_by: reviewerId,
          location: targetLocation,
        }
        const query = supabase.from('reports').update(updatePayload)
        const { error: repErr } = isUuid ? await query.eq('id', dbTarget) : await query.eq('reference_no', refOrId)
        if (repErr && repErr.message?.includes('is_mapped')) {
          const fbPayload = { latitude: parsedLat, longitude: parsedLng, location: targetLocation }
          const fbQuery = supabase.from('reports').update(fbPayload)
          if (isUuid) await fbQuery.eq('id', dbTarget)
          else await fbQuery.eq('reference_no', refOrId)
        }
      } else {
        const { data: pb } = await supabase
          .from('pre_blotters')
          .select('blotter_id, extraction_id')
          .eq('reference_no', refOrId)
          .maybeSingle()

        if (pb) {
          const pbUpdate = {
            latitude: parsedLat,
            longitude: parsedLng,
            is_mapped: true,
            map_status: 'Approved',
            map_reviewed_by: reviewerId,
            map_reviewed_at: new Date().toISOString(),
            mapped_by: reviewerId,
            mapped_at: new Date().toISOString(),
          }
          const { error: pbErr } = await supabase.from('pre_blotters').update(pbUpdate).eq('blotter_id', pb.blotter_id)
          if (pbErr && pbErr.message?.includes('is_mapped')) {
            await supabase.from('pre_blotters').update({
              latitude: parsedLat,
              longitude: parsedLng,
              map_status: 'Approved',
              map_reviewed_by: reviewerId,
              map_reviewed_at: new Date().toISOString(),
            }).eq('blotter_id', pb.blotter_id)
          }

          if (pb.extraction_id && targetLocation) {
            await supabase.from('ai_extractions').update({ incident_location: targetLocation }).eq('extraction_id', pb.extraction_id)
          }
        }
      }

      // Update state immediately for both views
      setBlotterReports(prev => prev.map(r => {
        if (r.id === refOrId || r.ref === refOrId) {
          return {
            ...r,
            lat: parsedLat,
            lng: parsedLng,
            latitude: parsedLat,
            longitude: parsedLng,
            is_mapped: true,
            isMapped: true,
            mapStatus: 'Approved',
            location: targetLocation,
            address: targetLocation,
            where: targetLocation,
            mappedAt: new Date().toISOString(),
            mappedBy: reviewerId,
          }
        }
        return r
      }))

      setIncidents(prev => {
        const existing = prev.find(i => i.ref === refOrId || i.id === refOrId)
        if (existing) {
          return prev.map(i => (i.ref === refOrId || i.id === refOrId) ? {
            ...i,
            lat: parsedLat,
            lng: parsedLng,
            latitude: parsedLat,
            longitude: parsedLng,
            is_mapped: true,
            isMapped: true,
            mapStatus: 'Approved',
            location: targetLocation,
            address: targetLocation,
          } : i)
        }
        if (existingReport) {
          return [{
            ref: existingReport.id,
            id: existingReport.id,
            blotterId: existingReport.blotterId,
            title: existingReport.title,
            classification: existingReport.classification || existingReport.what || existingReport.title,
            severity: existingReport.severity || 'Katamtaman',
            excerpt: existingReport.how || existingReport.excerpt || existingReport.title,
            location: targetLocation,
            address: targetLocation,
            dateISO: existingReport.rawDate || existingReport.dateISO || new Date().toISOString(),
            lat: parsedLat,
            lng: parsedLng,
            latitude: parsedLat,
            longitude: parsedLng,
            sector: existingReport.sector || 'Sector 1',
            mapStatus: 'Approved',
            is_mapped: true,
            isMapped: true,
            filedBy: existingReport.filedBy,
            status: existingReport.status || 'Sinuri',
          }, ...prev]
        }
        return prev
      })

      addAuditEntry(`I-map ang insidente ${refOrId} sa GIS map`, { color: 'green' })
      fetchData().catch(() => {})
      return { success: true }
    } catch (err) {
      console.error('Error in mapIncidentLocation:', err)
      throw err
    }
  }

  const unmapIncidentLocation = async (refOrId) => {
    try {
      const existingReport = blotterReports.find(r => r.id === refOrId || r.ref === refOrId)

      if (existingReport?.isFormReport || String(refOrId).startsWith('REP-')) {
        const dbTarget = existingReport?.dbId || refOrId
        const isUuid = typeof dbTarget === 'string' && dbTarget.includes('-') && dbTarget.length > 20
        const updatePayload = {
          latitude: null,
          longitude: null,
          is_mapped: false,
        }
        const query = supabase.from('reports').update(updatePayload)
        const { error: repErr } = isUuid ? await query.eq('id', dbTarget) : await query.eq('reference_no', refOrId)
        if (repErr && repErr.message?.includes('is_mapped')) {
          const fbPayload = { latitude: null, longitude: null }
          const fbQuery = supabase.from('reports').update(fbPayload)
          if (isUuid) await fbQuery.eq('id', dbTarget)
          else await fbQuery.eq('reference_no', refOrId)
        }
      } else {
        const { data: pb } = await supabase
          .from('pre_blotters')
          .select('blotter_id')
          .eq('reference_no', refOrId)
          .maybeSingle()

        if (pb) {
          const { error: pbErr } = await supabase.from('pre_blotters').update({
            latitude: null,
            longitude: null,
            is_mapped: false,
            map_status: 'Pending',
          }).eq('blotter_id', pb.blotter_id)

          if (pbErr && pbErr.message?.includes('is_mapped')) {
            await supabase.from('pre_blotters').update({
              latitude: null,
              longitude: null,
              map_status: 'Pending',
            }).eq('blotter_id', pb.blotter_id)
          }
        }
      }

      // Update state immediately
      setBlotterReports(prev => prev.map(r => {
        if (r.id === refOrId || r.ref === refOrId) {
          return {
            ...r,
            lat: null,
            lng: null,
            latitude: null,
            longitude: null,
            is_mapped: false,
            isMapped: false,
            mapStatus: 'Pending',
          }
        }
        return r
      }))

      setIncidents(prev => prev.map(i => {
        if (i.ref === refOrId || i.id === refOrId) {
          return {
            ...i,
            lat: null,
            lng: null,
            latitude: null,
            longitude: null,
            is_mapped: false,
            isMapped: false,
            mapStatus: 'Pending',
          }
        }
        return i
      }))

      addAuditEntry(`Inalis sa GIS map ang insidente ${refOrId}`, { color: 'orange' })
      fetchData().catch(() => {})
      return { success: true }
    } catch (err) {
      console.error('Error in unmapIncidentLocation:', err)
      throw err
    }
  }

  const addBlotterReport = async (reportData) => {
    try {
      let reviewerId = null
      if (user?.id && users.some((u) => u.id === user.id)) {
        reviewerId = user.id
      }

      const isMapped = Boolean(reportData.isMapped) && reportData.lat != null && reportData.lng != null
      const parsedLat = isMapped ? parseFloat(reportData.lat) : null
      const parsedLng = isMapped ? parseFloat(reportData.lng) : null
      const refNo = reportData.ref || `SC-${Math.floor(100000 + Math.random() * 900000)}`
      const isoDate = reportData.dateISO ? new Date(reportData.dateISO).toISOString() : new Date().toISOString()
      const titleValue = reportData.title || reportData.classification || 'Kaganapan'
      const classificationValue = reportData.classification || titleValue
      const locationValue = reportData.location || reportData.where || 'Quezon City'

      const { data: ext, error: extErr } = await supabase
        .from('ai_extractions')
        .insert([{
          incident_type: titleValue,
          incident_datetime: isoDate,
          incident_location: locationValue,
          complainant: reportData.filedBy || 'Residente',
          respondent: reportData.who || 'Hindi Alam',
          narrative_summary: reportData.how || reportData.excerpt || reportData.what || '',
          json_output: {
            what: reportData.what || titleValue,
            who: reportData.who || 'Hindi Alam',
            where: locationValue,
            when: reportData.when || isoDate,
            why: reportData.why || 'N/A',
            how: reportData.how || reportData.excerpt || '',
            classification: classificationValue,
            severity: reportData.severity || 'Katamtaman',
            phone: reportData.complainantPhone || '',
            address: reportData.complainantAddress || '',
            gender: reportData.complainantGender || '',
            age: reportData.complainantAge || null,
            is_minor: reportData.isMinor || false,
          }
        }])
        .select()

      if (extErr) throw new Error(extErr.message || 'Hindi maipasok ang AI extraction record.')

      const { data: sec } = await supabase
        .from('barangay_sectors')
        .select('sector_id')
        .eq('sector_name', reportData.sector || 'Sector 1')
        .maybeSingle()

      const pbInsert = {
        reference_no: refNo,
        extraction_id: ext[0].extraction_id,
        sector_id: sec?.sector_id || null,
        latitude: parsedLat,
        longitude: parsedLng,
        status: reportData.status || 'Sinuri',
        remarks: reportData.remarks || '',
        map_status: isMapped ? 'Approved' : 'Pending',
        is_mapped: isMapped,
        map_reviewed_by: isMapped ? reviewerId : null,
        map_reviewed_at: isMapped ? new Date().toISOString() : null,
        mapped_by: isMapped ? reviewerId : null,
        mapped_at: isMapped ? new Date().toISOString() : null,
      }

      const { data: pbData, error: pbErr } = await supabase
        .from('pre_blotters')
        .insert([pbInsert])
        .select()

      if (pbErr) {
        if (pbErr.message?.includes('is_mapped')) {
          const fallbackInsert = { ...pbInsert }
          delete fallbackInsert.is_mapped
          delete fallbackInsert.mapped_by
          delete fallbackInsert.mapped_at
          await supabase.from('pre_blotters').insert([fallbackInsert])
        } else {
          await supabase.from('ai_extractions').delete().eq('extraction_id', ext[0].extraction_id)
          throw new Error(pbErr.message || 'Hindi maipasok ang pre-blotter record.')
        }
      }

      const newReportItem = {
        id: refNo,
        ref: refNo,
        blotterId: pbData?.[0]?.blotter_id,
        rawDate: isoDate,
        title: titleValue,
        status: reportData.status || 'Sinuri',
        datetime: new Date(isoDate).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }).toUpperCase(),
        filedBy: reportData.filedBy || 'Residente',
        what: reportData.what || titleValue,
        who: reportData.who || 'Hindi Alam',
        where: locationValue,
        location: locationValue,
        address: locationValue,
        when: reportData.when || 'N/A',
        why: reportData.why || 'N/A',
        how: reportData.how || reportData.excerpt || 'N/A',
        severity: reportData.severity || 'Katamtaman',
        sector: reportData.sector || 'Sector 1',
        lat: parsedLat,
        lng: parsedLng,
        latitude: parsedLat,
        longitude: parsedLng,
        is_mapped: isMapped,
        isMapped,
        hearingDate: '',
        hearingNote: '',
        hearingCompleted: false,
        outcome: '',
        complainantPhone: reportData.complainantPhone || 'N/A',
        complainantAddress: reportData.complainantAddress || 'N/A',
        complainantGender: reportData.complainantGender || 'N/A',
        complainantAge: reportData.complainantAge || '',
        isMinor: reportData.isMinor || false,
        mapStatus: isMapped ? 'Approved' : 'Pending',
        mappedAt: isMapped ? new Date().toISOString() : null,
        mappedBy: reviewerId,
      }

      setBlotterReports(prev => [newReportItem, ...prev])

      if (isMapped) {
        setIncidents(prev => [{
          ref: refNo,
          id: refNo,
          blotterId: pbData?.[0]?.blotter_id,
          title: titleValue,
          classification: classificationValue,
          severity: reportData.severity || 'Katamtaman',
          excerpt: reportData.how || reportData.excerpt || titleValue,
          location: locationValue,
          address: locationValue,
          dateISO: isoDate,
          lat: parsedLat,
          lng: parsedLng,
          latitude: parsedLat,
          longitude: parsedLng,
          sector: reportData.sector || 'Sector 1',
          mapStatus: 'Approved',
          is_mapped: true,
          isMapped: true,
          filedBy: reportData.filedBy || 'Residente',
          status: reportData.status || 'Sinuri',
        }, ...prev])
      }

      addAuditEntry(`Lumikha ng blotter report ${refNo} (${isMapped ? 'Naka-mapa na' : 'Hindi naka-mapa'})`, { color: 'green' })
      fetchData().catch(() => {})
      return { success: true, ref: refNo }
    } catch (err) {
      console.error('Error in addBlotterReport:', err)
      throw err
    }
  }

  const addIncident = async (incident) => {
    try {
      // If administrator picked an existing blotter report from dropdown in GIS, map that existing report!
      if (incident.existingReportId) {
        return await mapIncidentLocation(incident.existingReportId, {
          lat: incident.lat,
          lng: incident.lng,
          location: incident.location,
          address: incident.location,
        })
      }

      let reviewerId = null
      if (user?.id && users.some((u) => u.id === user.id)) {
        reviewerId = user.id
      }

      const isoDate = incident.dateISO ? new Date(incident.dateISO).toISOString() : new Date().toISOString()
      const classificationValue = incident.classification || incident.title || 'Insidente'
      const titleValue = incident.title || classificationValue
      const isMapped = incident.lat != null && incident.lng != null
      const parsedLat = isMapped ? parseFloat(incident.lat) : null
      const parsedLng = isMapped ? parseFloat(incident.lng) : null

      const [sectorRes, extRes] = await Promise.all([
        supabase
          .from('barangay_sectors')
          .select('sector_id')
          .eq('sector_name', incident.sector || 'Sector 1')
          .maybeSingle(),
        supabase
          .from('ai_extractions')
          .insert([{
            incident_type: classificationValue,
            incident_datetime: isoDate,
            incident_location: incident.location,
            narrative_summary: incident.excerpt,
            json_output: {
              what: titleValue,
              who: 'Unknown',
              where: incident.location,
              when: isoDate,
              why: 'Community hazard requiring barangay inspection and action',
              how: incident.excerpt,
              classification: classificationValue,
              severity: incident.severity || 'Katamtaman',
            }
          }])
          .select()
      ])

      const { data: ext, error: extErr } = extRes
      if (extErr) {
        console.error('Error inserting ai_extractions for incident:', extErr)
        throw new Error(extErr.message || 'Hindi maipasok ang AI extraction record.')
      }

      const sectorId = sectorRes.data?.sector_id || null
      const refNo = incident.ref || `SC-${Math.floor(100000 + Math.random() * 900000)}`
      const mapStatus = isMapped ? 'Approved' : 'Pending'

      const pbPayload = {
        reference_no: refNo,
        extraction_id: ext[0].extraction_id,
        sector_id: sectorId,
        latitude: parsedLat,
        longitude: parsedLng,
        status: 'Sinuri',
        remarks: '',
        map_status: mapStatus,
        is_mapped: isMapped,
        map_reviewed_by: isMapped ? reviewerId : null,
        map_reviewed_at: isMapped ? new Date().toISOString() : null,
        mapped_by: isMapped ? reviewerId : null,
        mapped_at: isMapped ? new Date().toISOString() : null,
      }

      const { data: pbData, error: pbErr } = await supabase
        .from('pre_blotters')
        .insert([pbPayload])
        .select()

      if (pbErr) {
        if (pbErr.message?.includes('is_mapped')) {
          const fbPayload = { ...pbPayload }
          delete fbPayload.is_mapped
          delete fbPayload.mapped_by
          delete fbPayload.mapped_at
          await supabase.from('pre_blotters').insert([fbPayload])
        } else {
          await supabase.from('ai_extractions').delete().eq('extraction_id', ext[0].extraction_id)
          throw new Error(pbErr.message || 'Hindi maipasok ang pre-blotter record.')
        }
      }

      const createdIncident = {
        ref: refNo,
        id: refNo,
        blotterId: pbData?.[0]?.blotter_id,
        title: titleValue,
        classification: classificationValue,
        severity: incident.severity || 'Katamtaman',
        excerpt: incident.excerpt || '',
        location: incident.location,
        address: incident.location,
        dateISO: isoDate,
        lat: parsedLat,
        lng: parsedLng,
        latitude: parsedLat,
        longitude: parsedLng,
        sector: incident.sector || 'Sector 1',
        mapStatus: mapStatus,
        is_mapped: isMapped,
        isMapped,
        mapReviewedBy: isMapped ? reviewerId : null,
        mapReviewedAt: isMapped ? new Date().toISOString() : null,
        filedBy: 'Residente',
        status: 'Sinuri',
      }

      setIncidents((prev) => [createdIncident, ...prev.filter((i) => i.ref !== refNo)])

      // Also add to blotterReports so Digital Blotter is in sync immediately
      const newBlotterItem = {
        id: refNo,
        ref: refNo,
        blotterId: pbData?.[0]?.blotter_id,
        rawDate: isoDate,
        title: titleValue,
        status: 'Sinuri',
        datetime: new Date(isoDate).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }).toUpperCase(),
        filedBy: 'Residente',
        what: titleValue,
        who: 'Hindi Alam',
        where: incident.location,
        location: incident.location,
        address: incident.location,
        when: isoDate,
        why: 'N/A',
        how: incident.excerpt || '',
        severity: incident.severity || 'Katamtaman',
        sector: incident.sector || 'Sector 1',
        lat: parsedLat,
        lng: parsedLng,
        latitude: parsedLat,
        longitude: parsedLng,
        is_mapped: isMapped,
        isMapped,
        mapStatus: mapStatus,
        hearingDate: '',
        hearingNote: '',
        hearingCompleted: false,
        outcome: '',
        complainantPhone: 'N/A',
        complainantAddress: incident.location || 'N/A',
        complainantGender: 'N/A',
        complainantAge: '',
        isMinor: false,
      }
      setBlotterReports((prev) => [newBlotterItem, ...prev.filter((b) => b.id !== refNo)])

      addAuditEntry(`Nagdagdag ng insidente ${refNo} (${isMapped ? 'Naka-mapa na' : 'Hindi naka-mapa'})`, { color: 'blue' })
      fetchData().catch((e) => console.error('Background sync error:', e))

      return { success: true, data: createdIncident }
    } catch (err) {
      console.error('Error adding incident:', err)
      throw err
    }
  }

  const setIncidentMapStatus = async (ref, status) => {
    try {
      const isApproved = status === 'Approved'
      if (!isApproved) {
        return await unmapIncidentLocation(ref)
      }

      const existingIncident = incidents.find(i => i.ref === ref || i.id === ref)
      if (existingIncident?.lat != null && existingIncident?.lng != null) {
        return await mapIncidentLocation(ref, {
          lat: existingIncident.lat,
          lng: existingIncident.lng,
          location: existingIncident.location,
        })
      }
    } catch (err) {
      console.error('Error updating incident map status:', err)
    }
  }

  const deleteIncident = async (ref) => {
    try {
      const existing = blotterReports.find(b => b.id === ref || b.ref === ref) || incidents.find(i => i.ref === ref || i.id === ref)
      if (existing && existing.status !== 'Sinuri' && existing.status !== 'Under Review') {
        console.warn(`Hindi maaaring burahin ang opisyal na blotter record ${ref}.`)
        return
      }

      const { data: pb } = await supabase
        .from('pre_blotters')
        .select('blotter_id, extraction_id')
        .eq('reference_no', ref)
        .maybeSingle()

      if (pb) {
        await supabase.from('pre_blotters').delete().eq('blotter_id', pb.blotter_id)
        if (pb.extraction_id) {
          await supabase.from('ai_extractions').delete().eq('extraction_id', pb.extraction_id)
        }
      }

      setIncidents((prev) => prev.filter((i) => i.ref !== ref))
      setBlotterReports((prev) => prev.filter((b) => b.id !== ref && b.ref !== ref))

      fetchData()
    } catch (err) {
      console.error('Error deleting incident:', err)
    }
  }

  const replaceIncident = async (ref, record) => {
    try {
      const { data: pb } = await supabase
        .from('pre_blotters')
        .select('blotter_id, extraction_id, ai_extractions(json_output)')
        .eq('reference_no', ref)
        .maybeSingle()

      if (!pb) return

      const existingJson = pb.ai_extractions?.json_output || {}
      const isoDate = record.dateISO ? new Date(record.dateISO).toISOString() : new Date().toISOString()
      const classificationValue = record.classification || record.title || 'Insidente'
      const titleValue = record.title || classificationValue

      const isMapped = record.lat != null && record.lng != null
      const parsedLat = isMapped ? parseFloat(record.lat) : null
      const parsedLng = isMapped ? parseFloat(record.lng) : null

      const updatedJson = {
        ...existingJson,
        what: titleValue,
        where: record.location,
        when: isoDate,
        how: record.excerpt,
        classification: classificationValue,
        severity: record.severity || existingJson.severity || 'Katamtaman',
      }

      await supabase
        .from('ai_extractions')
        .update({
          incident_type: classificationValue,
          incident_location: record.location,
          narrative_summary: record.excerpt,
          incident_datetime: isoDate,
          json_output: updatedJson,
        })
        .eq('extraction_id', pb.extraction_id)

      const pbUpdate = {
        latitude: parsedLat,
        longitude: parsedLng,
        is_mapped: isMapped,
        map_status: isMapped ? 'Approved' : 'Pending',
      }

      const { error: pbErr } = await supabase.from('pre_blotters').update(pbUpdate).eq('blotter_id', pb.blotter_id)
      if (pbErr && pbErr.message?.includes('is_mapped')) {
        await supabase.from('pre_blotters').update({
          latitude: parsedLat,
          longitude: parsedLng,
          map_status: isMapped ? 'Approved' : 'Pending',
        }).eq('blotter_id', pb.blotter_id)
      }

      setIncidents((prev) =>
        prev.map((i) =>
          i.ref === ref
            ? {
                ...i,
                ...record,
                title: titleValue,
                classification: classificationValue,
                severity: record.severity || i.severity,
                dateISO: isoDate,
                lat: parsedLat,
                lng: parsedLng,
                latitude: parsedLat,
                longitude: parsedLng,
                is_mapped: isMapped,
                isMapped,
                mapStatus: isMapped ? 'Approved' : 'Pending',
              }
            : i
        )
      )

      setBlotterReports((prev) =>
        prev.map((b) =>
          b.id === ref || b.ref === ref
            ? {
                ...b,
                title: titleValue,
                what: titleValue,
                where: record.location,
                location: record.location,
                address: record.location,
                how: record.excerpt,
                lat: parsedLat,
                lng: parsedLng,
                latitude: parsedLat,
                longitude: parsedLng,
                is_mapped: isMapped,
                isMapped,
                mapStatus: isMapped ? 'Approved' : 'Pending',
              }
            : b
        )
      )

      addAuditEntry(`Na-update ang insidente ${ref}`, { color: 'blue' })
      fetchData().catch((e) => console.error('Background sync error:', e))
      return { success: true }
    } catch (err) {
      console.error('Error replacing incident:', err)
      throw err
    }
  }

  const updateBlotterReport = async (id, patch) => {
    try {
      const existingReport = blotterReports.find(r => r.id === id)

      if (patch.status) {
        setBlotterReports((prev) =>
          prev.map((b) => (b.id === id || b.ref === id ? { ...b, ...patch } : b))
        )
        setIncidents((prev) =>
          prev.map((i) => (i.ref === id || i.id === id ? { ...i, status: patch.status } : i))
        )
      }

      if (existingReport?.isFormReport || id.startsWith('REP-')) {
        const updateFields = {}
        if (patch.status) {
          let residentStatus = 'Under Review'
          if (patch.status === 'Sinuri') residentStatus = 'Under Review'
          else if (patch.status === 'Inimbestigahan') residentStatus = 'Investigating'
          else if (patch.status === 'Nareselba') residentStatus = 'Resolved'
          else if (patch.status === 'Spam') residentStatus = 'Spam'
          else residentStatus = patch.status
          updateFields.status = residentStatus
        }
        if (patch.hearingDate !== undefined) updateFields.hearing_date = patch.hearingDate || null
        if (patch.hearingNote !== undefined) updateFields.hearing_note = patch.hearingNote
        if (patch.hearingCompleted !== undefined) updateFields.hearing_completed = patch.hearingCompleted
        if (patch.outcome !== undefined) updateFields.outcome = patch.outcome

        const dbTarget = existingReport?.dbId || id
        const isUuid = typeof dbTarget === 'string' && dbTarget.includes('-') && dbTarget.length > 20

        if (isUuid) {
          await supabase.from('reports').update(updateFields).eq('id', dbTarget)
        } else {
          await supabase.from('reports').update(updateFields).eq('reference_no', id)
        }
      } else {
        const { data: pb } = await supabase
          .from('pre_blotters')
          .select('blotter_id, extraction_id')
          .eq('reference_no', id)
          .single()

        if (!pb) return

        let pbPatch = {}
        if (patch.status) pbPatch.status = patch.status
        if (patch.hearingDate !== undefined) pbPatch.hearing_date = patch.hearingDate || null
        if (patch.hearingNote !== undefined) pbPatch.hearing_note = patch.hearingNote
        if (patch.hearingCompleted !== undefined) pbPatch.hearing_completed = patch.hearingCompleted
        if (patch.outcome !== undefined) pbPatch.outcome = patch.outcome
        if (patch.remarks !== undefined) pbPatch.remarks = patch.remarks

        await supabase
          .from('pre_blotters')
          .update(pbPatch)
          .eq('blotter_id', pb.blotter_id)
      }
      fetchData()
    } catch (err) {
      console.error('Error updating blotter report:', err)
    }
  }

  const addDocument = async (doc) => {
    const newDocItem = {
      id: doc.id || Date.now(),
      title: doc.title,
      ordinanceNo: doc.ordinanceNo || '',
      category: doc.category || doc.type || 'Lokal na Ordinansa',
      dateUploaded: doc.dateUploaded || new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      fileFormat: doc.fileFormat || (doc.title.endsWith('.docx') ? 'DOCX' : 'PDF'),
      fileSize: doc.fileSize || '1.2 MB',
      isMachineReadable: doc.isMachineReadable ?? true,
      chunkCount: doc.chunkCount || 10,
      status: doc.status || 'Indexing',
      officialStatus: doc.officialStatus || 'Naghihintay ng Pag-apruba',
      summary: doc.summary || '',
      sections: doc.sections || [],
      isActive: true,
    }

    setDocuments((prev) => [newDocItem, ...prev.filter((d) => d.title !== doc.title)])

    try {
      await supabase
        .from('documents')
        .insert([{
          title: doc.title,
          document_type: doc.category || doc.type || 'Lokal na Ordinansa',
          ordinance_no: doc.ordinanceNo || null,
          file_path: `/uploads/${doc.title}`,
          file_format: newDocItem.fileFormat,
          file_size: newDocItem.fileSize,
          is_machine_readable: newDocItem.isMachineReadable,
          chunk_count: newDocItem.chunkCount,
          vector_status: doc.status === 'Fully Indexed' ? 'Fully Indexed' : 'Indexing',
          summary: doc.summary || '',
          sections: doc.sections || [],
          approval_status: doc.officialStatus === 'Opisyal' ? 'Approved' : 'Pending',
          is_active: true,
        }])

      fetchData()
    } catch (err) {
      console.error('Error adding document:', err)
    }
  }

  const updateDocument = async (identifier, patch) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.title === identifier || d.id === identifier) {
          return { ...d, ...patch }
        }
        return d
      })
    )

    try {
      const docPatch = {}
      if (patch.officialStatus !== undefined) {
        docPatch.approval_status =
          patch.officialStatus === 'Opisyal'
            ? 'Approved'
            : patch.officialStatus === 'Naka-retire'
            ? 'Retired'
            : 'Pending'

        if (patch.officialStatus === 'Opisyal') {
          docPatch.approved_at = new Date().toISOString()
          docPatch.approved_by = user?.id || null
          docPatch.is_active = true
        }
      }

      if (patch.status !== undefined) {
        if (patch.status === 'Retired') {
          docPatch.is_active = false
          docPatch.approval_status = 'Retired'
        } else {
          docPatch.vector_status = patch.status
        }
      }

      if (patch.title !== undefined) docPatch.title = patch.title
      if (patch.category !== undefined) docPatch.document_type = patch.category
      if (patch.ordinanceNo !== undefined) docPatch.ordinance_no = patch.ordinanceNo
      if (patch.summary !== undefined) docPatch.summary = patch.summary

      const query = supabase.from('documents').update(docPatch)
      if (identifier && !isNaN(Number(identifier))) {
        await query.eq('document_id', Number(identifier))
      } else {
        await query.eq('title', String(identifier))
      }

      await fetchData()
    } catch (err) {
      console.error('Error updating document:', err)
    }
  }

  const deleteDocument = async (identifier, optionalTitle) => {
    setDocuments((prev) =>
      prev.filter(
        (d) =>
          d.id !== identifier &&
          (typeof identifier !== 'number' || Number(d.id) !== identifier) &&
          d.title !== identifier &&
          (!optionalTitle || d.title !== optionalTitle)
      )
    )

    try {
      if (identifier && !isNaN(Number(identifier))) {
        await supabase.from('documents').delete().eq('document_id', Number(identifier))
      }
      const titleToDelete = optionalTitle || (typeof identifier === 'string' && isNaN(Number(identifier)) ? identifier : null)
      if (titleToDelete) {
        await supabase.from('documents').delete().eq('title', titleToDelete)
      }

      await fetchData()
    } catch (err) {
      console.error('Error deleting document:', err)
    }
  }

  const addAlert = async (entry) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('notifications')
        .insert([{
          sent_by: authUser?.id || null,
          title: `[${entry.target} | ${entry.level}] ${entry.title}`,
          message: entry.message,
          notification_type: entry.type,
          is_read: false
        }])
      
      if (!error) {
        await fetchData()
      } else {
        console.error('Error inserting notification:', error)
      }
    } catch (err) {
      console.error('Error adding alert:', err)
    }
  }

  const deleteAlert = async (id) => {
    try {
      setAlertHistory((prev) => prev.filter((a) => String(a.id) !== String(id)))

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
      
      if (!error) {
        await fetchData()
        return { success: true }
      } else {
        console.error('Error deleting notification:', error)
        await fetchData()
        return { success: false, error }
      }
    } catch (err) {
      console.error('Error deleting alert:', err)
      await fetchData()
      return { success: false, error: err }
    }
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
        setIncidentMapStatus,
        deleteIncident,
        mapIncidentLocation,
        unmapIncidentLocation,
        blotterReports,
        addBlotterReport,
        updateBlotterReport,
        documents,
        addDocument,
        updateDocument,
        deleteDocument,
        alertHistory,
        addAlert,
        deleteAlert,
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

export function mapSupabaseToBlotterReport(row) {
  const complainant = Array.isArray(row.complainant_details) && row.complainant_details.length > 0
    ? row.complainant_details[0]
    : (row.complainant_details || {})

  const respondentNames = Array.isArray(row.respondent_details) && row.respondent_details.length > 0
    ? row.respondent_details.map((r) => r.full_name || r.name).filter(Boolean).join(', ')
    : 'Hindi Alam'

  return {
    id: row.reference_no || `SC-${row.blotter_id}`,
    title: row.incident_type || 'Unspecified Incident',
    status: row.status || 'Sinuri',
    datetime: row.submitted_at
      ? new Date(row.submitted_at).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'N/A',

    filedBy: complainant.full_name || complainant.name || 'Anonymous',
    complainantPhone: complainant.contact_number || complainant.phone || 'N/A',
    complainantGender: complainant.gender || 'N/A',
    complainantAge: complainant.age || null,
    complainantAddress: complainant.address || row.location_address || 'N/A',
    isMinor: complainant.age ? complainant.age < 18 : false,

    what: row.incident_type || 'Unspecified Incident',
    who: respondentNames || 'Hindi Alam',
    where: row.location_address || 'N/A',
    when: row.submitted_at
      ? new Date(row.submitted_at).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'N/A',
    why: row.motive_cause || 'N/A',
    how: row.modus_operandi || 'N/A',

    actionTaken: row.action_taken || '',
    hearingDate: row.hearing_date || '',
    hearingNote: row.hearing_note || '',
    hearingCompleted: row.hearing_completed || false,
    outcome: row.outcome || '',
  }
}