import { parseDocumentSections } from '../src/utils/pdfExtractor.js'

const text = `BARANGAY HEALTH AND SANITATION COMMITTEE
Opisyal na Alituntunin sa Inter-Purok "Tapat Ko, Linis Ko" Cleanliness Drive 2026

MGA KWALIPIKASYON SA PAGSALI:
Ang kompetisyon ay bukas sa lahat ng pito (7) na purok sa ating barangay. Bawat purok ay awtomatikong magiging kalahok at pamumunuan ng kanilang Purok Leader kasama ang mga residenteng may-ari ng bahay at nangungupahan.

ISKEDYUL AT LOKASYON NG INSPEKSYON:
Magsasagawa ng unannounced inspections ang mga evaluator tuwing Martes at Huwebes mula 8:00 AM hanggang 12:00 PM sa mga pangunahing kalye, eskinita, at drainage canal ng bawat purok. Ang opisyal na pagsisimula ng programa ay sa Oktubre 12, 2026, at magtatapos sa Nobyembre 20, 2026.

PREMYO PARA SA MGA MANANALO:
Kampeon (Most Clean & Green Purok): ₱20,000 pondong pangkabuhayan, plake ng pagkilala, at libreng solar streetlights para sa purok.
Pangalawang Puwesto (1st Runner-up): ₱10,000 pondong pangkabuhayan at plake ng pagkilala.
Ikatlong Puwesto (2nd Runner-up): ₱5,000 pondong pangkabuhayan at sertipiko.
Best Waste Segregation Effort: Espesyal na sertipiko at ₱2,500 cash incentive para sa purok council.

MGA REQUISITOS AT CRITERIA SA PAGSUSURI:
Kailangang magtalaga ang bawat purok ng isang Barangay Ecological Coordinator at magpakita ng aktibong Materials Recovery Facility (MRF) corner. Ang pamantayan ay binubuo ng: Wastong Pagtatapon ng Basura at Segregation (40%), Kalinisan ng Kanal at Walang Nakatambak na Tubig (30%), Urban Greening o Pagtatanim (20%), at Partisipasyon ng Komunidad (10%). Ang deadline para sa pinal na pagsusumite ng Purok Roster ng mga volunteer ay sa Oktubre 7, 2026 sa Tanggapan ng Barangay Sanitation Officer.`

const sections = parseDocumentSections(text, 'Tapat Ko Linis Ko')
console.log('PARSED SECTIONS:', JSON.stringify(sections, null, 2))
