const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const crypto = require("crypto");
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

dotenv.config();

const app = express();
const port = 3000;

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");


// ---- Supabase ----
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
const JWT_SECRET = process.env.JWT_SECRET;
const BUCKET = "profile-pics";

// ---- Basic env validation (helps catch wrong .env early) ----
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.warn(" Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
}
if (!JWT_SECRET) {
  console.warn(" Missing JWT_SECRET in .env");
}

// ---- Middleware ----
// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---- Auth middleware ----
function authenticateToken(req, res, next) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(403).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// ---- Pages ----
app.get("/pages/:page", (req, res) => {
  const page = req.params.page;
  if (path.extname(page)) return res.status(404).send("Invalid page");
  const filePath = path.join(__dirname, "public", "pages", `${page}.html`);
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) return res.status(404).send("Page not found");
    res.sendFile(filePath);
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---- Signup ----
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const { data: existing, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email);
    if (checkError) throw checkError;
    if (existing && existing.length > 0)
      return res.status(409).json({ message: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const { data: inserted, error } = await supabase
      .from("users")
      .insert([{ name, email, password: passwordHash }])
      .select("id,name,email")
      .single();
    if (error) throw error;

    const token = jwt.sign(
      { id: inserted.id, email: inserted.email },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    return res.status(201).json({
      message: "User registered successfully",
      token,
      user: inserted,
    });
  } catch (error) {
    console.error("Signup error:", error);
    // Helpful hint if column is missing
    if (
      String(error.message || "").includes("column") &&
      String(error.message || "").includes("image_path")
    ) {
      return res.status(500).json({
        message:
          "Database column users.image_path is missing — see setup notes below.",
      });
    }
    return res.status(500).json({ message: "Server error during signup" });
  }
});

// ---- Login ----
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });

  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id,name,email,password,image_path")
      .eq("email", email);
    if (error) throw error;
    if (!users || users.length === 0)
      return res.status(401).json({ message: "Invalid email or password" });

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid email or password" });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image_path: user.image_path || null,
      },
    });
  } catch (err) {
    console.error("Signin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});



app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");

  try {
    const ext = path.extname(req.file.originalname);
    const fileName = crypto.randomBytes(16).toString("hex") + ext;

    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    await s3.send(new PutObjectCommand(params));

    // Only send JSON; do NOT send HTML
    res.json({ message: "Upload successful", fileName });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Upload failed");
  }
});


// ---- Health check (optional) ----
app.get("/health", (_req, res) => res.json({ ok: true }));

// ---- Contact form route ----
app.post("/contact", async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required" });
  }

  try {
    // 1. Setup transporter (using Gmail here)
    const transporter = nodemailer.createTransport({
      service: "gmail", // change if using another provider
      auth: {
        user: process.env.EMAIL_USER, // your Gmail
        pass: process.env.EMAIL_PASS, // App Password (not normal password)
      },
    });

    // 2. Prepare email
    const mailOptions = {
      from: `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO, // your inbox
      subject: `[Portfolio] ${subject}`,
      text: `You received a new message from your website contact form:\n
Name: ${name}
Email: ${email}
Subject: ${subject}
Message: ${message}
      `,
      replyTo: email,
    };

    // 3. Send email
    await transporter.sendMail(mailOptions);
    // res.redirect("../public/index.html");
    res.json({ success: true, message: "Message sent successfully" });
  } catch (err) {
    console.error(" Email sending error:", err);
    res.status(500).json({ success: false, message: "Failed to send message" });
  }
});

app.get("/latest", async (req, res) => {
  try {
    const params = { Bucket: process.env.S3_BUCKET_NAME };
    const data = await s3.send(new ListObjectsV2Command(params));

    if (!data.Contents || data.Contents.length === 0) {
      return res.json({ message: "No files found" });
    }

    // Sort by LastModified (newest first)
    const sorted = data.Contents.sort(
      (a, b) => new Date(b.LastModified) - new Date(a.LastModified)
    );

    // Get signed URL for the latest image
    const latestFile = sorted[0];
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: latestFile.Key,
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    res.json({ latest: url, fileName: latestFile.Key });
  } catch (err) {
    console.error("Error fetching latest file:", err);
    res.status(500).send("Error retrieving latest file");
  }
});


app.get("/files", async (req, res) => {
  try {
    const params = { Bucket: process.env.S3_BUCKET_NAME };
    const data = await s3.send(new ListObjectsV2Command(params));

    if (!data.Contents) return res.json([]);

    const urls = await Promise.all(
      data.Contents.map(async (item) => {
        const command = new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: item.Key,
        });
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
        return url;
      })
    );

    res.json(urls);
  } catch (err) {
    console.error("Error fetching files:", err);
    res.status(500).send("Error retrieving files");
  }
});



app.listen(port, () => {
  console.log(` Server running at http://localhost:${port}`);
});
