const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const nodemailer = require("nodemailer");

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const app = express();
const port = process.env.PORT || 3000;

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
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|jpg|png|webp|gif)/.test(file.mimetype);
    cb(
      ok
        ? null
        : new Error("Only images (jpeg, jpg, png, webp, gif) are allowed")
    );
  },
});

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

app.post(
  "/upload",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    console.log("---- UPLOAD REQUEST START ----");

    // 1. Check Auth
    console.log("Auth header:", req.headers["authorization"]);
    console.log("Decoded user from token:", req.user);

    console.log("headers:", req.headers);
    console.log("body:", req.body);
    console.log("file:", req.file);

    // 2. Check File
    if (!req.file) {
      console.warn(" Multer did not receive a file");
      return res
        .status(400)
        .json({ message: "No file received. Did you select a file?" });
    }

    console.log("File received by multer:");
    console.log("  originalname:", req.file.originalname);
    console.log("  mimetype:", req.file.mimetype);
    console.log("  size:", req.file.size);

    try {
      const userId = req.user.id;
      const safeName = (req.file.originalname || "upload").replace(
        /[^\w.\-]+/g,
        "_"
      );
      const filePath = `${userId}/${Date.now()}_${safeName}`;

      // 3. Upload to Supabase
      console.log("Uploading to Supabase bucket:", BUCKET);
      console.log("File path:", filePath);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error(" Supabase upload error:", uploadError);
        return res
          .status(500)
          .json({ message: "Error uploading image to Supabase" });
      }

      // 4. Save file path in DB
      const { error: updateError } = await supabase
        .from("users")
        .update({ image_path: filePath })
        .eq("id", userId);

      if (updateError) {
        console.error(" DB update error:", updateError);
        return res
          .status(500)
          .json({ message: "Error saving image path in DB" });
      }

      // 5. Get public URL
      const { data, error } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(filePath);
      if (error) throw error; // usually undefined, but good to check
      const publicURL = data.publicUrl;

      console.log("Upload finished. Public URL:", publicURL);
      console.log("---- UPLOAD REQUEST END ----");

      return res.status(200).json({
        message: "Image uploaded successfully",
        imageUrl: publicURL,
      });
    } catch (error) {
      console.error(" Unexpected server error:", error);
      return res.status(500).json({ message: "Server error during upload" });
    }
  }
);

// ---- Get profile picture URL ----
app.get("/profile-pic/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("image_path")
      .eq("id", userId)
      .single();

    if (error) throw error;
    if (!user || !user.image_path)
      return res.status(404).json({ message: "Profile picture not found" });

    const { data: pub } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(user.image_path);
    return res.json({ imageUrl: pub.publicUrl });
  } catch (err) {
    console.error("Fetch error:", err);
    // Helpful hint if column missing
    if (
      String(err.message || "").includes("column") &&
      String(err.message || "").includes("image_path")
    ) {
      return res.status(500).json({
        message:
          "Database column users.image_path is missing — see setup notes below.",
      });
    }
    return res.status(500).json({ message: "Server error fetching image" });
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

app.listen(port, () => {
  console.log(` Server running at http://localhost:${port}`);
});
