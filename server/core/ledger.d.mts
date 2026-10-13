export class AccountingError extends Error {}
export function postSalesInvoice(input: {
  id:string; invoiceNo:string; date:string; periodStatus:'OPEN'|'CLOSED'; customerAccount:string; revenueAccount:string;
  outputVatAccount:string; inventoryAccount:string; cogsAccount:string; vatRate:number;
  lines:Array<{itemId?:string;quantity:number;unitPrice:number;unitCost?:number;availableQuantity?:number}>;
}): { invoice:{total:number}; journal:unknown; inventory:unknown[] };
