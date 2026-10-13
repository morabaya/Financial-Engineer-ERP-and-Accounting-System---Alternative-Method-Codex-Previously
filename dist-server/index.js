import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { postSalesInvoice, AccountingError } from './core/ledger.mjs';
import { health as databaseHealth } from './db.mjs';
import { db } from './db.mjs';
import { createPostedSale } from './sales-repository.mjs';
const app = express();
app.use(cors());
app.use(express.json());
const invoices = [];
app.get('/api/health', async (_req, res) => {
    try {
        return res.json({ status: 'ok', service: 'financial-engineer-erp-core', time: new Date().toISOString(), ...(await databaseHealth()) });
    }
    catch {
        return res.status(503).json({ status: 'degraded', service: 'financial-engineer-erp-core', database: 'unavailable' });
    }
});
app.get('/api/dashboard', (_req, res) => res.json({ invoices: invoices.length, currency: 'ILS', company: 'شركة الأفق التجارية' }));
app.post('/api/sales-invoices', async (req, res) => {
    const parsed = z.object({ invoiceNo: z.string().min(1), customerId: z.string().min(1), lines: z.array(z.object({ itemId: z.string().optional(), quantity: z.number().positive(), unitPrice: z.number().nonnegative(), unitCost: z.number().nonnegative().default(0), availableQuantity: z.number().nonnegative().optional() })).min(1) }).safeParse(req.body);
    if (!parsed.success)
        return res.status(422).json({ error: 'بيانات الفاتورة غير صالحة', details: parsed.error.flatten() });
    try {
        if (db) {
            const key = req.header('Idempotency-Key');
            if (!key)
                return res.status(400).json({ error: 'مفتاح العملية مطلوب لمنع تكرار الفاتورة' });
            const result = await createPostedSale({ ...parsed.data, idempotencyKey: key });
            return res.status(result.status).json(result.body);
        }
        const result = postSalesInvoice({ id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), periodStatus: 'OPEN', customerAccount: '1100', revenueAccount: '4000', outputVatAccount: '2100', inventoryAccount: '1200', cogsAccount: '5000', vatRate: .16, ...parsed.data });
        invoices.push(result);
        return res.status(201).json({ ...result, mode: 'demo' });
    }
    catch (error) {
        return res.status(error instanceof AccountingError ? 422 : 500).json({ error: error instanceof Error ? error.message : 'خطأ غير متوقع' });
    }
});
app.listen(3000, () => console.log('Financial Engineer ERP API listening on http://localhost:3000'));
