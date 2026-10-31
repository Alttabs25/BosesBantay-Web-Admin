import json
import sys
import unittest
from types import SimpleNamespace
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'services/document-admin'))
from concise_response import render_claims
class ClaimsTests(unittest.TestCase):
 def test_source_markers_are_built_for_each_sentence(self):
  raw=json.dumps({'kind':'answer','claims':[{'text':'First fact. Second fact.','source_ids':['chunk-9']}],'related_questions':[],'conflicts':[]})
  result=json.loads(render_claims(raw,[SimpleNamespace(source_id='chunk-9',number=2)],'tagalog'))
  self.assertEqual(result['answer'],'First fact. [2] Second fact. [2]')
 def test_unknown_source_is_rejected(self):
  raw=json.dumps({'kind':'answer','claims':[{'text':'Fact','source_ids':['fake']}],'related_questions':[],'conflicts':[]})
  with self.assertRaises(ValueError):render_claims(raw,[],'english')
if __name__=='__main__':unittest.main()
