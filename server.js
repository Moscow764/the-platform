const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());

// 1. تقديم ملف styles.css بنوع MIME صريح ومضمون
app.get('/styles.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css');
  res.sendFile(path.join(__dirname, 'styles.css'));
});

// 2. تقديم ملف script.js بنوع MIME صريح
app.get('/script.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'script.js'));
});

// 3. خدمة بقية الملفات الساكنة
app.use(express.static(path.join(__dirname)));

// 4. مسارات الـ API لقراءة الكورسات والطلاب
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

// 5. الصفحة الرئيسية
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// التشغيل المحلي
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
