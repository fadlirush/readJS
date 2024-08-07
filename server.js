const express = require("express");
const replaceNCInFile = require('./r');
const multer = require("multer");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs").promises;
const bcrypt = require('bcrypt');
const session = require('express-session');
const processFile = require("./processFile");
const { readKeywords, readErrorLines } = require("./readKeywords");
const addNewRows = require("./addNewRows");
const rateLimit = require("express-rate-limit");

const app = express();
const upload = multer({ dest: "uploads/" });
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiting to prevent brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: "Salah teruss, tunggu dulu 15 menit!",
});

app.use(session({
  secret: 'implementasipatrick123$%^',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Ubah ke `true` jika menggunakan HTTPS
}));

let activeSessions = new Set(); // To track active sessions

// Rute login
app.get("/", (req, res) => {
  if (req.session.loggedIn) {
    res.redirect('/index');  // Jika sudah login, redirect ke /index
  } else {
    res.render("log", { error: null });  // Jika belum login, render halaman login
  }
});
app.get("/disclaimer", (req, res) => {
  res.render("d");
});

async function loadUsers() {
  const data = await fs.readFile(path.join(__dirname, 'users.json'), 'utf8');
  return JSON.parse(data);
}

app.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  try {
    const users = await loadUsers();
    const user = users.find(u => u.username === username);
    
    // Compare the plain text password with the hashed password stored in JSON
    if (user && await bcrypt.compare(password, user.password)) {
      if (activeSessions.has(username)) {
        return res.render("log", { error: "Udah ada yang login pake akun ini." });
      }
      req.session.loggedIn = true;
      req.session.username = username;
      activeSessions.add(username);
      res.redirect('/index');
    } else {
      res.render("log", { error: "Salah username atau password." });
    }
  } catch (err) {
    console.error('Error reading users.json:', err);
    res.status(500).send('Internal server error');
  }
});

function ensureLoggedIn(req, res, next) {
  if (req.session.loggedIn) {
    next();
  } else {
    res.redirect('/');
  }
}

app.get('/index', ensureLoggedIn, (req, res) => {
  res.render('index');
});

app.get('/logout', (req, res) => {
  const { username } = req.session;

  req.session.destroy(err => {
    if (err) {
      console.error('Error logging out:', err);
      res.status(500).send('Error logging out');
    } else {
      activeSessions.delete(username);
      res.redirect('/');
    }
  });
});

app.post(
  "/upload",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "comparisonFile", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const inputFilePath = req.files.file[0].path;
      const comparisonFilePath = req.files.comparisonFile[0].path;
      const outputFilePath = path.join(
        "uploads",
        `${req.files.file[0].originalname}`
      );

      const comparisonKeywords = await readKeywords(comparisonFilePath);
      const errorLines = await readErrorLines(comparisonFilePath);
      const { removedLinesCount, removedKeywords, remainingKeywords } =
        await processFile(
          inputFilePath,
          outputFilePath,
          comparisonKeywords,
          errorLines
        );

      res.json({
        success: true,
        removedLinesCount,
        removedKeywords,
        remainingKeywords,
        downloadUrl: `/download/${path.basename(outputFilePath)}`,
      });
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  "/addNewRows",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "notificationFile", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const inputFilePath = req.files.file[0].path;
      const notificationFilePath = req.files.notificationFile[0].path;
      const outputFilePath = path.join(
        "uploads",
        `${req.files.file[0].originalname}`
      );

      await addNewRows(inputFilePath, notificationFilePath, outputFilePath);

      res.json({
        success: true,
        downloadUrl: `/download/${path.basename(outputFilePath)}`,
      });
    } catch (err) {
      next(err);
    }
  }
);
app.post(
  "/retur",
  upload.fields([
    { name: "file", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const inputFilePath = req.files.file[0].path;
      const outputFilePath = path.join(
        "uploads",
        `${req.files.file[0].originalname}`
      );

      const result = await replaceNCInFile(inputFilePath, outputFilePath);

      if (result.success) {
        res.json({
          success: true,
          downloadUrl: `/download/${path.basename(outputFilePath)}`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      next(err);
    }
  }
);
app.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "uploads", filename);
  res.download(filePath, (err) => {
    if (err) {
      console.error("Error downloading file:", err);
      res.status(500).send("Error downloading file");
    } else {
      fs.unlink(filePath).catch(console.error);
    }
  });
});

// General error handling middleware
app.use((err, req, res, next) => {
  console.error("Error processing file:", err);
  res.status(500).json({ success: false, error: "Error processing file" });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
