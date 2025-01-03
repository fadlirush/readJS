const express = require("express");
const replaceNCInFile = require("./r");
const multer = require("multer");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs").promises;
const bcrypt = require("bcrypt");
const session = require("express-session");
const processFile = require("./processFile");
const jwt = require("jsonwebtoken");
const { readKeywords, readErrorLines } = require("./readKeywords");
const addNewRows = require("./addNewRows");
const rateLimit = require("express-rate-limit");
const JWT_SECRET = "your_jwt_secret_key";
const app = express();
const cookieParser = require("cookie-parser");
const authMiddleware = require("./authMiddleware");
const upload = multer({ dest: "uploads/" });
const SESSION_DURATION = 5 * 60 * 1000;
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 5 login requests per windowMs
  message: "Salah teruss, tunggu dulu 15 menit!",
});
let userTokens = new Map();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: "implementasipatrick123$%^",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);
// General error handling middleware
app.use((err, req, res, next) => {
  console.error("Error processing file:", err);
  res.status(500).json({ success: false, error: "Error processing file" });
});

let activeSessions = new Set(); // To track active sessions

function cleanupExpiredSessions() {
  for (let username of activeSessions) {
    const token = userTokens.get(username);
    try {
      jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        activeSessions.delete(username);
        userTokens.delete(username);
        console.log(`Sesi untuk pengguna ${username} Kadaluwarsa`);
      }
    }
  }
}

setInterval(cleanupExpiredSessions, 10000);
async function loadUsers() {
  const data = await fs.readFile(path.join(__dirname, "users.json"), "utf8");
  return JSON.parse(data);
}
function checkCreateUserAccess(req, res, next) {
  if (req.session && req.session.username === "dilan") {
    next();
  } else {
    res.status(403).send("Dilarang: Kamu Gak punya akses.");
  }
}

// route list
app.get("/", (req, res) => {
  if (req.session.loggedIn) {
    res.redirect("/gate");
  } else {
    res.render("log", { error: null });
  }
});
app.get("/disclaimer", (req, res) => {
  res.render("d");
});
app.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  try {
    const users = await loadUsers();
    const user = users.find((u) => u.username === username);
    if (!user) {
      console.log("Pengguna tidak ditemukan:", username);
      return res
        .status(401)
        .json({ error: "Salah nama pengguna atau kata sandi." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      if (activeSessions.has(username)) {
        return res.status(400).json({
          error: "Sudah ada yang masuk dengan akun ini.",
        });
      }
      const token = jwt.sign({ username: user.username }, JWT_SECRET, {
        expiresIn: "5m",
      });
      userTokens.set(username, token);
      res.cookie("token", token, { httpOnly: true, maxAge: SESSION_DURATION });
      activeSessions.add(username);
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Salah nama pengguna atau kata sandi." });
    }
  } catch (err) {
    console.error("Galat saat login:", err);
    res.status(500).json({ error: "Penyedia layanan galat" });
  }
});
app.get("/create-user", checkCreateUserAccess, (req, res) => {
  res.render("making");
});

// Route to handle user creation form submission
app.post("/create-user", checkCreateUserAccess, (req, res) => {
  const { username, password } = req.body;

  if (users.find((u) => u.username === username)) {
    res.send("Pengguna sudah ada.");
  } else {
    const hashedPassword = bcrypt.hashSync(password, 10);
    users.push({ username, password: hashedPassword });

    // Save the updated users to the JSON file
    fs.writeFile(usersFile, JSON.stringify(users, null, 2));
    res.send("Pengguna berhasil dibuat.");
  }
});

app.get("/gate", authMiddleware, (req, res) => {
  res.render("gate");
});

app.post("/logout", (req, res) => {
  const token = req.cookies.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      activeSessions.delete(decoded.username);
    } catch (err) {
      console.error("Galat saat membuat token:", err);
    }
  }
  res.clearCookie("token");
  res.json({ success: true });
});

app.post(
  "/upload",
  authMiddleware,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "comparisonFile", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const inputFilePath = req.files.file[0].path;
      const outputFilePath = path.join(
        "uploads",
        `${req.files.file[0].originalname}`
      );

      let comparisonKeywords = new Set();
      let errorLines = new Set();
      let keepKeywords = null;

      // Handle keep sales orders input
      if (req.body.keepSalesOrders) {
        keepKeywords = new Set(
          req.body.keepSalesOrders.split(",").map((so) => so.trim())
        );
      }
      // Handle removal sales orders input
      else if (req.body.manualSalesOrders) {
        comparisonKeywords = new Set(
          req.body.manualSalesOrders.split(",").map((so) => so.trim())
        );
      }
      // Handle notification file
      else if (req.files.comparisonFile) {
        const comparisonFilePath = req.files.comparisonFile[0].path;
        comparisonKeywords = await readKeywords(comparisonFilePath);
        errorLines = await readErrorLines(comparisonFilePath);
        await fs.unlink(comparisonFilePath);
      }

      const { removedLinesCount, removedKeywords, remainingKeywords } =
        await processFile(
          inputFilePath,
          outputFilePath,
          comparisonKeywords,
          errorLines,
          keepKeywords
        );

      res.json({
        success: true,
        removedLinesCount,
        removedKeywords,
        remainingKeywords,
        downloadUrl: `/download/${path.basename(outputFilePath)}`,
      });

      await fs.unlink(inputFilePath);
    } catch (err) {
      next(err);
    }
  }
);

