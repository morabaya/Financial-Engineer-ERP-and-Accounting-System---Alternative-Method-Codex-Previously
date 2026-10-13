import { AccountingError, assertBalanced } from './ledger.mjs';
export function postPurchaseInvoice({id, invoiceNo, date, periodStatus, supplierAccount, inventoryAccount, expenseAccount, inputVatAccount, items, vatRate}) {
  if(periodStatus!=='OPEN') throw new AccountingError('الفترة المالية مغلقة');
  if(!items?.length) throw new AccountingError('فاتورة الشراء تحتاج بنودًا');
  if(items.some(x=>x.quantity<=0||x.unitPrice<0)) throw new AccountingError('كمية أو سعر شراء غير صحيح');
  const stockCost=items.filter(x=>x.isStock).reduce((s,x)=>s+x.quantity*x.unitPrice,0);
  const expense=items.filter(x=>!x.isStock).reduce((s,x)=>s+x.quantity*x.unitPrice,0);
  const subtotal=stockCost+expense, tax=Math.round(subtotal*vatRate*10000)/10000, total=subtotal+tax;
  const lines=[{accountId:inventoryAccount,debit:stockCost,credit:0,reference:invoiceNo},{accountId:expenseAccount,debit:expense,credit:0,reference:invoiceNo},{accountId:inputVatAccount,debit:tax,credit:0,reference:invoiceNo},{accountId:supplierAccount,debit:0,credit:total,reference:invoiceNo}].filter(x=>x.debit||x.credit);
  assertBalanced(lines);
  return {invoice:{id,invoiceNo,date,status:'POSTED',subtotal,tax,total},journal:{sourceType:'PURCHASE_INVOICE',sourceId:id,date,lines},inventory:items.filter(x=>x.isStock).map(x=>({itemId:x.itemId,warehouseId:x.warehouseId,quantityDelta:x.quantity,unitCost:x.unitPrice,type:'PURCHASE'}))};
}
export function transferStock({itemId, quantity, unitCost, fromWarehouse, toWarehouse, date}) {
  if(!itemId||!fromWarehouse||!toWarehouse||fromWarehouse===toWarehouse) throw new AccountingError('حدد مستودعين مختلفين');
  if(!(quantity>0)) throw new AccountingError('كمية التحويل يجب أن تكون موجبة');
  return [{itemId,warehouseId:fromWarehouse,quantityDelta:-quantity,unitCost,type:'TRANSFER_OUT',date},{itemId,warehouseId:toWarehouse,quantityDelta:quantity,unitCost,type:'TRANSFER_IN',date}];
}
