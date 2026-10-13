# Financial Engineer ERP and Accounting System

واجهة النظام عربية RTL، واسم المنتج المعتمد هو **Financial Engineer ERP and Accounting System**.

مرحلة التنفيذ الحالية: نواة محاسبية مستقلة مع اختبارات للقيد المزدوج، اعتماد فاتورة بيع، فحص الفترة والمخزون، وعكس القيد. بقية الوحدات ستبنى فوق هذه النواة وليس كـ CRUD منفصل.

## تشغيل اختبارات النواة دون أي اعتماد خارجي

```powershell
node --test server/core/ledger.test.mjs
```

## تشغيل محلي

1. انسخ `.env.example` إلى `.env` واستبدل كلمات المرور بقيم قوية.
2. شغّل `docker compose up -d` ثم `npm run migrate`.
3. شغّل `npm run dev` لواجهة الويب وواجهة API.

لا تحفظ `.env` أو النسخ الاحتياطية أو مفاتيح الخدمات داخل Git.
