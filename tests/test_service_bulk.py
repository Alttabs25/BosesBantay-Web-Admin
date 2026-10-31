import sys
import unittest
from pathlib import Path
from unittest.mock import Mock
sys.path.insert(0,str(Path(__file__).parents[1]/'services/document-admin'))
from service_bulk import bulk_control
class BulkTests(unittest.TestCase):
 def test_start_order_excludes_expo(self):
  controller=Mock();ingestion=Mock()
  result=bulk_control(controller,'start',ingestion)
  self.assertEqual([call.args[0] for call in controller.start.call_args_list],['ollama','whisper','api'])
  ingestion.assert_called_once_with(True);self.assertTrue(result['ok'])
  controller.start_all.assert_not_called()
 def test_stop_order_and_pause(self):
  controller=Mock();ingestion=Mock()
  bulk_control(controller,'stop',ingestion)
  self.assertEqual([call.args[0] for call in controller.stop.call_args_list],['api','whisper','ollama'])
  ingestion.assert_called_once_with(False);controller.stop_all.assert_not_called()
 def test_partial_failure_does_not_stop_remaining_actions(self):
  controller=Mock();controller.start.side_effect=[RuntimeError('private payload'),'started','started']
  result=bulk_control(controller,'start',Mock())
  self.assertFalse(result['ok']);self.assertEqual(controller.start.call_count,3)
  self.assertNotIn('private payload',str(result))
if __name__=='__main__':unittest.main()
