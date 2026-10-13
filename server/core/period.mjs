import { AccountingError, assertBalanced } from './ledger.mjs';
export function canPost({ periodStatus, entryDate, periodStart, periodEnd, lines }) {
  if (periodStatus !== 'OPEN') throw new AccountingError('لا يمكن الترحيل إلى فترة مالية مغلقة');
  if (entryDate < periodStart || entryDate > periodEnd) throw new AccountingError('تاريخ القيد خارج الفترة المالية');
  return assertBalanced(lines);
}
export function closePeriod({ periodStatus, draftEntries = 0, unbalancedEntries = 0 }) {
  if (periodStatus !== 'OPEN') throw new AccountingError('الفترة مغلقة بالفعل');
  if (draftEntries > 0) throw new AccountingError('لا يمكن الإقفال: توجد قيود مسودة');
  if (unbalancedEntries > 0) throw new AccountingError('لا يمكن الإقفال: توجد قيود غير متوازنة');
  return { status:'CLOSED', closedAt:new Date().toISOString() };
}
