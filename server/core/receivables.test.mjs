import test from 'node:test'; import assert from 'node:assert/strict';
import { applyReceipt, customerStatement } from './receivables.mjs';
test('سند القبض ينشئ قيدًا متوازنًا ويحدّث الذمم',()=>{
 const x=applyReceipt({receiptNo:'RC-1',date:'2026-09-04',partyId:'c1',amount:150,cashAccount:'1000',receivablesAccount:'1100',allocations:[{receivableId:'r1',openAmount:100,amount:100},{receivableId:'r2',openAmount:50,amount:50}]});
 assert.equal(x.journal.lines[0].debit,150); assert.equal(x.updates[0].status,'PAID');
});
test('يكشف العميل يحافظ على الرصيد المتراكم',()=>{
 const s=customerStatement({party:'عميل',receivables:[{date:'2026-09-01',invoiceNo:'INV-1',amount:200}],receipts:[{date:'2026-09-02',receiptNo:'RC-1',amount:75}]});
 assert.equal(s.balance,125); assert.equal(s.rows[1].balance,125);
});
