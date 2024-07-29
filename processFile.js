const fs = require("fs");
const readline = require("readline");

async function processFile(
  inputFilePath,
  outputFilePath,
  comparisonKeywords,
  errorLines
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

    rl.on("line", (line) => {
      lineNumber++;
      const keywordsInLine = extractKeywords(line);
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
        removedKeywords.push(
          ...keywordsInLine.filter((keyword) => comparisonKeywords.has(keyword))
        );
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
