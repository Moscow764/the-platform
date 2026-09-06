/**
 * ============================================================
 * منصة مستر أحمد ثابت — Backend Server
 * Express + JSON file storage (no external database).
 *
 * Run:  npm install   ثم   npm start
 * Admin panel: /key.html  (يحتاج مفتاح الأدمن، راجع ADMIN_KEY تحت)
 * ============================================================
 */

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10174;

/**
 * غيّر المفتاح ده قبل ما تنزل الموقع فعليًا على الإنترنت.
 * أي حد يعرف المفتاح ده يقدر يدخل لوحة التحكم /key.html
 */
const ADMIN_KEY = process.env.ADMIN_KEY || 'thabet-admin-2026';

const DATA_DIR = path.join(__dirname, 'data');
const STUDENTS_FILE = path.join(DATA_DIR, 'users.json');
const COURSES_FILE = path.join(DATA_DIR, 'courses.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ------------------------------------------------------------
// JSON file helpers (simple, synchronous — fine for this scale)
// ------------------------------------------------------------
function readJSON(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    return [];
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ------------------------------------------------------------
// Validation helpers
// ------------------------------------------------------------
// رقم مصري صحيح: يبدأ بـ 01 ثم 0 أو 1 أو 2 أو 5 ثم 8 أرقام (11 رقم إجمالاً)
const EGYPT_PHONE_REGEX = /^01[0125][0-9]{8}$/;

function isValidEgyptianPhone(phone) {
  return typeof phone === 'string' && EGYPT_PHONE_REGEX.test(phone.trim());
}

function generateUniqueOtp(existingStudents) {
  const used = new Set(
    existingStudents
      .filter((s) => s.otp)
      .map((s) => String(s.otp))
  );
  let code;
  do {
    code = String(crypto.randomInt(100000, 1000000)); // 6 digits, no leading-zero collapse
  } while (used.has(code));
  return code;
}

function publicStudent(s) {
  // Never leak password/otp/sessionToken/id-internal fields to the wrong endpoint
  const { firstName, lastName, grade, governorate, school, phone, status } = s;
  return { firstName, lastName, grade, governorate, school, phone, status };
}

// ------------------------------------------------------------
// Multer (course image upload)
// ------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `course-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('نوع الصورة غير مدعوم'));
  }
});

// ------------------------------------------------------------
// Middleware
// ------------------------------------------------------------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key && key === ADMIN_KEY) return next();
  return res.status(401).json({ success: false, message: 'مفتاح الأدمن غير صحيح' });
}

// ============================================================
// PUBLIC: courses
// ============================================================
app.get('/api/courses', (req, res) => {
  const courses = readJSON(COURSES_FILE);
  const { grade } = req.query;
  const filtered = grade ? courses.filter((c) => c.grade === grade) : courses;
  res.json({ success: true, courses: filtered });
});

app.get('/api/courses/:id', (req, res) => {
  const courses = readJSON(COURSES_FILE);
  const course = courses.find((c) => c.id === req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'الكورس غير موجود' });
  res.json({ success: true, course });
});

// ============================================================
// PUBLIC: registration
// ============================================================
app.post('/api/register', (req, res) => {
  const { firstName, lastName, phone, password, grade, governorate, school } = req.body || {};

  if (!firstName || !lastName || !phone || !password || !grade) {
    return res.status(400).json({ success: false, message: 'من فضلك أكمل كل الحقول المطلوبة' });
  }
  if (!isValidEgyptianPhone(phone)) {
    return res.status(400).json({ success: false, message: 'رقم الهاتف لازم يكون رقم مصري صحيح (01 + 9 أرقام)' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ success: false, message: 'كلمة السر لازم تكون 8 أحرف على الأقل' });
  }

  const students = readJSON(STUDENTS_FILE);
  const exists = students.find((s) => s.phone === phone.trim() && s.status !== 'rejected');
  if (exists) {
    return res.status(409).json({ success: false, message: 'رقم الهاتف ده مسجل بالفعل' });
  }

  const newStudent = {
    id: crypto.randomUUID(),
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    phone: phone.trim(),
    password: String(password), // ملحوظة: تخزين مبسّط بدون تشفير — راجع ملاحظات الأمان في README
    grade,
    governorate: governorate || '',
    school: school || '',
    status: 'pending', // pending -> approved / rejected
    otp: null,
    sessionToken: null,
    createdAt: new Date().toISOString()
  };

  students.push(newStudent);
  writeJSON(STUDENTS_FILE, students);

  res.json({
    success: true,
    message: 'تم إرسال طلبك بنجاح. هيتم مراجعته والموافقة عليه، وهيوصلك كود دخول من المستر بعد القبول.'
  });
});

// ============================================================
// PUBLIC: login with phone + OTP
// ============================================================
app.post('/api/login', (req, res) => {
  const { phone, otp } = req.body || {};

  if (!isValidEgyptianPhone(phone)) {
    return res.status(400).json({ success: false, message: 'رقم الهاتف لازم يكون رقم مصري صحيح' });
  }
  if (!otp || String(otp).trim().length !== 6) {
    return res.status(400).json({ success: false, message: 'كود الدخول لازم يكون 6 أرقام' });
  }

  const students = readJSON(STUDENTS_FILE);
  const student = students.find((s) => s.phone === phone.trim());

  if (!student) {
    return res.status(404).json({ success: false, message: 'مفيش حساب مسجل بالرقم ده' });
  }
  if (student.status === 'pending') {
    return res.status(403).json({ success: false, message: 'طلبك لسه تحت المراجعة من المستر' });
  }
  if (student.status === 'rejected') {
    return res.status(403).json({ success: false, message: 'تم رفض طلبك، تواصل مع المستر لمزيد من التفاصيل' });
  }
  if (String(student.otp) !== String(otp).trim()) {
    return res.status(401).json({ success: false, message: 'كود الدخول غير صحيح' });
  }

  const token = crypto.randomUUID();
  student.sessionToken = token;
  writeJSON(STUDENTS_FILE, students);

  res.json({ success: true, token, firstName: student.firstName, lastName: student.lastName });
});

