const normalize = value => String(value || '').trim().toLowerCase().replace(/[ -]+/g, '_')

export function isServiceComplaint(report) {
  return report?.sourceTable === 'service_complaints' ||
    normalize(report?.reportType) === 'service_complaint' ||
    normalize(report?.intakeDetails?.type) === 'service_complaint'
}

export function isBlotterReport(report) {
  // Service metadata always wins over a conflicting legacy blotter flag.
  if (!report || isServiceComplaint(report)) return false
  return normalize(report.reportType) === 'blotter' ||
    normalize(report.intakeDetails?.type) === 'blotter' ||
    report.sourceTable === 'pre_blotters'
}
