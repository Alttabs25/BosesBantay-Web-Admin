export const ALL_CLASSIFICATIONS = 'Lahat ng Klasipikasyon'

export const SECTORS = ['Sector 1', 'Sector 2', 'Sector 3']

export const TIME_INTERVALS = [
  'Anumang Oras',
  'Umaga (6AM - 12PM)',
  'Hapon (12PM - 6PM)',
  'Gabi (6PM - 12AM)',
  'Madaling Araw (12AM - 6AM)',
]

export const SEVERITY_FILTERS = ['Lahat ng Kalubhaan', 'Mataas', 'Katamtaman', 'Mababa']

export const SEVERITY_META = {
  Mataas: { color: '#eb5757', label: 'High' },
  Katamtaman: { color: '#f2994a', label: 'Medium' },
  Mababa: { color: '#27ae60', label: 'Low' },
}

export const MOCK_INCIDENTS = [
  {
    ref: 'REF-2026-9041',
    title: 'Public Dispute',
    classification: 'Public Dispute',
    severity: 'Katamtaman',
    excerpt:
      'Paglabag sa curfew ng may matataas na desibel na makatas na reklamo sa musika mula sa block.',
    location: 'Rizal St. Ext., Quezon City, Metro Manila',
    dateISO: '2026-05-25T23:45',
    lat: 14.6768,
    lng: 121.0453,
    sector: 'Sector 1',
  },
  {
    ref: 'REF-2026-9042',
    title: 'Vandalism',
    classification: 'Vandalism',
    severity: 'Mababa',
    excerpt: 'Naiulat na graffiti sa pader ng barangay hall, walang saksi na nakita.',
    location: 'P. Tuazon Blvd., Quezon City, Metro Manila',
    dateISO: '2026-05-24T15:10',
    lat: 14.6742,
    lng: 121.0479,
    sector: 'Sector 2',
  },
  {
    ref: 'REF-2026-9043',
    title: 'Ingay',
    classification: 'Ingay',
    severity: 'Mataas',
    excerpt: 'Malakas na videoke hanggang madaling araw, umabot sa dalawang reklamo.',
    location: 'Kamias Rd., Quezon City, Metro Manila',
    dateISO: '2026-05-23T01:20',
    lat: 14.6789,
    lng: 121.0418,
    sector: 'Sector 3',
  },
]
