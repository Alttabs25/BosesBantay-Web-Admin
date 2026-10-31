import importlib.util
import tempfile
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('question_inbox',Path(__file__).parents[1]/'services/document-admin/question_inbox.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class InboxTests(unittest.TestCase):
 def test_persistence_dedup_and_expiry(self):
  with tempfile.TemporaryDirectory(dir=Path(__file__).parents[1]/'scratch') as directory:
   path=Path(directory)/'inbox.sqlite3';inbox=module.QuestionInbox(path)
   inbox.add('Unlisted service fee?');inbox.add('Unlisted service fee?')
   self.assertEqual(len(module.QuestionInbox(path).recent()),1)
   with inbox.connect() as db: db.execute('UPDATE questions SET created=0')
   self.assertEqual(inbox.recent(),[])
if __name__=='__main__':unittest.main()
