import { AccountingError } from './ledger.mjs';
export function trialBalance({accounts, journalLines}) {
 const balances=new Map(accounts.map(a=>[a.id,{...a,debit:0,credit:0}]));
 journalLines.forEach(l=>{const a=balances.get(l.accountId);if(!a)throw new AccountingError('حساب غير معروف في القيد');a.debit+=l.debit||0;a.credit+=l.credit||0});
 const rows=[...balances.values()].map(a=>({...a,balance:a.normalBalance==='DEBIT'?a.debit-a.credit:a.credit-a.debit}));
 const debit=rows.reduce((s,x)=>s+x.debit,0),credit=rows.reduce((s,x)=>s+x.credit,0);if(Math.abs(debit-credit)>.0001)throw new AccountingError('لا يمكن إصدار ميزان مراجعة غير متوازن');return {rows,debit,credit};
}
export function incomeStatement({accounts,journalLines}) {const tb=trialBalance({accounts,journalLines}).rows;const revenue=tb.filter(a=>a.type==='REVENUE').reduce((s,a)=>s+a.balance,0),expenses=tb.filter(a=>a.type==='EXPENSE').reduce((s,a)=>s+a.balance,0);return {revenue,expenses,netProfit:revenue-expenses};}
export function authorize({permissions, needed, amount=0, approvalLimit=0}) {if(!permissions.includes(needed)) throw new AccountingError('ليس لديك صلاحية هذه العملية');if(amount>approvalLimit)throw new AccountingError('قيمة العملية تتجاوز حد اعتماد المستخدم');return true;}
