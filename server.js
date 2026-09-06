const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

// خدمة الملفات الساكنة من المجلد الرئيسي
app.use(express.static(path.join(__dirname)));

// مسار الصفحة الرئيسية
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// التشغيل المحلي
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
