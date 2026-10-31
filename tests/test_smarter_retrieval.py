import sys
import unittest
from unittest.mock import MagicMock,patch
sys.path.insert(0,r'C:\Users\Paul Braganza\Downloads\BOSES BANTAY\boses-bantay-mobile\services\chatbot\rag-bot')
from chat import fuse_candidates,stream_answer,Passage
from session_chat import recent_evidence
class SmarterTests(unittest.TestCase):
 def test_fusion_rewards_agreement_and_removes_duplicates(self):
  rows=[{'id':i,'similarity':.8} for i in [1,2,3]]
  self.assertEqual([r['id'] for r in fuse_candidates(rows,[rows[1]],.3)],[2,1,3])
 def test_memory_separates_sessions_and_resets(self):
  recent_evidence('one','a',['chunk-1'])
  self.assertEqual(recent_evidence('one','a'),('chunk-1',))
  self.assertEqual(recent_evidence('two','a'),())
  self.assertEqual(recent_evidence('one','new'),())
 def test_followup_rechecks_active_source_when_new_search_empty(self):
  db=MagicMock();db.table.return_value.select.return_value.in_.return_value.execute.return_value.data=[{'id':1,'content':'Supported information','metadata':{'source':'guide.txt','active':True}}]
  with patch('chat.retrieve',return_value=()),patch('chat.stream_passages',return_value=iter(())) as generate:
   list(stream_answer('why?',db,MagicMock(),session_context={'prior_source_ids':['chunk-1']}))
   self.assertEqual(generate.call_args.args[1][0].source_id,'chunk-1')
 def test_inactive_source_never_reused(self):
  db=MagicMock();db.table.return_value.select.return_value.in_.return_value.execute.return_value.data=[{'id':1,'content':'Old information','metadata':{'source':'guide.txt','active':False}}]
  with patch('chat.retrieve',return_value=()),patch('chat.stream_passages') as generate:
   events=list(stream_answer('why?',db,MagicMock(),session_context={'prior_source_ids':['chunk-1']}))
   generate.assert_not_called()
   self.assertEqual(events[-1].sources,())
if __name__=='__main__':unittest.main()
