import test from 'node:test';
import assert from 'node:assert/strict';
import { canPost, closePeriod } from './period.mjs';
test('يرفض ترحيل قيد خارج الفترة أو في فترة مغلقة',()=>{
  const lines=[{debit:10,credit:0},{debit:0,credit:10}];
  assert.throws(()=>canPost({periodStatus:'CLOSED',entryDate:'2026-09-04',periodStart:'2026-09-01',periodEnd:'2026-09-30',lines}),/مغلقة/);
  assert.throws(()=>canPost({periodStatus:'OPEN',entryDate:'2026-10-01',periodStart:'2026-09-01',periodEnd:'2026-09-30',lines}),/خارج/);
});
test('يقفل فقط بعد تصفية المسودات والاختلالات',()=>{
  assert.throws(()=>closePeriod({periodStatus:'OPEN',draftEntries:1}),/مسودة/);
  assert.equal(closePeriod({periodStatus:'OPEN'}).status,'CLOSED');
});
