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
// Example: Upload a local image file
const fileBuffer = fs.readFileSync('profile.png')

const { data, error } = await supabase.storage
  .from('profile-pics')   // bucket name
  .upload('avatars/profile.png', fileBuffer, {
    contentType: 'image/png'
  })

if (error) console.error(error)
else console.log("Uploaded:", data)