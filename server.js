const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

// خدمة الملفات الساكنة (HTML / CSS / JS) من المجلد الرئيسي
app.use(express.static(__dirname));

// مسار الصفحة الرئيسية
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// التشغيل المحلي فقط
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// التصدير الخاص بـ Vercel (يجب أن يكون في النهاية تماماً)
module.exports = app;