// ============================================================
// PUBLIC (token-based): logged-in student data
// ============================================================
app.get('/api/student', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(401).json({ success: false, message: 'محتاج تسجل الدخول' });

  const students = readJSON(STUDENTS_FILE);
  const student = students.find((s) => s.sessionToken === token && s.status === 'approved');

  if (!student) return res.status(401).json({ success: false, message: 'جلسة غير صالحة، سجل دخول تاني' });

  res.json({ success: true, student: publicStudent(student) });
});

// ============================================================
// ADMIN: students (pending / approved / rejected)
// ============================================================
app.get('/api/admin/students', requireAdmin, (req, res) => {
  const students = readJSON(STUDENTS_FILE).map((s) => {
    // إخفاء كلمة السر فقط، وإظهار الباقي (بما فيه كود الدخول) للأدمن
    const { password, ...rest } = s;
    return rest;
  });
  res.json({ success: true, students });
});

app.post('/api/admin/approve/:id', requireAdmin, (req, res) => {
  const students = readJSON(STUDENTS_FILE);
  const student = students.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ success: false, message: 'الطالب غير موجود' });

  student.otp = generateUniqueOtp(students);
  student.status = 'approved';
  student.approvedAt = new Date().toISOString();
  writeJSON(STUDENTS_FILE, students);

  res.json({
    success: true,
    message: 'تم قبول الطالب، ابعتله الكود ده يدويًا (واتساب/مكالمة):',
    otp: student.otp
  });
});

app.post('/api/admin/reject/:id', requireAdmin, (req, res) => {
  const students = readJSON(STUDENTS_FILE);
  const student = students.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ success: false, message: 'الطالب غير موجود' });

  student.status = 'rejected';
  student.otp = null;
  writeJSON(STUDENTS_FILE, students);
  res.json({ success: true });
});

app.delete('/api/admin/students/:id', requireAdmin, (req, res) => {
  let students = readJSON(STUDENTS_FILE);
  students = students.filter((s) => s.id !== req.params.id);
  writeJSON(STUDENTS_FILE, students);
  res.json({ success: true });
});

// ============================================================
// ADMIN: course management (create / update / delete)
// ============================================================
app.post('/api/admin/courses', requireAdmin, upload.single('image'), (req, res) => {
  const { title, description, grade, price, tag, lecturesJson } = req.body;
  if (!title || !grade) {
    return res.status(400).json({ success: false, message: 'العنوان والصف الدراسي مطلوبين' });
  }

  let lectures = [];
  try {
    lectures = lecturesJson ? JSON.parse(lecturesJson) : [];
  } catch (e) {
    lectures = [];
  }

  const courses = readJSON(COURSES_FILE);
  const newCourse = {
    id: 'c-' + crypto.randomBytes(5).toString('hex'),
    title,
    description: description || '',
    grade,
    price: price || 'مجاني',
    tag: tag || '',
    image: req.file ? `/uploads/${req.file.filename}` : '/assets/logo.png',
    lectures
  };
  courses.push(newCourse);
  writeJSON(COURSES_FILE, courses);
  res.json({ success: true, course: newCourse });
});

app.put('/api/admin/courses/:id', requireAdmin, upload.single('image'), (req, res) => {
  const courses = readJSON(COURSES_FILE);
  const course = courses.find((c) => c.id === req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'الكورس غير موجود' });

  const { title, description, grade, price, tag, lecturesJson } = req.body;
  if (title) course.title = title;
  if (description !== undefined) course.description = description;
  if (grade) course.grade = grade;
  if (price) course.price = price;
  if (tag !== undefined) course.tag = tag;
  if (lecturesJson) {
    try { course.lectures = JSON.parse(lecturesJson); } catch (e) {}
  }
  if (req.file) {
    // امسح الصورة القديمة لو كانت مرفوعة (مش placeholder)
    if (course.image && course.image.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, course.image);
      fs.unlink(oldPath, () => {});
    }
    course.image = `/uploads/${req.file.filename}`;
  }

  writeJSON(COURSES_FILE, courses);
  res.json({ success: true, course });
});

app.delete('/api/admin/courses/:id', requireAdmin, (req, res) => {
  let courses = readJSON(COURSES_FILE);
  const course = courses.find((c) => c.id === req.params.id);
  if (course && course.image && course.image.startsWith('/uploads/')) {
    fs.unlink(path.join(__dirname, course.image), () => {});
  }
  courses = courses.filter((c) => c.id !== req.params.id);
  writeJSON(COURSES_FILE, courses);
  res.json({ success: true });
});

// ------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ منصة أحمد ثابت شغالة على http://78.154.103.10:${PORT}`);
  console.log(`🔑 لوحة التحكم: http://78.154.103.10:${PORT}/key.html  (مفتاح الأدمن: ${ADMIN_KEY})`);
});