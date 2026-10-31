import { relatedTopicReply as parse } from '../src/lib/relatedTopics.js'
import assert from 'node:assert/strict'
const result=parse(`Answer [3]

Mga kaugnay na paksa:
- Paano mag-report? [3]
- Ano ang patakaran? [3]

Pinagmulan:
[3] file.pdf`)
assert.deepEqual(result.topics,['Paano mag-report?','Ano ang patakaran?'])
assert.ok(result.text.includes('Pinagmulan:'))
assert.ok(!result.text.includes('Mga kaugnay'))
assert.equal(parse('Plain answer').text,'Plain answer')
console.log('Related-topic checks passed')
