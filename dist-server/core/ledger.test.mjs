import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountingError, assertBalanced, postSalesInvoice, reverseJournal } from './ledger.mjs';

const base = { id:'inv-1', invoiceNo:'INV-000001', date:'2026-09-04', periodStatus:'OPEN', customerAccount:'1100', revenueAccount:'4100', outputVatAccount:'2100', inventoryAccount:'1200', cogsAccount:'5100', vatRate:.16 };
test('فاتورة البيع تنشئ قيدًا متوازنًا وحركة مخزون', () => {
  const result = postSalesInvoice({ ...base, lines:[{itemId:'item-1',quantity:2,unitPrice:100,unitCost:60,availableQuantity:5}] });
  assert.equal(result.invoice.total, 232);
  assert.deepEqual(assertBalanced(result.journal.lines), { debit:352, credit:352 });
  assert.equal(result.inventory[0].quantityDelta, -2);
});
test('ترفض النواة فترة مغلقة أو مخزونًا ناقصًا', () => {
  assert.throws(() => postSalesInvoice({ ...base, periodStatus:'CLOSED', lines:[{quantity:1,unitPrice:1}] }), AccountingError);
  assert.throws(() => postSalesInvoice({ ...base, lines:[{quantity:3,unitPrice:1,availableQuantity:2}] }), /مخزون غير كاف/);
});
test('العكس يولد قيودًا معاكسة متوازنة ولا يحذف الأصل', () => {
  const original = postSalesInvoice({ ...base, lines:[{quantity:1,unitPrice:10,unitCost:4}] }).journal;
  original.id='je-1';
  const reversed = reverseJournal({original,date:'2026-09-05',reason:'إلغاء بموافقة المدير'});
  assert.equal(reversed.lines[0].credit, original.lines[0].debit);
  assert.deepEqual(assertBalanced(reversed.lines), assertBalanced(original.lines));
});
