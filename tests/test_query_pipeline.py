import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).parents[1]/'services/document-admin'))
from retrieval_pipeline import normalize_message,query_variants,rank_passages
class QueryTests(unittest.TestCase):
 def test_shorthand_and_identifiers(self):
  self.assertEqual(normalize_message('pano mgkano Form 137 RA 7160 KC'), 'paano magkano Form 137 RA 7160 KC')
 def test_bilingual_variants(self):
  variants=query_variants('maingay d2 anu pde gawin')
  self.assertEqual(len(variants),2)
  self.assertIn('noise disturbance',variants[1]);self.assertIn('ingay',variants[1])
 def test_no_unknown_translation(self):
  self.assertEqual(query_variants('XYZ-123 document'),['XYZ-123 document'])
 def test_fusion_dedup_and_limit(self):
  a=SimpleNamespace(source_id='a',content='noise complaint')
  b=SimpleNamespace(source_id='b',content='other text')
  result=rank_passages([[a,b],[a]],'maingay',2)
  self.assertEqual([p.source_id for p in result],['a','b'])
if __name__=='__main__':unittest.main()
