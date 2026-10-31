import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('document_admin', Path(__file__).parents[1] / 'services' / 'document-admin' / 'server.py')
admin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(admin)

class LibraryTests(unittest.TestCase):
    def test_real_counts_and_active_state(self):
        rows = [{'metadata': {'source': 'guide.pdf', 'page': 2, 'active': True, 'embedding_model': 'nomic-embed-text'}}, {'metadata': {'source': 'guide.pdf', 'page': 2, 'active': False}}, {'metadata': {'source': 'guide.pdf', 'page': 5}}, {'metadata': {'source': 'faq.txt', 'active': False}}]
        result = admin.summarize(rows)
        self.assertEqual(result[0]['filename'], 'faq.txt')
        self.assertEqual(result[0]['activeChunks'], 0)
        self.assertEqual(result[1]['chunks'], 3)
        self.assertEqual(result[1]['activeChunks'], 2)
        self.assertEqual(result[1]['pages'], [2, 5])
    def test_missing_filename_is_not_fabricated(self):
        self.assertEqual(admin.summarize([{'metadata': {}}])[0]['filename'], '(missing filename)')
    def test_empty_library(self):
        self.assertEqual(admin.summarize([]), [])
    def test_listing_paginates_and_preserves_source_filter(self):
        class Fake:
            def __init__(self): self.offset = 0; self.sources = []
            def table(self, value): return self
            def select(self, value): return self
            def order(self, value): return self
            def eq(self, key, value): self.sources.append((key, value)); return self
            def range(self, first, last): self.offset = first; return self
            def execute(self): return type('Result', (), {'data': [{'id': i} for i in range(self.offset, min(self.offset + 500, 740))]})()
        fake = Fake()
        self.assertEqual(len(admin.source_rows(fake, 'rag_documents', 'guide.pdf')), 740)
        self.assertEqual(fake.sources, [('metadata->>source', 'guide.pdf')] * 2)

if __name__ == '__main__': unittest.main()
