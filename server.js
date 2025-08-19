const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 3000;

// Supabase init
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware
const storage = multer.memoryStorage();
const upload = multer({ storage });
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(403).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}


// Route: Static pages from /public/pages
app.get('/pages/:page', (req, res) => {
    const page = req.params.page;
    if (path.extname(page)) return res.status(404).send("Invalid page");
    const filePath = path.join(__dirname, 'public', 'pages', `${page}.html`);
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) return res.status(404).send("Page not found");
        res.sendFile(filePath);
    });
});

// Route: Home
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route: Signup
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'All fields are required' });

  try {
    // unique email check
    const { data: existing, error: checkError } = await supabase
      .from('users').select('id').eq('email', email);
    if (checkError) throw checkError;
    if (existing && existing.length > 0) return res.status(409).json({ message: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const { data: inserted, error } = await supabase
      .from('users')
      .insert([{ name, email, password: passwordHash }])
      .select('id,name,email')
      .single();
    if (error) throw error;

    const token = jwt.sign({ id: inserted.id, email: inserted.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: inserted
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ message: 'Server error during signup' });
  }
});

// // Route: Login
// const jwt = require('jsonwebtoken');

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  try {
    const { data: users, error } = await supabase.from('users').select('id,name,email,password').eq('email', email);
    if (error) throw error;
    if (!users || users.length === 0) return res.status(401).json({ message: 'Invalid email or password' });

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });

    // Do NOT redirect here—frontend will navigate after receiving token
    return res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Signin error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});



app.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  const file = req.file;
  const userId = req.user.id;

  if (!file) return res.status(400).json({ message: 'No file selected' });

  try {
    const fileName = `${userId}/${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
    // Upload to bucket folder "profile-pics"
    const { error: uploadError } = await supabase.storage
      .from('profile-pics')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false // keep history; set true if you want overwrite
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ message: 'Error uploading image' });
    }

    // Save storage path (not just public URL)
    const { error: updateError } = await supabase
      .from('users')
      .update({ image_path: fileName }) // prefer image_path over image_url
      .eq('id', userId);

    if (updateError) {
      console.error('DB update error:', updateError);
      return res.status(500).json({ message: 'Error saving image path' });
    }

    // Generate fresh public URL
    const { data } = supabase.storage.from('profile-pics').getPublicUrl(fileName);
    const publicURL = data.publicUrl;

    return res.status(200).json({
      message: 'Image uploaded successfully',
      imageUrl: publicURL
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ message: 'Server error during upload' });
  }
});


// Route: Get Profile Picture URL
app.get('/profile-pic/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('image_path')
      .eq('id', userId)
      .single();

    if (error) throw error;
    if (!user || !user.image_path) return res.status(404).json({ message: 'Profile picture not found' });

    const { data } = supabase.storage.from('profile-pics').getPublicUrl(user.image_path);
    // Redirect or send JSON
    return res.redirect(data.publicUrl);
    // or: return res.json({ imageUrl: data.publicUrl });
  } catch (err) {
    console.error('Fetch error:', err);
    return res.status(500).json({ message: 'Server error fetching image' });
  }
});


// ✅ GET IN TOUCH FORM (Send Email)
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      replyTo: email,
      to: process.env.CONTACT_RECEIVER,
      subject: `Contact Form: ${name}`,
      text: message
    };

    await transporter.sendMail(mailOptions);
    return res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});


app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
});
