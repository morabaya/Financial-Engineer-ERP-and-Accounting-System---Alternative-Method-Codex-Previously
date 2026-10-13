import { db } from './db.mjs';
if (!db)
    throw new Error('DATABASE_URL غير مضبوط؛ انسخ .env.example إلى .env');
const client = await db.connect();
try {
    await client.query('BEGIN');
    const exists = await client.query("SELECT id FROM companies WHERE code='NABD-DEMO'");
    if (exists.rowCount) {
        console.log('شركة العرض موجودة مسبقًا؛ لم تتغير البيانات.');
        await client.query('COMMIT');
    }
    else {
        const tenant = (await client.query("INSERT INTO tenants(name) VALUES('مساحة عرض نَبض') RETURNING id")).rows[0].id;
        const company = (await client.query("INSERT INTO companies(tenant_id,name,base_currency,tax_number,code) VALUES($1,'شركة الأفق التجارية','ILS','562738920','NABD-DEMO') RETURNING id", [tenant])).rows[0].id;
        const fy = (await client.query("INSERT INTO fiscal_years(company_id,name,starts_on,ends_on,status) VALUES($1,'2026','2026-01-01','2026-12-31','OPEN') RETURNING id", [company])).rows[0].id;
        for (let m = 0; m < 12; m++) {
            const start = new Date(Date.UTC(2026, m, 1)).toISOString().slice(0, 10), end = new Date(Date.UTC(2026, m + 1, 0)).toISOString().slice(0, 10);
            await client.query("INSERT INTO accounting_periods(fiscal_year_id,starts_on,ends_on,status) VALUES($1,$2,$3,'OPEN')", [fy, start, end]);
        }
        const accountRows = [['1000', 'الصندوق', 'ASSET', 'DEBIT'], ['1100', 'العملاء', 'ASSET', 'DEBIT'], ['1150', 'ضريبة مدخلات', 'ASSET', 'DEBIT'], ['1200', 'المخزون', 'ASSET', 'DEBIT'], ['2000', 'الموردون', 'LIABILITY', 'CREDIT'], ['2100', 'ضريبة مخرجات', 'LIABILITY', 'CREDIT'], ['3000', 'رأس المال', 'EQUITY', 'CREDIT'], ['4000', 'إيرادات المبيعات', 'REVENUE', 'CREDIT'], ['4100', 'إيرادات أخرى', 'REVENUE', 'CREDIT'], ['5000', 'تكلفة البضاعة المباعة', 'EXPENSE', 'DEBIT'], ['5100', 'المصروفات التشغيلية', 'EXPENSE', 'DEBIT']];
        const accountIds = new Map();
        for (const [code, name, type, balance] of accountRows) {
            const x = await client.query('INSERT INTO accounts(company_id,code,name_ar,account_type,normal_balance) VALUES($1,$2,$3,$4,$5) RETURNING id', [company, code, name, type, balance]);
            accountIds.set(code, x.rows[0].id);
        }
        const party = (await client.query("INSERT INTO parties(company_id,party_no,display_name,tax_number,phone,credit_limit) VALUES($1,'CUST-001','مؤسسة النور للتجارة','562100341','0599000001',30000) RETURNING id", [company])).rows[0].id;
        await client.query("INSERT INTO party_roles(party_id,role) VALUES($1,'CUSTOMER')", [party]);
        const supplier = (await client.query("INSERT INTO parties(company_id,party_no,display_name,tax_number,phone) VALUES($1,'SUP-001','مورد الشرق','562100342','0599000002') RETURNING id", [company])).rows[0].id;
        await client.query("INSERT INTO party_roles(party_id,role) VALUES($1,'SUPPLIER')", [supplier]);
        const unit = (await client.query("INSERT INTO units(company_id,name_ar,symbol) VALUES($1,'قطعة','قطعة') RETURNING id", [company])).rows[0].id;
        const category = (await client.query('INSERT INTO item_categories(company_id,name_ar,inventory_account_id,cogs_account_id,revenue_account_id) VALUES($1,\'بضائع تجارية\',$2,$3,$4) RETURNING id', [company, accountIds.get('1200'), accountIds.get('5000'), accountIds.get('4000')])).rows[0].id;
        const warehouse = (await client.query("INSERT INTO warehouses(company_id,code,name_ar) VALUES($1,'MAIN','المستودع الرئيسي') RETURNING id", [company])).rows[0].id;
        for (const [sku, name, qty, cost, reorder] of [['PRN-010', 'حبر طابعة ليزر', 86, 82, 25], ['STN-201', 'ورق A4', 18, 42, 30], ['POS-009', 'طابعة حرارية', 42, 450, 10]]) {
            const item = (await client.query("INSERT INTO items(company_id,sku,name_ar,item_type,unit_id,category_id,reorder_level) VALUES($1,$2,$3,'STOCK',$4,$5,$6) RETURNING id", [company, sku, name, unit, category, reorder])).rows[0].id;
            await client.query("INSERT INTO inventory_movements(company_id,item_id,warehouse_id,movement_date,movement_type,quantity_delta,unit_cost,source_type) VALUES($1,$2,$3,'2026-01-01','ADJUSTMENT',$4,$5,'OPENING_BALANCE')", [company, item, warehouse, qty, cost]);
        }
        await client.query("INSERT INTO tax_codes(company_id,code,name_ar,rate,effective_from,input_tax_account_id,output_tax_account_id) VALUES($1,'VAT-DEMO','ضريبة عرض تجريبية',0.16,'2026-01-01',$2,$3)", [company, accountIds.get('1150'), accountIds.get('2100')]);
        const openingPeriod = (await client.query("SELECT id FROM accounting_periods WHERE fiscal_year_id=$1 AND starts_on='2026-01-01'", [fy])).rows[0].id;
        const inventoryValue = 86 * 82 + 18 * 42 + 42 * 450, cashValue = 100000;
        const opening = (await client.query("INSERT INTO journal_entries(company_id,period_id,entry_no,entry_date,source_type,status,memo) VALUES($1,$2,'OPEN-2026','2026-01-01','OPENING_BALANCE','DRAFT','أرصدة افتتاحية لبيئة العرض') RETURNING id", [company, openingPeriod])).rows[0].id;
        await client.query('INSERT INTO journal_lines(journal_entry_id,line_no,account_id,debit,credit,description) VALUES($1,1,$2,$3,0,$4),($1,2,$5,$6,0,$4),($1,3,$7,0,$8,$4)', [opening, accountIds.get('1000'), cashValue, 'أرصدة افتتاحية', accountIds.get('1200'), inventoryValue, accountIds.get('3000'), cashValue + inventoryValue]);
        await client.query("UPDATE journal_entries SET status='POSTED',posted_at=now() WHERE id=$1", [opening]);
        await client.query('COMMIT');
        console.log(`تهيأت شركة العرض ${company}; الحسابات والأطراف والمخزون جاهزة.`);
    }
}
catch (e) {
    await client.query('ROLLBACK');
    throw e;
}
finally {
    client.release();
    await db.end();
}
