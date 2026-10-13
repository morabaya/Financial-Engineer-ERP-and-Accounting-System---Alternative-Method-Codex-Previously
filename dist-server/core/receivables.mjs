import { AccountingError, assertBalanced } from './ledger.mjs';
export function applyReceipt({ receiptNo, date, partyId, amount, cashAccount, receivablesAccount, allocations }) {
  if (!partyId) throw new AccountingError('العميل مطلوب');
  if (!(amount > 0)) throw new AccountingError('قيمة التحصيل يجب أن تكون أكبر من صفر');
  const allocated = allocations.reduce((sum,a)=>sum+a.amount,0);
  if (Math.abs(allocated-amount)>0.0001) throw new AccountingError('مجموع التخصيصات يجب أن يساوي سند القبض');
  if (allocations.some(a=>a.amount<=0 || a.amount>a.openAmount)) throw new AccountingError('تخصيص التحصيل يتجاوز الرصيد المستحق');
  const lines=[{accountId:cashAccount,debit:amount,credit:0,reference:receiptNo},{accountId:receivablesAccount,debit:0,credit:amount,reference:receiptNo}];
  assertBalanced(lines);
  return { receipt:{receiptNo,date,partyId,amount,status:'POSTED'}, journal:{sourceType:'CASH_RECEIPT',date,lines}, updates:allocations.map(a=>({receivableId:a.receivableId,openAmount:a.openAmount-a.amount,status:a.openAmount===a.amount?'PAID':'PARTIAL'})) };
}
export function customerStatement({ party, receivables, receipts }) {
  const rows=[...receivables.map(x=>({date:x.date,type:'فاتورة',reference:x.invoiceNo,debit:x.amount,credit:0})),...receipts.map(x=>({date:x.date,type:'سند قبض',reference:x.receiptNo,debit:0,credit:x.amount}))].sort((a,b)=>a.date.localeCompare(b.date));
  let balance=0;
  const statementRows = rows.map(r => ({ ...r, balance: (balance += r.debit - r.credit) }));
  return { party, rows: statementRows, balance };
}
