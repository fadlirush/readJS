const fs = require('fs');
const readline = require('readline');

function readKeywords(filePath) {
    return new Promise((resolve, reject) => {
        const keywords = new Set();
        const readStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: readStream,
            output: process.stdout,
            terminal: false
        });

        rl.on('line', (line) => {
            const matches = line.match(/SO\d{0,9}/g);
            if (matches) {
                matches.forEach(match => keywords.add(match));
            }
        });

        rl.on('close', () => {
            resolve(keywords);
        });

        rl.on('error', (err) => {
            reject(err);
        });
    });
}

module.exports = readKeywords;
