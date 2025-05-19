// index.js
require('dotenv').config(); // Loads .env file contents into process.env
const express = require('express');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000; // Use port from .env or default to 3000

// Middleware to parse JSON bodies
app.use(express.json());

// --- Gemini AI Configuration ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("❌ API ключът НЕ Е НАМЕРЕН. Моля, проверете .env файла.");
    process.exit(1); // Exit if no API key
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-pro",
    // Optional: Configure safety settings if needed.
    // Refer to Gemini documentation for details.
    // safetySettings: [
    //     {
    //         category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    //         threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    //     },
    // ],
});

console.log("✅ Проектът тръгна!");
console.log(`🔑 API ключът е конфигуриран.`);

// --- API Endpoint ---
app.post('/generate-ideas', async (req, res) => {
    const { topic } = req.body;

    if (!topic) {
        return res.status(400).json({ error: "Topic is required in the request body." });
    }

    console.log(`Получена тема: ${topic}`);

    try {
        const prompt = `Generate 5 distinct and engaging ideas for tweets or blog posts about the topic: "${topic}".
Each idea should be concise and actionable.
Present each idea on a new line, starting with a number and a period (e.g., "1. ...").
Do not include any introductory or concluding sentences, just the 5 ideas.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Split the text into an array of ideas
        // This assumes Gemini follows the "each idea on a new line" instruction.
        // You might need more robust parsing if the output varies.
        const ideas = text.split('\n')
                          .map(idea => idea.trim()) // Remove leading/trailing whitespace
                          .filter(idea => idea.length > 0); // Remove any empty lines

        console.log("💡 Генерирани идеи:", ideas);
        res.json({ ideas: ideas.slice(0, 5) }); // Ensure we only send 5, even if Gemini gives more

    } catch (error) {
        console.error(" Грешка при комуникация с Gemini API:", error.message);
        if (error.response && error.response.promptFeedback) {
            console.error("Prompt Feedback:", error.response.promptFeedback);
            return res.status(500).json({
                error: "Failed to generate ideas from AI due to content policy.",
                details: error.response.promptFeedback
            });
        }
        res.status(500).json({ error: "Failed to generate ideas from AI.", details: error.message });
    }
});

// --- Serve Static Frontend Files (Optional) ---
// Create a 'public' folder in your project root and put index.html and any JS/CSS there.
app.use(express.static('public'));

// Optional: A simple route for the root if you don't put index.html in public/index.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html'); // Adjust path if needed
});


app.listen(port, () => {
    console.log(`🚀 Backend server-ът работи на http://localhost:${port}`);
});