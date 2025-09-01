const express = require("express");
const multer = require("multer");
const dotenv = require("dotenv");
const crypto = require("crypto");
const path = require("path");
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

dotenv.config();

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static("public"));

// S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload endpoint
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

    res.json({ message: "Upload successful" });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Upload failed");
  }
});

// Get all files with signed URLs
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

// Serve HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "fakeindex.html"));
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
