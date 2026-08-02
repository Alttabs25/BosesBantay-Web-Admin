import { useState } from 'react'
import {
  Phone,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Eye,
  EyeOff
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import Pill from '../components/Pill'

export default function EmergencyDirectory() {
  const { user } = useAuth()
  const {
    emergencyContacts,
    addEmergencyContact,
    updateEmergencyContact,
    deleteEmergencyContact,
    addAuditEntry
  } = useData()
  const { showToast } = useToast()

  // Role Checks
  const isCaptain = user?.role === 'Barangay Captain'
  const isAdmin = user?.role === 'System Administrator'

  // Modal / Dialog States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  // Form State
  const [formData, setFormData] = useState({
    agencyName: '',
    contactPerson: '',
    phoneNumber: '',
    category: 'Emergency',
    isActive: true
  })

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingContact(null)
    setFormData({
      agencyName: '',
      contactPerson: '',
      phoneNumber: '',
      category: 'Emergency',
      isActive: true
    })
    setIsModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (contact) => {
    setEditingContact(contact)
    setFormData({
      agencyName: contact.agencyName,
      contactPerson: contact.contactPerson,
      phoneNumber: contact.phoneNumber,
      category: contact.category,
      isActive: contact.isActive
    })
    setIsModalOpen(true)
  }

  // Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.agencyName.trim() || !formData.phoneNumber.trim()) {
      showToast('Kailangang ilagay ang Pangalan ng Ahensya at Numero.', 'error')
      return
    }

    if (editingContact) {
      // Update
      await updateEmergencyContact(editingContact.id, formData)
      addAuditEntry(`In-edit ang emergency contact: ${formData.agencyName}`, { color: 'blue' })
      showToast('Matagumpay na na-update ang contact.')
    } else {
      // Add
      await addEmergencyContact(formData)
      addAuditEntry(`Nagdagdag ng emergency contact: ${formData.agencyName}`, { color: 'green' })
      showToast('Matagumpay na naidagdag ang contact.')
    }
    setIsModalOpen(false)
  }

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingId) return
    const target = emergencyContacts.find(c => c.id === deletingId)
    await deleteEmergencyContact(deletingId)
    addAuditEntry(`Tinanggal ang emergency contact: ${target?.agencyName || deletingId}`, { color: 'red' })
    showToast('Matagumpay na tinanggal ang contact.')
    setDeletingId(null)
  }

  // Captain Authorization Toggle
  const handleTogglePublish = async (contact) => {
    const nextActive = !contact.isActive
    await updateEmergencyContact(contact.id, { isActive: nextActive })
    const actionText = nextActive ? 'In-authorize / Inilathala' : 'Inalis ang paglathala sa'
    addAuditEntry(`${actionText} ang emergency contact: ${contact.agencyName}`, { color: nextActive ? 'green' : 'orange' })
    showToast(`${contact.agencyName} ay ${nextActive ? 'inilathala na sa mga residente.' : 'inilipat sa draft.'}`)
  }

  // Group contacts by category
  const emergencies = emergencyContacts.filter(c => c.category === 'Emergency')
  const services = emergencyContacts.filter(c => c.category === 'Barangay Services')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Emergency Directory
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Direktoryo ng mga emergency hotlines at opisyal na contact ng Barangay.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98]"
          >
            <Plus size={16} />
            Magdagdag ng Contact
          </button>
        )}
      </div>

      {/* Emergency Section */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Emergency Hotlines
        </h2>
        {emergencies.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Walang nakarehistrong emergency contact.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {emergencies.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                isAdmin={isAdmin}
                isCaptain={isCaptain}
                onEdit={handleOpenEdit}
                onDelete={setDeletingId}
                onTogglePublish={handleTogglePublish}
                themeColor="red"
              />
            ))}
          </div>
        )}
      </div>

      {/* Barangay Services Section */}
      <div className="space-y-4 pt-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Barangay Services
        </h2>
        {services.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Walang nakarehistrong serbisyo ng Barangay.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                isAdmin={isAdmin}
                isCaptain={isCaptain}
                onEdit={handleOpenEdit}
                onDelete={setDeletingId}
                onTogglePublish={handleTogglePublish}
                themeColor="blue"
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingContact ? 'I-edit ang Contact' : 'Magdagdag ng Emergency Contact'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Pangalan ng Ahensya / Desk</span>
            <input
              type="text"
              required
              placeholder="Hal. BFP Milagrosa, Barangay Health Center"
              value={formData.agencyName}
              onChange={(e) => setFormData(f => ({ ...f, agencyName: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Deskripsyon / Tao na Kakausapin</span>
            <input
              type="text"
              placeholder="Hal. Fire emergency, Medical assistance"
              value={formData.contactPerson}
              onChange={(e) => setFormData(f => ({ ...f, contactPerson: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Numero ng Telepono</span>
            <input
              type="text"
              required
              placeholder="Hal. 0912-345-6789 o 8911-5966"
              value={formData.phoneNumber}
              onChange={(e) => setFormData(f => ({ ...f, phoneNumber: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Kategorya</span>
            <select
              value={formData.category}
              onChange={(e) => setFormData(f => ({ ...f, category: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            >
              <option value="Emergency">Emergency Hotline</option>
              <option value="Barangay Services">Barangay Service</option>
            </select>
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark py-2.5 font-semibold text-white transition-all active:scale-[0.98]"
          >
            Isumite
          </button>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        title="Burahin ang Contact"
        message="Sigurado ka bang gusto mong burahin ang contact na ito mula sa direktoryo? Permanenteng mawawala ito sa database."
        confirmLabel="Burahin"
      />
    </div>
  )
}

function ContactCard({
  contact,
  isAdmin,
  isCaptain,
  onEdit,
  onDelete,
  onTogglePublish,
  themeColor
}) {
  const iconBg = themeColor === 'red' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'
  const buttonBg = themeColor === 'red' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
            <Phone size={20} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 leading-snug">{contact.agencyName}</h3>
            {contact.contactPerson && (
              <p className="text-xs text-gray-500 mt-0.5">{contact.contactPerson}</p>
            )}
          </div>
        </div>

        {/* Action icons for Admin */}
        {isAdmin && (
          <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(contact)}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title="I-edit"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => onDelete(contact.id)}
              className="rounded-md p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
              title="Burahin"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <div>
          <span className="text-xs text-gray-400 block">Numero</span>
          <span className="text-sm font-bold text-gray-800 tracking-wide">{contact.phoneNumber}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Active / Publish badge */}
          <Pill color={contact.isActive ? 'green' : 'orange'} solid={false}>
            {contact.isActive ? 'Published' : 'Draft'}
          </Pill>

          {/* Captain Publish Toggle */}
          {isCaptain && (
            <button
              onClick={() => onTogglePublish(contact)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-xs border transition-all active:scale-95 ${
                contact.isActive
                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
              }`}
              title={contact.isActive ? 'Ibalik sa Draft' : 'I-publish sa mga Residente'}
            >
              {contact.isActive ? <EyeOff size={12} /> : <Eye size={12} />}
              {contact.isActive ? 'Hide' : 'Publish'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
