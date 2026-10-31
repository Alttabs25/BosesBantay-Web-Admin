import os,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,os.environ.get('RAG_TEST_ROOT',str(Path.home()/'Downloads'/'BOSES BANTAY'/'boses-bantay-mobile'/'services'/'chatbot'/'rag-bot')))
from ingest import prepare_rows,IngestFailure
class MetadataTests(unittest.TestCase):
 def test_details_saved_without_changing_source_page_contract(self):
  with tempfile.TemporaryDirectory() as directory:
   source=Path(directory)/'official.txt';source.write_text('A documented procedure. '*100,encoding='utf-8')
   rows=prepare_rows(source,document_metadata={'document_title':'Clearance guide','document_type':'Citizens Charter / Clearance Requirements','reference_number':'2026-003','summary':'Requirements and steps.'})
   self.assertTrue(rows)
   for row in rows:
    self.assertEqual(row['metadata']['source'],'official.txt')
    self.assertEqual(row['metadata']['document_title'],'Clearance guide')
    self.assertNotIn('page',row['metadata'])
 def test_untrusted_metadata_cannot_override_source_or_activation(self):
  for metadata in [{'source':'fake.pdf'},{'page':8},{'active':False},{'document_title':3},{'summary':'x'*1001}]:
   with self.assertRaises(IngestFailure):prepare_rows(Path('unused.txt'),document_metadata=metadata)
if __name__=='__main__':unittest.main()
