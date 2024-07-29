const fs = require("fs").promises;
const readline = require("readline");

async function addNewRows(inputFilePath, notificationFilePath, outputFilePath) {
  const notificationData = await readNotificationFile(notificationFilePath);
  const fileContent = await fs.readFile(inputFilePath, "utf8");
  const lines = fileContent.split("\n");
  const newLines = [];

  for (const line of lines) {
    newLines.push(line);
    for (const notification of notificationData) {
      if (line.includes(notification.invoiceNumber)) {
        const newLine = createNewLine(line, notification.productCode);
        newLines.push(newLine);
      }
    }
  }

  await fs.writeFile(outputFilePath, newLines.join("\n"));
}

async function readNotificationFile(filePath) {
  const fileContent = await fs.readFile(filePath, "utf8");
  const lines = fileContent.split("\n");
  return lines.map((line) => {
    const invoiceNumber = line.match(/SO\d+/)[0];
    const productCode = line.match(/\(([^)]+)\)/)[1];
    return { invoiceNumber, productCode };
  });
}

function createNewLine(originalLine, productCode) {
  const columns = originalLine.split("|");
  columns[27] = productCode;
  columns[29] = "0";
  columns[30] = "0";
  columns[31] = "0";
  columns[32] = "0";
  columns[33] = "0";
  columns[34] = "0";
  columns[35] = "0.0";
  columns[36] = "0.0";
  columns[42] = "GDRTN8";
  return columns.join("|");
}

module.exports = addNewRows;
