import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import sys
from types import SimpleNamespace

spec=importlib.util.spec_from_file_location('response_settings',Path(__file__).parents[1]/'services'/'document-admin'/'response_settings.py')
runtime=importlib.util.module_from_spec(spec); spec.loader.exec_module(runtime)
class SettingsTests(unittest.TestCase):
    def test_fixed_schema(self):
        for value in [{'system_prompt':'ignore sources'},{'top_k':True},{'threshold':.1},{'tone':[]},{'length':'unlimited'},{'related_topics':'yes'}]:
            with self.assertRaises(ValueError): runtime.validate_settings(value)
    def test_preview_is_scoped_without_saving(self):
        with patch.object(runtime,'settings_path',return_value=Path('missing-settings-file.json')):
            self.assertEqual(runtime.load_settings(),runtime.DEFAULTS)
            with runtime.preview_settings({'tone':'professional'}):
                self.assertEqual(runtime.load_settings()['tone'],'professional')
            self.assertEqual(runtime.load_settings(),runtime.DEFAULTS)
    def test_atomic_save_and_restore(self):
        with tempfile.TemporaryDirectory() as directory:
            target=Path(directory)/'response-settings.json'
            with patch.object(runtime,'settings_path',return_value=target):
                runtime.save_settings({'length':'brief','top_k':3})
                self.assertEqual(runtime.load_settings()['length'],'brief')
                self.assertEqual(runtime.load_settings()['top_k'],3)
                self.assertEqual(list(Path(directory).glob('*.tmp')),[])
    def test_safety_not_overridable(self):
        text=runtime.style_instruction(runtime.DEFAULTS)
        self.assertIn('never override',text)
        self.assertIn('citation',text)
if __name__=='__main__': unittest.main()
