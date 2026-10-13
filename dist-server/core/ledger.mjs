/**
 * نواة دفتر الأستاذ: لا تعتمد على HTTP أو واجهة المستخدم.
 * في التنفيذ الإنتاجي تحفظ الكيانات داخل PostgreSQL ضمن transaction واحدة.
 */
export class AccountingError extends Error {}

export function assertBalanced(lines) {
  if (!Array.isArray(lines) || lines.length < 2) throw new AccountingError('القيد يحتاج سطرين على الأقل');
  const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  if (lines.some(l => Number(l.debit || 0) < 0 || Number(l.credit || 0) < 0 || (Number(l.debit || 0) > 0 && Number(l.credit || 0) > 0))) {
    throw new AccountingError('كل سطر مدين أو دائن فقط وبقيمة موجبة');
  }
  if (Math.abs(debit - credit) > 0.0001) throw new AccountingError(`القيد غير متوازن: مدين ${debit}، دائن ${credit}`);
  return { debit, credit };
}

export function postSalesInvoice({ id, invoiceNo, date, periodStatus, customerAccount, revenueAccount, outputVatAccount, inventoryAccount, cogsAccount, lines, vatRate }) {
  if (periodStatus !== 'OPEN') throw new AccountingError('الفترة المالية مغلقة');
  if (!lines?.length) throw new AccountingError('لا يمكن اعتماد فاتورة بلا بنود');
  const subtotal = lines.reduce((sum, x) => sum + x.quantity * x.unitPrice, 0);
  const vat = Math.round(subtotal * vatRate * 10000) / 10000;
  const cost = lines.reduce((sum, x) => sum + x.quantity * (x.unitCost ?? 0), 0);
  if (lines.some(x => x.quantity <= 0 || x.unitPrice < 0 || (x.availableQuantity != null && x.quantity > x.availableQuantity))) {
    throw new AccountingError('يوجد سعر أو كمية غير صحيحة أو مخزون غير كافٍ');
  }
  const journalLines = [
    { accountId: customerAccount, debit: subtotal + vat, credit: 0, reference: invoiceNo },
    { accountId: revenueAccount, debit: 0, credit: subtotal, reference: invoiceNo },
    { accountId: outputVatAccount, debit: 0, credit: vat, reference: invoiceNo }
  ];
  if (cost > 0) journalLines.push(
    { accountId: cogsAccount, debit: cost, credit: 0, reference: invoiceNo },
    { accountId: inventoryAccount, debit: 0, credit: cost, reference: invoiceNo }
  );
  assertBalanced(journalLines);
  return {
    invoice: { id, invoiceNo, date, status: 'POSTED', subtotal, vat, total: subtotal + vat },
    journal: { sourceType: 'SALES_INVOICE', sourceId: id, date, lines: journalLines },
    inventory: lines.filter(x => x.itemId).map(x => ({ itemId: x.itemId, quantityDelta: -x.quantity, sourceId: id, type: 'SALE' }))
  };
}

export function reverseJournal({ original, date, reason }) {
  if (!reason?.trim()) throw new AccountingError('سبب العكس مطلوب');
  const lines = original.lines.map(line => ({ ...line, debit: line.credit, credit: line.debit, reference: `عكس ${original.sourceId}` }));
  assertBalanced(lines);
  return { sourceType: 'REVERSAL', sourceId: original.sourceId, date, reason, reversedEntryId: original.id, lines };
}
