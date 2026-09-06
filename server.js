const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());

// خدمة الملفات الساكنة من المجلد الرئيسي
app.use(express.static(path.join(__dirname)));

// مسارات الـ API لقراءة الكورسات والطلاب
app.get('/api/courses', (req, res) => {
  const filePath = path.join(__dirname, 'courses.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read courses' });
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  });
});

app.get('/api/admin/students', (req, res) => {
  const filePath = path.join(__dirname, 'students.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read students' });
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  });
});

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
