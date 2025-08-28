// const express = require('express');
// const multer = require('multer');
// const mysql = require('mysql2');
// const fs = require('fs');
// const path = require('path');
// const bcrypt = require('bcryptjs'); // For password hashing
// const jwt = require('jsonwebtoken'); // For creating and verifying tokens
// const cors = require('cors'); 
// const supabase = require('./supabaseClient');
// require('dotenv').config();
// const app = express();

// const port = 3000;

// app.use(express.static('public'));
// app.use(express.static(path.join(__dirname, 'public')));

// app.use('/uploads',express.static('uploads'));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// // Enable CORS for all origins (for development, restrict in production)
// app.use(cors());
// // Parse JSON request bodies
// app.use(express.json());


// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });
// const users = [];
// const JWT_SECRET = 'your_super_secret_jwt_key_12345';


// // MySQL connection
// const db = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: '',
//     database: 'mydb'
// });



// db.connect(err => {
//     if (err) throw err;
//     console.log("MySQL Connected...");
// });

// db.connect(function(err) {
//   if (err) throw err;
//   console.log("Connected!");
// //   let sql = "CREATE TABLE Recruiters (id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(255) NOT NULL,email VARCHAR(255) NOT NULL UNIQUE,password_hash VARCHAR(255) NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"
// // let sql = "ALTER TABLE files ADD COLUMN user_id INT;"; 
// let sql= "ALTER TABLE files MODIFY COLUMN data LONGBLOB;";

// db.query(sql, function (err, result) {
//     if (err) throw err;
//     console.log(result);
//   });
// });

// app.get('/pages/:page', (req, res) => {
//   const page = req.params.page;

//   // Only allow `.html` files, reject if anything else is requested
//   if (path.extname(page)) {
//     return res.status(404).send("Not found");
//   }

//   const filePath = path.join(__dirname, 'public', 'pages', `${page}.html`);

//   fs.access(filePath, fs.constants.F_OK, (err) => {
//     if (err) {
//       return res.status(404).send("Page not found");
//     }
//     res.sendFile(filePath);
//   });
// });




// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname,'public','index.html'));
// });

// app.post('/upload', upload.single('file'), (req, res) => {
//     const file = req.file;
//     const userId = req.body.userId;

//     if (!file || !userId) return res.status(400).send("Please select a image file");

//     // Check if user already has a profile picture
//     const checkSql = "SELECT * FROM files WHERE user_id = ?";
//     db.query(checkSql, [userId], (checkErr, checkResult) => {
//         if (checkErr) {
//             console.error("DB check error:", checkErr);
//             return res.status(500).send("Error checking existing profile picture.");
//         }

//         if (checkResult.length > 0) {
//             // User already has a profile picture - update it
//             const updateSql = "UPDATE files SET name = ?, type = ?, data = ? WHERE user_id = ?";
//             db.query(updateSql, [file.originalname, file.mimetype, file.buffer, userId], (updateErr, updateResult) => {
//                 if (updateErr) {
//                     console.error("DB update error:", updateErr);
//                     return res.status(500).send("Error updating profile picture.");
//                 }
//                 res.redirect('/index.html'); // or send a JSON response
//             });
//         } else {
//             // No profile picture yet - insert a new one
//             const insertSql = "INSERT INTO files (name, type, data, user_id) VALUES (?, ?, ?, ?)";
//             db.query(insertSql, [file.originalname, file.mimetype, file.buffer, userId], (insertErr, insertResult) => {
//                 if (insertErr) {
//                     console.error("DB insert error:", insertErr);
//                     return res.status(500).send("Error uploading profile picture.");
//                 }
//                 res.redirect('/dashboard.html');
//             });
//         }
//     });
// });





// app.post('/signup', async (req, res) => {
//     const { name, email, password,confirm_Password } = req.body;

//     // Basic input validation
//     if (!name || !email || !password) {
//         return res.status(400).json({ message: 'Please enter all fields' });
//     }

//     // Check if user already exists
//     const existingUser = users.find(user => user.email === email);
//     if (existingUser) {
//         return res.status(400).json({ message: 'User with that email already exists' });
//     }

//     try {
//         // Hash password
//         const salt = await bcrypt.genSalt(10); // Generate a salt
//         const passwordHash = await bcrypt.hash(password, salt); // Hash the password with the salt

//         // Create new user object
//         const newUser = {
//             id: users.length + 1, // Simple ID generation
//             name,
//             email,
//             passwordHash ,// Store the hashed password
            
//         };

//         // Save user to our "database"
//         users.push(newUser);

//         console.log('New user registered:', newUser); // Log for debugging

//         res.redirect('/pages/signin.html'); // Redirect to signin page after successful signup
//         // Respond with success message
//         // res.status(201).json({ message: 'User registered successfully!' });

//     } catch (error) {
//         console.error('Signup error:', error);
//         res.status(500).json({ message: 'Server error during signup' });
//     }
// });


// app.post('/login', async (req, res) => {
//     const { email, password } = req.body;

//     // Basic input validation
//     if (!email || !password) {
//         return res.status(400).json({ message: 'Please enter all fields' });
//     }

//     // Find user by email
//     const user = users.find(u => u.email === email);
//     if (!user) {
//         return res.status(400).json({ message: 'Invalid credentials' });
//     }

//     try {
//         // Compare provided password with stored hashed password
//         const isMatch = await bcrypt.compare(password, user.passwordHash);
//         if (!isMatch) {
//             return res.status(400).json({ message: 'Invalid credentials' });
//         }

//         // User is authenticated, create a JWT
//         // The payload typically contains user information (e.g., user ID, email)
//         // that you want to retrieve later without hitting the database.
//         const payload = {
//             user: {
//                 id: user.id,
//                 email: user.email
//             }
//         };

//         // Sign the token
//         jwt.sign(
//             payload,
//             JWT_SECRET,
//             { expiresIn: '1h' }, // Token expires in 1 hour
//             (err, token) => {
//                 if (err) throw err;
//                 res.redirect('/pages/upload.html'); // Redirect to dashboard after successful login
//                 // Send the token back to the client
//                 // res.json({ message: 'Logged in successfully!', token });
//             }
//         );

//     } catch (error) {
//         console.error('Login error:', error);
//         res.status(500).json({ message: 'Server error during login' });
//     }
// });




// app.get('/file/:id', (req, res) => {
//     const id = req.params.id;
//     const sql = "SELECT * FROM files WHERE user_id = ?";
//     db.query(sql, [id], (err, result) => {
//         if (err) {
//             console.error("DB fetch error:", err);
//             return res.status(500).send("Error retrieving file.");
//         }
//         if (result.length === 0) {
//             return res.status(404).send("File not found");
//         }

//         res.setHeader('Content-Type', result[0].type);
//         res.send(result[0].data);
//     });
// });



// // app.use('/file', express.static(path.join(__dirname, 'uploads')));

// // app.get('*', (req, res) => {
// //   res.sendFile(path.join(__dirname, 'public/index.html'));
// // });

// app.listen(port, () => {
//     console.log(`Server running at http://localhost:${port}`);
// });


