"""Small local inbox for unanswered admin-chat questions; never a resident analytics feed."""
import sqlite3
from contextlib import contextmanager
import time
from pathlib import Path

class QuestionInbox:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(exist_ok=True)
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY, question TEXT NOT NULL, created REAL NOT NULL)')
    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=5)
        try:
            with db:
                yield db
        finally:
            db.close()
    def add(self, question):
        now = time.time()
        with self.connect() as db:
            db.execute('DELETE FROM questions WHERE created < ?', (now-30*86400,))
            existing = db.execute('SELECT id FROM questions WHERE question=? AND created>?', (question,now-86400)).fetchone()
            if not existing:
                db.execute('INSERT INTO questions(question,created) VALUES (?,?)',(question[:300],now))
            db.execute('DELETE FROM questions WHERE id NOT IN (SELECT id FROM questions ORDER BY id DESC LIMIT 200)')
    def recent(self):
        with self.connect() as db:
            db.execute('DELETE FROM questions WHERE created < ?', (time.time()-30*86400,))
            return [{'id':row[0],'question':row[1],'created_at':row[2]} for row in db.execute('SELECT id,question,created FROM questions ORDER BY id DESC LIMIT 10')]
