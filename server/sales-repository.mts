import type { PoolClient } from 'pg';
import { db } from './db.mjs';
import { AccountingError } from './core/ledger.mjs';

type Input={invoiceNo:string;customerId:string;lines:{itemId?:string;quantity:number;unitPrice:number;unitCost:number;availableQuantity?:number}[];idempotencyKey:string};
export async function createPostedSale(input:Input){
 if(!db)throw new AccountingError('قاعدة البيانات غير مهيأة؛ شغّل migrations وseed:demo أولًا');
 const client:PoolClient=await db.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[input.idempotencyKey]);
  const companyResult=await client.query("SELECT id,tenant_id,base_currency FROM companies WHERE code='NABD-DEMO' LIMIT 1");
  if(!companyResult.rowCount)throw new AccountingError('لم يتم إعداد الشركة بعد؛ شغّل npm run seed:demo');
  const company=companyResult.rows[0];
  const previous=await client.query('SELECT response_status,response_body FROM api_idempotency_keys WHERE company_id=$1 AND key=$2 FOR UPDATE',[company.id,input.idempotencyKey]);
  if(previous.rowCount){await client.query('COMMIT');return {status:previous.rows[0].response_status,body:previous.rows[0].response_body,replayed:true};}
  const customerResult=await client.query("SELECT id FROM parties WHERE company_id=$1 AND party_no='CUST-001' AND is_active=true",[company.id]);
  if(!customerResult.rowCount)throw new AccountingError('أضف عميلًا قبل إنشاء الفاتورة');
  const invoiceDate=new Date().toISOString().slice(0,10);
  const periodResult=await client.query("SELECT p.id,p.status FROM accounting_periods p JOIN fiscal_years y ON y.id=p.fiscal_year_id WHERE y.company_id=$1 AND $2::date BETWEEN p.starts_on AND p.ends_on",[company.id,invoiceDate]);
  if(!periodResult.rowCount||periodResult.rows[0].status!=='OPEN')throw new AccountingError('لا توجد فترة مالية مفتوحة لهذا التاريخ');
  const taxResult=await client.query("SELECT rate FROM tax_codes WHERE company_id=$1 AND is_active=true AND effective_from<=$2::date AND (effective_to IS NULL OR effective_to>=$2::date) ORDER BY effective_from DESC LIMIT 1",[company.id,invoiceDate]);
  const taxRate=taxResult.rowCount?Number(taxResult.rows[0].rate):0;
  const items=[] as {id:string;qty:number;price:number;cost:number;tax:number;lineTotal:number}[];
  for(const line of input.lines){
   const itemResult=await client.query("SELECT id FROM items WHERE company_id=$1 AND is_active=true ORDER BY sku LIMIT 1 FOR UPDATE",[company.id]);
   if(!itemResult.rowCount)throw new AccountingError('لا توجد أصناف معرفة في المخزون');
   const itemId=itemResult.rows[0].id;
   const wh=await client.query("SELECT id FROM warehouses WHERE company_id=$1 AND is_active=true ORDER BY code LIMIT 1",[company.id]);
   if(!wh.rowCount)throw new AccountingError('أنشئ مستودعًا قبل البيع');
   const balance=await client.query('SELECT COALESCE(sum(quantity_delta),0) quantity,COALESCE(sum(quantity_delta*unit_cost),0) value FROM inventory_movements WHERE item_id=$1 AND warehouse_id=$2',[itemId,wh.rows[0].id]);
   const available=Number(balance.rows[0].quantity),cost=available>0?Number(balance.rows[0].value)/available:0;
   if(line.quantity>available)throw new AccountingError('المخزون غير كافٍ للصنف');
   const net=Math.round(line.quantity*line.unitPrice*10000)/10000,tax=Math.round(net*taxRate*10000)/10000;
   items.push({id:itemId,qty:line.quantity,price:line.unitPrice,cost,tax,lineTotal:net+tax});
  }
  const subtotal=items.reduce((s,x)=>s+x.qty*x.price,0),taxTotal=items.reduce((s,x)=>s+x.tax,0),total=subtotal+taxTotal;
  const fy=await client.query('SELECT id FROM fiscal_years WHERE company_id=$1 AND $2::date BETWEEN starts_on AND ends_on',[company.id,invoiceDate]);
  const seq=await client.query("INSERT INTO document_sequences(company_id,document_type,fiscal_year_id,next_value) VALUES($1,'SALES_INVOICE',$2,2) ON CONFLICT(company_id,document_type,fiscal_year_id) DO UPDATE SET next_value=document_sequences.next_value+1 RETURNING next_value-1 sequence",[company.id,fy.rows[0].id]);
  const number=`INV-${invoiceDate.slice(0,4)}-${String(seq.rows[0].sequence).padStart(6,'0')}`;
  const invoice=await client.query("INSERT INTO sales_invoices(company_id,customer_id,invoice_no,invoice_type,invoice_date,due_date,currency,subtotal,tax_total,total,approval_status) VALUES($1,$2,$3,'TAX',$4,$4,$5,$6,$7,$8,'POSTED') RETURNING id,invoice_no,invoice_date,subtotal,tax_total,total,approval_status",[company.id,customerResult.rows[0].id,number,invoiceDate,company.base_currency,subtotal,taxTotal,total]);
  const inv=invoice.rows[0];
  for(let i=0;i<items.length;i++){
   const x=items[i],wh=await client.query("SELECT id FROM warehouses WHERE company_id=$1 AND is_active=true ORDER BY code LIMIT 1",[company.id]);
   await client.query('INSERT INTO sales_invoice_lines(invoice_id,line_no,item_id,description,quantity,unit_price,unit_cost,tax_rate,line_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[inv.id,i+1,x.id,'صنف مبيعات',x.qty,x.price,x.cost,taxRate,x.lineTotal]);
   await client.query("INSERT INTO inventory_movements(company_id,item_id,warehouse_id,movement_date,movement_type,quantity_delta,unit_cost,source_type,source_id) VALUES($1,$2,$3,$4,'SALE',$5,$6,'SALES_INVOICE',$7)",[company.id,x.id,wh.rows[0].id,invoiceDate,-x.qty,x.cost,inv.id]);
  }
  const accounts=await client.query("SELECT code,id FROM accounts WHERE company_id=$1 AND code=ANY($2::text[])",[company.id,['1100','2100','4000','1200','5000']]);
  const account=new Map(accounts.rows.map(x=>[x.code,x.id]));
  const cogs=items.reduce((s,x)=>s+x.qty*x.cost,0);
  for(const code of ['1100','2100','4000'])if(!account.has(code))throw new AccountingError(`الحساب ${code} غير موجود في دليل الحسابات`);
  if(cogs>0&&(!account.has('1200')||!account.has('5000')))throw new AccountingError('يجب ربط حساب المخزون وتكلفة البضاعة قبل ترحيل بيع مخزني');
  const jv=await client.query("INSERT INTO journal_entries(company_id,period_id,entry_no,entry_date,source_type,source_id,status,memo) VALUES($1,$2,$3,$4,'SALES_INVOICE',$5,'DRAFT',$6) RETURNING id",[company.id,periodResult.rows[0].id,`JV-${number}`,invoiceDate,inv.id,`فاتورة ${number}`]);
  const je=jv.rows[0].id;
  const lines=[['1100',total,0],['4000',0,subtotal],['2100',0,taxTotal]];
  if(cogs>0&&account.has('1200')&&account.has('5000'))lines.push(['5000',cogs,0],['1200',0,cogs]);
  for(let i=0;i<lines.length;i++){const [code,debit,credit]=lines[i];if(!account.has(code))throw new AccountingError(`الحساب ${code} غير موجود في دليل الحسابات`);await client.query('INSERT INTO journal_lines(journal_entry_id,line_no,account_id,debit,credit,description) VALUES($1,$2,$3,$4,$5,$6)',[je,i+1,account.get(code),debit,credit,number]);}
  await client.query("UPDATE journal_entries SET status='POSTED' WHERE id=$1",[je]);
  await client.query('UPDATE sales_invoices SET journal_entry_id=$1 WHERE id=$2',[je,inv.id]);
  await client.query("INSERT INTO receivables(company_id,party_id,invoice_id,due_date,original_amount,open_amount,status) VALUES($1,$2,$3,$4,$5,$5,'OPEN')",[company.id,customerResult.rows[0].id,inv.id,invoiceDate,total]);
  const body={invoice:{id:inv.id,invoiceNo:number,total:Number(total),subtotal:Number(subtotal),tax:Number(taxTotal),status:'POSTED'},journal:{id:je,status:'POSTED'},inventoryMovements:items.length};
  await client.query("INSERT INTO audit_logs(tenant_id,company_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'POST','SALES_INVOICE',$3,$4)",[company.tenant_id,company.id,inv.id,JSON.stringify(body)]);
  await client.query('INSERT INTO api_idempotency_keys(company_id,key,method,route,response_status,response_body) VALUES($1,$2,$3,$4,201,$5)',[company.id,input.idempotencyKey,'POST','/api/sales-invoices',JSON.stringify(body)]);
  await client.query('COMMIT');return {status:201,body,replayed:false};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
