const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const processFile = require('./processFile');
const readKeywords = require('./readKeywords');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

app.post('/upload', upload.fields([{ name: 'file' }, { name: 'comparisonFile' }]), async (req, res) => {
    const inputFilePath = req.files.file[0].path;
    const comparisonFilePath = req.files.comparisonFile[0].path;
    const outputFilePath = path.join('uploads', req.files.file[0].originalname);

    try {
        const comparisonKeywords = await readKeywords(comparisonFilePath);
        const removedLinesCount = await processFile(inputFilePath, outputFilePath, comparisonKeywords);

        res.json({
            success: true,
            removedLinesCount,
            downloadUrl: `/download/${path.basename(outputFilePath)}`
        });
    } catch (err) {
        console.error('Error processing file:', err);
        res.status(500).json({ success: false, error: 'Error processing file' });
    }
});

app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', filename);
    res.download(filePath, (err) => {
        if (err) {
            console.error('Error downloading file:', err);
            res.status(500).send('Error downloading file');
        } else {
            fs.unlink(filePath, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
