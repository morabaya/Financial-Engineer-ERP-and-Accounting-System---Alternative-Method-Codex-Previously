import { AccountingError, assertBalanced } from './ledger.mjs';
export function postPayment({paymentNo,date,amount,cashAccount,payablesAccount,allocations}){
 if(!(amount>0)) throw new AccountingError('قيمة الدفعة يجب أن تكون أكبر من صفر'); const sum=allocations.reduce((s,a)=>s+a.amount,0);
 if(Math.abs(sum-amount)>.0001||allocations.some(a=>a.amount<=0||a.amount>a.openAmount)) throw new AccountingError('تخصيص دفعة المورد غير صحيح');
 const lines=[{accountId:payablesAccount,debit:amount,credit:0,reference:paymentNo},{accountId:cashAccount,debit:0,credit:amount,reference:paymentNo}];assertBalanced(lines);
 return {payment:{paymentNo,date,amount,status:'POSTED'},journal:{sourceType:'SUPPLIER_PAYMENT',date,lines},updates:allocations.map(a=>({payableId:a.payableId,openAmount:a.openAmount-a.amount,status:a.amount===a.openAmount?'PAID':'PARTIAL'}))};
}
export function taxSummary({transactions,from,to}){const rows=transactions.filter(t=>t.date>=from&&t.date<=to);const input=rows.filter(t=>t.direction==='INPUT').reduce((s,t)=>s+t.taxAmount,0);const output=rows.filter(t=>t.direction==='OUTPUT').reduce((s,t)=>s+t.taxAmount,0);return {from,to,inputVat:input,outputVat:output,netPayable:output-input};}
