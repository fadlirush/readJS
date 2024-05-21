const fs = require('fs');
const readline = require('readline');

async function processFile(inputFilePath, outputFilePath, comparisonKeywords) {
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(inputFilePath);
        const writeStream = fs.createWriteStream(outputFilePath);
        const rl = readline.createInterface({
            input: readStream,
            output: writeStream,
            terminal: false
        });

        let removedLinesCount = 0;

        rl.on('line', (line) => {
            if (!containsComparisonKeyword(line, comparisonKeywords)) {
                writeStream.write(line + '\n');
            } else {
                removedLinesCount++;
            }
        });

        rl.on('close', () => {
            writeStream.end();
            console.log(`File processing complete. Output saved to ${outputFilePath}`);
            resolve(removedLinesCount);
        });

        rl.on('error', (err) => {
            reject(err);
        });
    });
}

function containsComparisonKeyword(line, comparisonKeywords) {
    for (let keyword of comparisonKeywords) {
        if (line.includes(keyword)) {
            return true;
        }
    }
    return false;
}

module.exports = processFile;
