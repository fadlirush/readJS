const fs = require('fs').promises;

async function replaceNCInFile(inputFilePath, outputFilePath) {
  try {

    let fileContent = await fs.readFile(inputFilePath, 'utf8');
    const updatedContent = fileContent.replace(/\bNC\b/g, 'GDRTN8');
    await fs.writeFile(outputFilePath, updatedContent, 'utf8');
    return { success: true };
  } catch (err) {
    console.error("Error processing file:", err);
    return { success: false, error: err.message };
  }
}

module.exports = replaceNCInFile;
