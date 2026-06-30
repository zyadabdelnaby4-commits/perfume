# Perfume Web

متجر عطور بسيط مع باك إند ولوحة إدارة.

## التشغيل

```powershell
cd D:\projects\perfume-web
npm start
```

افتح:

```text
http://127.0.0.1:4173/
```

لو البورت 4173 مشغول:

```powershell
$env:PORT="4174"; npm start
```

## لوحة الإدارة

```text
http://127.0.0.1:4173/admin.html
```

بيانات الدخول الافتراضية:

```text
Email: admin@perfume.local
Password: 123456
```

تقدر تغيّرهم قبل التشغيل:

```powershell
$env:ADMIN_EMAIL="your-email@example.com"
$env:ADMIN_PASSWORD="your-strong-password"
npm start
```

المنتجات بتتحفظ في:

```text
data/products.json
```
