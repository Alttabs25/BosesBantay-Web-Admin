"""Bounded, short-lived cache of vectors only; retrieval always reads fresh rows."""
from collections import OrderedDict
import hashlib
import threading
import time

class QueryEmbeddingCache:
    def __init__(self, capacity=128, ttl=300, clock=time.monotonic):
        self.capacity, self.ttl, self.clock = capacity, ttl, clock
        self.values = OrderedDict()
        self.lock = threading.Lock()

    def get_or_create(self, key, create):
        digest = hashlib.sha256(repr(key).encode()).digest()
        now = self.clock()
        with self.lock:
            expired = [key for key, (expires, _) in self.values.items() if expires <= now]
            for key in expired: del self.values[key]
            if digest in self.values:
                expires, vector = self.values[digest]
                self.values.move_to_end(digest)
                return list(vector), True
        vector = create()  # Failed requests are never cached.
        if self.capacity > 0 and self.ttl > 0:
            with self.lock:
                self.values[digest] = (self.clock() + self.ttl, tuple(vector))
                self.values.move_to_end(digest)
                while len(self.values) > self.capacity: self.values.popitem(last=False)
        return list(vector), False
