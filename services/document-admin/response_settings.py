"""Validated response preferences shared by local app and admin previews."""
from contextlib import contextmanager
from contextvars import ContextVar
import json
import os
from pathlib import Path
import tempfile

DEFAULTS = {'tone': 'friendly', 'length': 'standard', 'related_topics': True, 'top_k': 5, 'threshold': .3}
_override = ContextVar('response_preferences', default=None)

def validate_settings(values):
    if not isinstance(values, dict) or set(values) - set(DEFAULTS):
        raise ValueError('Use only the supported chatbot preferences.')
    result = {**DEFAULTS, **values}
    if not isinstance(result['tone'], str) or result['tone'] not in {'friendly','professional'}: raise ValueError('Choose a supported tone.')
    if not isinstance(result['length'], str) or result['length'] not in {'brief','standard','detailed'}: raise ValueError('Choose a supported answer length.')
    if type(result['related_topics']) is not bool: raise ValueError('Related topics must be on or off.')
    if type(result['top_k']) is not int or not 3 <= result['top_k'] <= 8: raise ValueError('Retrieve between 3 and 8 passages.')
    if type(result['threshold']) not in {int,float} or not .2 <= result['threshold'] <= .7: raise ValueError('Relevance threshold must be between 0.2 and 0.7.')
    return result

def settings_path():
    import config
    return config.ROOT / '.private' / 'response-settings.json'

def load_settings():
    if _override.get() is not None: return dict(_override.get())
    try: return validate_settings(json.loads(settings_path().read_text(encoding='utf-8')))
    except (OSError, ValueError, TypeError): return dict(DEFAULTS)

def save_settings(values):
    result = validate_settings(values)
    path = settings_path()
    path.parent.mkdir(exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(dir=path.parent, prefix='response-', suffix='.tmp')
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
            json.dump(result, stream)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return result

@contextmanager
def preview_settings(values):
    token = _override.set(validate_settings(values))
    try: yield
    finally: _override.reset(token)

def style_instruction(settings):
    tone = 'Use warm, natural, respectful language; use po naturally, without repeating it in every sentence.' if settings['tone'] == 'friendly' else 'Use clear, professional language with a calm and respectful tone.'
    length = {'brief':'Prefer 1-2 direct sentences. Include essential conditions; do not truncate a required guide.', 'standard':'Prefer 2-4 clear sentences for factual answers. Keep guides concise.', 'detailed':'Include useful supported conditions and exceptions, within 4 concise sentences for factual answers. Give complete steps when a guide is requested.'}[settings['length']]
    related = 'Offer up to two supported related topics when useful.' if settings['related_topics'] else 'Return related_topics=[]; do not add follow-up topic suggestions.'
    return tone + ' ' + length + ' ' + related + ' These preferences never override barangay scope, source grounding, language matching, citation checks, or failure handling.'
