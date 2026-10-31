import { useId, useState } from 'react'
import Modal from './Modal'
import { SlidersHorizontal } from 'lucide-react'
import './FilterPopup.css'

export default function FilterPopup({ title = 'Filters', children, count, onReset, open, onClose, trigger = true, resultNoun = 'results', actionLabel, maxWidth = 'max-w-lg', description, activeCount = 0 }) {
  const [localOpen, setLocalOpen] = useState(false)
  const visible = open ?? localOpen
  const close = () => { setLocalOpen(false); onClose?.() }
  const sectionId = useId()
  return <>
    {trigger && <button type="button" className="shared-filter-trigger" data-active={activeCount>0?true:undefined} onClick={() => setLocalOpen(true)} aria-haspopup="dialog" aria-expanded={visible} aria-controls={sectionId}><SlidersHorizontal size={15} aria-hidden="true"/>Filters{activeCount>0&&<span className="shared-filter-count" aria-label={`${activeCount} active filters`}>{activeCount}</span>}</button>}
    <Modal open={visible} onClose={close} title={title} maxWidth={maxWidth}>
      <div className="shared-filter-popup" role="dialog" aria-modal="true" aria-label={title}>
        {description && <p className="shared-filter-description">{description}</p>}
        <div id={sectionId} className="shared-filter-fields">{children}</div>
        <footer>{onReset && <button type="button" className="shared-filter-reset" onClick={onReset}>Clear filters</button>}<button type="button" className="shared-filter-view" onClick={close}>{actionLabel || (count == null ? 'Done' : `View ${count} ${resultNoun}`)}</button></footer>
      </div>
    </Modal>
  </>
}
