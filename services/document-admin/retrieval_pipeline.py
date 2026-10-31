"""Bounded, configurable bilingual query preparation; no facts or model calls."""
import json
import math
import os
import re
from pathlib import Path
from functools import lru_cache

@lru_cache(maxsize=1)
def glossary():
    path=Path(os.getenv('BB_RETRIEVAL_GLOSSARY',str(Path(__file__).with_name('retrieval_glossary.json'))))
    data=json.loads(path.read_text(encoding='utf-8-sig'))
    if not isinstance(data.get('shorthand'),dict) or not isinstance(data.get('concepts'),list):
        raise ValueError('Invalid retrieval glossary')
    return data

def normalize_message(message):
    replacements=glossary()['shorthand']
    # Lowercase shorthand only: do not rewrite official acronyms, names or numbers.
    return re.sub(r'\b[\w-]+\b',lambda match:replacements.get(match[0],match[0]) if match[0].islower() else match[0],message)

def query_variants(question):
    standalone=normalize_message(question)
    folded=standalone.casefold()
    matched=[concept for concept in glossary()['concepts'] if any(re.search(r'(?<!\w)'+re.escape(alias)+r'(?!\w)',folded) for alias in concept['aliases'])]
    if not matched:return [standalone]
    # Search-only expansion. These labels are never answer evidence.
    english=' '.join(dict.fromkeys(concept['english'] for concept in matched))
    tagalog=' '.join(dict.fromkeys(concept['tagalog'] for concept in matched))
    expanded=standalone+'\nSearch concepts: '+english+'; '+tagalog
    return [standalone,expanded[:4000]] if expanded!=standalone else [standalone]

def ngrams(text):
    words=re.findall(r'[^\W_]+',text.casefold())
    return {word[i:i+3] for word in words for i in range(max(0,len(word)-2))}

def rank_passages(lists,question,limit):
    """RRF plus a small morphology tie-break; not a cross-encoder score."""
    passages,scores={},{}
    for results in lists:
        seen=set()
        for rank,passage in enumerate(results,1):
            key=passage.source_id
            if key in seen:continue
            seen.add(key);passages.setdefault(key,passage)
            scores[key]=scores.get(key,0)+1/(60+rank)
    candidates=sorted(scores,key=lambda key:-scores[key])[:30]
    terms=ngrams(question)
    def score(key):
        overlap=len(terms & ngrams(passages[key].content))/max(1,len(terms))
        return scores[key]+.002*overlap
    return [passages[key] for key in sorted(candidates,key=lambda key:-score(key))[:limit]]
