const fs = require("fs");
const readline = require("readline");

async function processFile(
  inputFilePath,
  outputFilePath,
  comparisonKeywords,
  errorLines,
  keepKeywords
) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(inputFilePath);
    const writeStream = fs.createWriteStream(outputFilePath);
    const rl = readline.createInterface({
      input: readStream,
      output: writeStream,
      terminal: false,
    });

    let removedLinesCount = 0;
    let removedKeywords = [];
    let remainingKeywords = new Set();
    let lineNumber = 0;
    let isFirstLine = true;

    rl.on("line", (line) => {
      lineNumber++;

      // Selalu tulis baris pertama
      if (isFirstLine) {
        writeStream.write(line + "\n");
        isFirstLine = false;
        return;
      }

      const keywordsInLine = extractKeywords(line);

      if (keepKeywords && keepKeywords.size > 0) {
        const shouldKeep = keywordsInLine.some((keyword) =>
          keepKeywords.has(keyword)
        );
        if (shouldKeep) {
          if (errorLines.has(lineNumber)) {
            line += "GDRTN8";
          }
          writeStream.write(line + "\n");
          keywordsInLine.forEach((kw) => remainingKeywords.add(kw));
        } else {
          removedLinesCount++;
          removedKeywords.push(...keywordsInLine);
        }
      } else {
        const shouldRemove = keywordsInLine.some((keyword) =>
          comparisonKeywords.has(keyword)
        );
        if (!shouldRemove) {
          if (errorLines.has(lineNumber)) {
            line += "GDRTN8";
          }
          writeStream.write(line + "\n");
          keywordsInLine.forEach((kw) => remainingKeywords.add(kw));
        } else {
          removedLinesCount++;
          removedKeywords.push(...keywordsInLine);
        }
      }
    });

    rl.on("close", () => {
      writeStream.end();
      resolve({
        removedLinesCount,
        removedKeywords: Array.from(new Set(removedKeywords)),
        remainingKeywords: Array.from(remainingKeywords),
      });
    });

    rl.on("error", (err) => {
      reject(err);
    });
  });
}

function extractKeywords(line) {
  const regex = /SO\d{9,10}/g;
  const matches = line.match(regex);
  return matches ? matches : [];
}

module.exports = processFile;
