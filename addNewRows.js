const fs = require("fs").promises;

async function addNewRows(inputFilePath, notificationFilePath, outputFilePath) {
  try {
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

      // Add new rows for each product code in the notifications
      for (const notification of notificationsForInvoice) {
        const originalLine = lines[0]; // Take the first line of the invoice
        const newLine = createNewLine(originalLine, notification.productCode);
        newLines.push(newLine);
      }
    }

    // Remove empty lines from the final result
    const finalData = newLines.filter((line) => line.trim() !== "");
    await fs.writeFile(outputFilePath, finalData.join("\n"));
    console.log("New rows added successfully!");
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

async function readNotificationFile(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    const lines = fileContent.split("\n");
    return lines
      .map((line) => {
        const invoiceMatch = line.match(/SO\d+/);
        const productMatch = line.match(/\((\d+[A-Z]?)\)/);
        if (invoiceMatch && productMatch) {
          const invoiceNumber = invoiceMatch[0];
          const productCode = productMatch[1];
          return { invoiceNumber, productCode };
        }
      })
      .filter(Boolean); // Filter out undefined entries
  } catch (error) {
    console.error(
      "An error occurred while reading the notification file:",
      error
    );
    return [];
  }
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
