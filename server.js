const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // أو المجلد الذي يحتوي ملفات HTML/CSS

// تأكد من استخدام path.join عند قراءة أي ملفات JSON محلية
// مثال: fs.readFileSync(path.join(__dirname, 'students.json'))

// التصدير الخاص بـ Vercel Serverless
module.exports = app;

// التشغيل المحلي فقط
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
// إذا كانت ملفات الـ HTML والـ CSS في مجلد المشروع الرئيسي مباشرة:
app.use(express.static(__dirname));

// أو إذا كان لديك مسار محدد للصفحة الرئيسية (مثلاً index.html):
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
