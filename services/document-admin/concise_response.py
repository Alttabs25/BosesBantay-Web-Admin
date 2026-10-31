"""Validate source-linked claims before code generates inline citations."""
import json
import re
from pydantic import BaseModel, ConfigDict, Field

class Claim(BaseModel):
    model_config=ConfigDict(strict=True,extra='forbid')
    text:str=Field(min_length=1,max_length=800)
    source_ids:list[str]=Field(min_length=1,max_length=5)

class ConciseReply(BaseModel):
    model_config=ConfigDict(strict=True,extra='forbid')
    kind:str
    claims:list[Claim]=Field(max_length=4)
    related_questions:list[Claim]=Field(max_length=2)
    conflicts:list[list[str]]

def render_claims(raw,passages,language):
    reply=ConciseReply.model_validate_json(raw,strict=True)
    if reply.kind not in {'answer','missing_information','refusal'}:
        raise ValueError('Invalid answer kind')
    mapping={p.source_id:p.number for p in passages}
    used=[]
    def render(claim):
        if any(sid not in mapping for sid in claim.source_ids):
            raise ValueError('Unretrieved claim source')
        text=re.sub(r'\[\d+\]','',claim.text).strip()
        if not text:raise ValueError('Empty claim')
        ids=list(dict.fromkeys(claim.source_ids))
        used.extend(sid for sid in ids if sid not in used)
        markers=' '.join(f'[{mapping[sid]}]' for sid in ids)
        return ' '.join(sentence+' '+markers for sentence in re.split(r'(?<=[.!?])\s+',text) if sentence)
    answer=' '.join(render(claim) for claim in reply.claims)
    related=[render(claim) for claim in reply.related_questions]
    if reply.kind=='answer' and not answer:raise ValueError('Answer has no supported claims')
    if reply.kind!='answer':answer='No supported information found.';related=[];used=[]
    return json.dumps({'kind':reply.kind,'language':language,'overview':'','steps':[],'answer':answer,'related_topics':related,'source_ids':used,'conflicts':reply.conflicts},ensure_ascii=False)
