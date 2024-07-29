const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const processFile = require("./processFile");
const { readKeywords, readErrorLines } = require("./readKeywords");
const addNewRows = require("./addNewRows");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.static("public"));

app.post(
  "/upload",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "comparisonFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const inputFilePath = req.files.file[0].path;
      const comparisonFilePath = req.files.comparisonFile[0].path;
      const outputFilePath = path.join(
        "uploads",
        `processed_${req.files.file[0].originalname}`
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
      console.error("Error processing file:", err);
      res.status(500).json({ success: false, error: "Error processing file" });
    }
  }
);

app.post(
  "/addNewRows",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "notificationFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const inputFilePath = req.files.file[0].path;
      const notificationFilePath = req.files.notificationFile[0].path;
      const outputFilePath = path.join(
        "uploads",
        `processed_new_rows_${req.files.file[0].originalname}`
      );

      await addNewRows(inputFilePath, notificationFilePath, outputFilePath);

      res.json({
        success: true,
        downloadUrl: `/download/${path.basename(outputFilePath)}`,
      });
    } catch (err) {
      console.error("Error processing file:", err);
      res.status(500).json({ success: false, error: "Error processing file" });
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
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting file:", err);
      });
    }
  });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
