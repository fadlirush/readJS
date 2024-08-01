const fs = require("fs").promises;

async function addNewRows(inputFilePath, notificationFilePath, outputFilePath) {
  const notificationData = await readNotificationFile(notificationFilePath);
  const fileContent = await fs.readFile(inputFilePath, "utf8");
  const lines = fileContent.split("\n").filter((line) => line.trim() !== "");
  const newLines = [];
  const invoiceMap = new Map();

  // Create a map of invoice numbers to their corresponding lines
  for (const line of lines) {
    newLines.push(line);
    const invoiceMatch = line.match(/SO\d+/);
    if (invoiceMatch) {
      const invoiceNumber = invoiceMatch[0];
      if (!invoiceMap.has(invoiceNumber)) {
        invoiceMap.set(invoiceNumber, []);
      }
      invoiceMap.get(invoiceNumber).push(line);
    }
  }

  // Add new rows for each invoice number based on the notification data
  for (const [invoiceNumber, lines] of invoiceMap.entries()) {
    const notificationsForInvoice = notificationData.filter(
      (notification) => notification.invoiceNumber === invoiceNumber
    );

    // Add only one new row per invoice number, containing all product codes
    if (notificationsForInvoice.length > 0) {
      const originalLine = lines[0]; // Take the first line of the invoice
      for (const notification of notificationsForInvoice) {
        const newLine = createNewLine(originalLine, notification.productCode);
        newLines.push(newLine);
      }
    }
  }

  // Remove empty lines from the final result
  const finalData = newLines.filter((line) => line.trim() !== "");
  await fs.writeFile(outputFilePath, finalData.join("\n"));
}

async function readNotificationFile(filePath) {
  const fileContent = await fs.readFile(filePath, "utf8");
  const lines = fileContent.split("\n");
  return lines
    .map((line) => {
      const invoiceMatch = line.match(/SO\d+/);
      const productMatch = line.match(/\((\d+)\)/);
      if (invoiceMatch && productMatch) {
        const invoiceNumber = invoiceMatch[0];
        const productCode = productMatch[1];
        return { invoiceNumber, productCode };
      }
    })
    .filter(Boolean); // Filter out undefined entries
}

function createNewLine(originalLine, productCode) {
  const columns = originalLine.split("|");
  columns[27] = productCode; // Assuming column 28 in the original request corresponds to index 27
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
