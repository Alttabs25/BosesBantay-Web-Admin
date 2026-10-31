import { createDocumentCache } from './documentCache'
import { documentRequest } from './documentAdmin'

// Shared across navigation; document mutations explicitly refresh this store.
export const documentCache = createDocumentCache(documentRequest)