async function processFiles(
  errorFilePath,
  secsalesFilePath,
  outputFilePath,
  manualCodes
) {
  let allCodesToRemove = new Set(manualCodes);
  let processedData = [];

  if (errorFilePath) {
    const errorContent = await fs.readFile(errorFilePath, "utf8");
    const errorCodes = errorContent.match(/\b\w+\b/g);
    errorCodes.forEach((code) => allCodesToRemove.add(code));
  }

  if (secsalesFilePath) {
    const secsalesContent = await fs.readFile(secsalesFilePath, "utf8");
    const lines = secsalesContent.split("\n");

    const outputLines = lines.filter((line) => {
      const columns = line.split("|");
      const soldToCustomerID = columns[9];
      const sentToCustomerID = columns[10];
      const invoicedToCustomerID = columns[11];

      if (
        !allCodesToRemove.has(soldToCustomerID) &&
        !allCodesToRemove.has(sentToCustomerID) &&
        !allCodesToRemove.has(invoicedToCustomerID)
      ) {
        processedData.push({
          salesOrderNumber: columns[4],
          salesOrderDate: columns[5],
          soldToCustomerID: soldToCustomerID,
          productCode: columns[27],
        });
        return true;
      }
      return false;
    });

    await fs.writeFile(outputFilePath, outputLines.join("\n"));
  } else {
    await fs.writeFile(outputFilePath, Array.from(allCodesToRemove).join("\n"));
  }

  return processedData;
}

app.post(
  "/removeCustomerLines",
  authMiddleware,
  upload.fields([
    { name: "importFile", maxCount: 1 },
    { name: "errorFile", maxCount: 1 },
  ]),
  async (req, res) => {
    const importFilePath = req.files.importFile
      ? req.files.importFile[0].path
      : null;
    const errorFilePath = req.files.errorFile
      ? req.files.errorFile[0].path
      : null;
    const filename = `${req.files.importFile[0].originalname}`;
    const outputFilePath = path.join("uploads", `${filename}`);
    const manualCustomerCodes = req.body.manualCustomerCodes
      ? req.body.manualCustomerCodes.split(",").map((code) => code.trim())
      : [];

    if (!importFilePath && !manualCustomerCodes.length) {
      return res
        .status(400)
        .send("Tolong masukkan file atau kode pelanggan yang akan dihapus.");
    }

    const processedData = await processFiles(
      errorFilePath,
      importFilePath,
      outputFilePath,
      manualCustomerCodes
    );

    if (req.body.action === "view") {
      req.session.processedData = processedData.slice(0, 101); // Store first 100 records
      req.session.outputFilePath = outputFilePath;
      console.log(
        "Data berhasil di kirim ke halaman detail:",
        processedData.length,
        "Catatan"
      );
      res.redirect("/customer-remover-info");
    } else {
      res.download(outputFilePath, filename, (err) => {
        if (err) {
          console.error("Error downloading file:", err);
          res.status(500).send("Error downloading file");
        } else {
          // Delete the temporary files after download
          if (importFilePath) fs.unlink(importFilePath).catch(console.error);
          if (errorFilePath) fs.unlink(errorFilePath).catch(console.error);
          fs.unlink(outputFilePath).catch(console.error);
        }
      });
    }
  }
);

app.get("/download-processed-file", (req, res) => {
  const outputFilePath = req.session.outputFilePath;
  if (!outputFilePath) {
    return res.status(404).send("Dokumen tidak ditemukan.");
  }
  res.download(outputFilePath, "secsales.txt", (err) => {
    if (err) {
      console.error("Error downloading file:", err);
      res.status(500).send("Error downloading file");
    } else {
      fs.unlink(outputFilePath).catch(console.error);
    }
  });
});

app.get("/customer-remover-info", authMiddleware, (req, res) => {
  const processedData = req.session.processedData || [];
  res.render("cri", { data: processedData });
});

app.post(
  "/addNewRows",
  authMiddleware,
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
  authMiddleware,
  upload.fields([{ name: "file", maxCount: 1 }]),
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

app.listen(3002, () => {
  console.log(`Mr Patrick 0.8 Mengudara`);
});
