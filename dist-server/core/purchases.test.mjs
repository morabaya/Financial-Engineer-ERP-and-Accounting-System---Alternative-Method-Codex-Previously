import test from 'node:test'; import assert from 'node:assert/strict';
import {postPurchaseInvoice,transferStock} from './purchases.mjs';
const base={id:'p1',invoiceNo:'PINV-1',date:'2026-09-04',periodStatus:'OPEN',supplierAccount:'2000',inventoryAccount:'1200',expenseAccount:'5100',inputVatAccount:'1150',vatRate:.16};
test('فاتورة شراء ترحل مخزونًا وضريبة مدخلات ودائنين',()=>{const r=postPurchaseInvoice({...base,items:[{itemId:'i1',warehouseId:'w1',isStock:true,quantity:3,unitPrice:100},{isStock:false,quantity:1,unitPrice:20}]});assert.equal(r.invoice.total,371.2);assert.equal(r.inventory[0].quantityDelta,3);assert.equal(r.journal.lines.reduce((s,l)=>s+l.debit,0),r.journal.lines.reduce((s,l)=>s+l.credit,0));});
test('تحويل المخزون لا يغير إجمالي الكمية',()=>{const x=transferStock({itemId:'i1',quantity:5,unitCost:2,fromWarehouse:'a',toWarehouse:'b',date:'2026-09-04'});assert.equal(x[0].quantityDelta+x[1].quantityDelta,0);});
