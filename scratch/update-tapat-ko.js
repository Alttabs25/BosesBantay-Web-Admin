import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://biaqsosjorxklbtptdqy.supabase.co'
const supabaseAnonKey = 'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function updateDoc() {
  const summary = 'Opisyal na Alituntunin sa Inter-Purok "Tapat Ko, Linis Ko" Cleanliness Drive 2026. Ang kompetisyon ay bukas sa lahat ng 7 purok. Unannounced inspections tuwing Martes at Huwebes 8:00 AM - 12:00 PM sa mga kalye, eskinita, at drainage canal. Kampeon premyo: ₱20,000 pondong pangkabuhayan, plake, at solar streetlights.'
  
  const sections = [
    {
      title: 'Seksyon 1: Pamagat at Mga Kwalipikasyon sa Pagsali',
      content: 'Ang kompetisyon ay bukas sa lahat ng pito (7) na purok sa ating barangay. Bawat purok ay awtomatikong magiging kalahok at pamumunuan ng kanilang Purok Leader kasama ang mga residenteng may-ari ng bahay at nangungupahan.'
    },
    {
      title: 'Seksyon 2: Iskedyul at Lokasyon ng Inspeksyon',
      content: 'Magsasagawa ng unannounced inspections ang mga evaluator tuwing Martes at Huwebes mula 8:00 AM hanggang 12:00 PM sa mga pangunahing kalye, eskinita, at drainage canal ng bawat purok. Ang opisyal na pagsisimula ng programa ay sa Oktubre 12, 2026, at magtatapos sa Nobyembre 20, 2026.'
    },
    {
      title: 'Seksyon 3: Premyo Para sa mga Mananalo',
      content: 'Kampeon (Most Clean & Green Purok): ₱20,000 pondong pangkabuhayan, plake ng pagkilala, at libreng solar streetlights para sa purok. Pangalawang Puwesto (1st Runner-up): ₱10,000 pondong pangkabuhayan at plake ng pagkilala. Ikatlong Puwesto (2nd Runner-up): ₱5,000 pondong pangkabuhayan at sertipiko. Best Waste Segregation Effort: Espesyal na sertipiko at ₱2,500 cash incentive para sa purok council.'
    },
    {
      title: 'Seksyon 4: Mga Requisitos at Criteria sa Pagsusuri',
      content: 'Kailangang magtalaga ang bawat purok ng isang Barangay Ecological Coordinator at magpakita ng aktibong Materials Recovery Facility (MRF) corner. Ang pamantayan ay binubuo ng: Wastong Pagtatapon ng Basura at Segregation (40%), Kalinisan ng Kanal at Walang Nakatambak na Tubig (30%), Urban Greening o Pagtatanim (20%), at Partisipasyon ng Komunidad (10%). Ang deadline para sa pinal na pagsusumite ng Purok Roster ng mga volunteer ay sa Oktubre 7, 2026 sa Tanggapan ng Barangay Sanitation Officer.'
    }
  ]

  const { data, error } = await supabase
    .from('documents')
    .update({
      summary,
      sections,
      approval_status: 'Approved',
      vector_status: 'Fully Indexed',
      is_active: true
    })
    .eq('title', 'TESTING BOT 2.pdf')
    .select()

  if (error) {
    console.error('Update error:', error)
  } else {
    console.log('SUCCESSFULLY UPDATED TESTING BOT 2.pdf:', JSON.stringify(data, null, 2))
  }
}

updateDoc()
