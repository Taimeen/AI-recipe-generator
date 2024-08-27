require('dotenv').config();
const express = require('express');
const multer = require('multer');
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

const apiKey = process.env.API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

app.use(express.json());
app.use(express.static('public'));

app.post('/upload', upload.single('file'), async (req, res) => {
  const filePath = req.file.path;
  const mimeType = req.file.mimetype;

  console.log(`Received file: ${filePath}, MIME type: ${mimeType}`);

  try {
    const uploadResult = await fileManager.uploadFile(filePath, {
      mimeType,
      displayName: req.file.originalname,
    });
    fs.unlinkSync(filePath); // Clean up the local file

    console.log(`Upload result: ${JSON.stringify(uploadResult)}`);

    res.json({ fileUri: uploadResult.file.uri });
  } catch (error) {
    console.error(`Upload failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/process', async (req, res) => {
  const { userInput, fileUri, mimeType } = req.body;

  console.log(`Processing request with fileUri: ${fileUri}, MIME type: ${mimeType}, userInput: ${userInput}`);

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
  });

  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 1024,
    responseMimeType: 'text/plain',
  };

  try {
    const chatSession = model.startChat({
      generationConfig,
      history: [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                mimeType,
                fileUri,
              },
            },
            { text: userInput },
          ],
        },
      ],
    });

    const result = await chatSession.sendMessage('INSERT_INPUT_HERE');
    res.json({ response: result.response.text() });
  } catch (error) {
    console.error(`Processing failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
