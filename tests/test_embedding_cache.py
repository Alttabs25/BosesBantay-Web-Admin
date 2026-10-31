import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('embedding_cache', Path(__file__).parents[1] / 'services' / 'document-admin' / 'embedding_cache.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class CacheTests(unittest.TestCase):
    def test_repeat_avoids_embedding_and_returns_copy(self):
        calls = []
        cache = module.QueryEmbeddingCache()
        def create(): calls.append(1); return [1., 2.]
        first, hit = cache.get_or_create(('model','question'), create)
        self.assertFalse(hit)
        first[0] = 9
        second, hit = cache.get_or_create(('model','question'), create)
        self.assertTrue(hit)
        self.assertEqual(second, [1., 2.])
        self.assertEqual(len(calls), 1)
    def test_ttl_and_model_namespace(self):
        clock = [0]
        cache = module.QueryEmbeddingCache(ttl=2, clock=lambda: clock[0])
        cache.get_or_create(('modelA','q'), lambda: [1])
        self.assertFalse(cache.get_or_create(('modelB','q'), lambda: [2])[1])
        clock[0] = 3
        self.assertFalse(cache.get_or_create(('modelA','q'), lambda: [3])[1])
    def test_lru_bound_and_disabled_cache(self):
        cache = module.QueryEmbeddingCache(capacity=1)
        cache.get_or_create('a', lambda: [1]); cache.get_or_create('b', lambda: [2])
        self.assertEqual(len(cache.values), 1)
        self.assertFalse(cache.get_or_create('a', lambda: [1])[1])
        disabled = module.QueryEmbeddingCache(capacity=0)
        disabled.get_or_create('a', lambda: [1])
        self.assertFalse(disabled.get_or_create('a', lambda: [1])[1])
    def test_failures_are_not_cached(self):
        cache = module.QueryEmbeddingCache()
        with self.assertRaises(ValueError): cache.get_or_create('a', lambda: (_ for _ in ()).throw(ValueError()))
        self.assertFalse(cache.get_or_create('a', lambda: [1])[1])

if __name__ == '__main__': unittest.main()
