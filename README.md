# Hazori - حضوري
مشروع تسجيل حضور المتدربين (Backend + Frontend) جاهز للنشر على Render (مجاني) أو أي استضافة تدعم Node.js.

## مميزات
- تسجيل الحضور بموقع جغرافي (geofence 100m حول إحداثيات المعهد)
- لوحة تحكم بسيطة بإمكانك التحكم بفتح/إغلاق التحضير عبر `ADMIN_CODE`
- استيراد متدربين من ملف Excel
- تصدير تقارير PDF مفصّلة لكل قسم أو الجميع
- تقييد تسجيل جهاز واحد عن طريق `device_id` في المتصفح

## ملفات مهمة
- `index.js` — الخادم (Express + Knex)
- `package.json` — تبعيات + start script
- `public/index.html` — واجهة التسجيل

## متطلبات نشر (Render)
1. سجل حساب مجاناً في https://render.com
2. أنشئ مستودع جديد على GitHub وادفع (push) محتويات هذا المشروع إليه.
3. في صفحة Render: Create -> Web Service
   - Connect your GitHub repo
   - Build Command: `npm install`
   - Start Command: `npm start`
4. إعداد متغيرات البيئة في Render:
   - `DATABASE_URL` — رابط قاعدة بيانات PostgreSQL (Render يوفر قاعدة مجانية عند إضافة Database)
   - `ADMIN_CODE` — رمز المدير (مثلاً: 1234567890)
5. اضغط Deploy

## نشر قاعدة بيانات (Postgres) في Render
- في Render: New -> Database -> PostgreSQL
- انسخ `DATABASE_URL` وأضفه إلى متغيرات بيئة خدمة الويب.

## استخدام محلي
1. تحتاج PostgreSQL محلي أو يمكنك تعديل `index.js` لاستخدام SQLite للتجربة.
2. تثبيت الحزم:
   ```
   npm install
   ```
3. تشغيل:
   ```
   ADMIN_CODE=1234567890 DATABASE_URL=postgres://user:pass@host:port/dbname npm start
   ```

## ملاحظات أمان وخصوصية
- فعّل HTTPS (Render يفعل تلقائياً).
- خزّن `ADMIN_CODE` في متغيرات البيئة، لا تتركه في الكود.
- لقيود أشد على الأجهزة استخدم OTP عبر SMS.

## أسئلة أو طلب تعديلات
إذا تريد، أقدر:
- أجهز لك repo جاهز على GitHub (أعطني اسم المستخدم واسم الريبو) *ملاحظة: ستحتاج لمنحني إذن أو تقوم أنت بالربط لأنني لا أستطيع الوصول إلى حساب GitHub الخاص بك دون صلاحيات.*
- أقدّم ملف ZIP هنا جاهز للتنزيل (مضمن داخل هذا الحزمة).
