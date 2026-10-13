import { AccountingError, assertBalanced } from './ledger.mjs';
export function postExpense({expenseNo,date,periodStatus,expenseAccount,inputVatAccount,paymentAccount,amount,tax=0,costCenterId}) {
 if(periodStatus!=='OPEN') throw new AccountingError('الفترة المالية مغلقة'); if(amount<0||tax<0||amount+tax===0) throw new AccountingError('قيمة المصروف غير صحيحة');
 const lines=[{accountId:expenseAccount,debit:amount,credit:0,costCenterId,reference:expenseNo},{accountId:inputVatAccount,debit:tax,credit:0,costCenterId,reference:expenseNo},{accountId:paymentAccount,debit:0,credit:amount+tax,reference:expenseNo}].filter(l=>l.debit||l.credit);assertBalanced(lines);
 return {status:'POSTED',journal:{sourceType:'CASH_EXPENSE',date,lines},total:amount+tax};
}
export function postOtherIncome({incomeNo,date,periodStatus,receiptAccount,incomeAccount,outputVatAccount,amount,tax=0,costCenterId}) {
 if(periodStatus!=='OPEN') throw new AccountingError('الفترة المالية مغلقة'); if(amount<0||tax<0||amount+tax===0) throw new AccountingError('قيمة الإيراد غير صحيحة');
 const lines=[{accountId:receiptAccount,debit:amount+tax,credit:0,reference:incomeNo},{accountId:incomeAccount,debit:0,credit:amount,costCenterId,reference:incomeNo},{accountId:outputVatAccount,debit:0,credit:tax,reference:incomeNo}].filter(l=>l.debit||l.credit);assertBalanced(lines);
 return {status:'POSTED',journal:{sourceType:'OTHER_INCOME',date,lines},total:amount+tax};
}
