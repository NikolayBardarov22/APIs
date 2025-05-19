// index.js
require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("❌ API ключът НЕ Е НАМЕРЕН. Моля, проверете .env файла.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- IMPORTANT: Define safety settings explicitly for debugging ---
// Start with more permissive settings for testing, then tighten if needed.
// Or remove them to use Gemini's defaults, but be aware defaults can be strict.
const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE, // Or BLOCK_ONLY_HIGH
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE, // Or BLOCK_ONLY_HIGH
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE, // Or BLOCK_ONLY_HIGH
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE, // Or BLOCK_ONLY_HIGH
    },
];

const model = genAI.getGenerativeModel({
    model: "gemini-1.0-pro", // <--- THE FIX IS HERE
    safetySettings: safetySettings, // Apply defined safety settings
    // generationConfig: { // You can also explore generationConfig if needed
    //  temperature: 0.7, // Example
    // }
});

console.log("✅ Проектът тръгна!");
console.log(`🔑 API ключът е конфигуриран.`);

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

        console.log("✉️ Изпращане на заявка към Gemini API с промпт:", prompt);

        const result = await model.generateContent(prompt);
        const geminiResponse = await result.response; // Renamed for clarity

        // DETAILED LOGGING - THIS IS KEY!
        console.log("--- RAW GEMINI API RESPONSE ---");
        console.log("Full result object:", JSON.stringify(result, null, 2));
        console.log("-------------------------------");
        console.log("Gemini response object (result.response):", JSON.stringify(geminiResponse, null, 2));
        console.log("-------------------------------");

        if (!geminiResponse) {
            console.error("❌ Няма 'response' обект от Gemini API.");
            return res.status(500).json({ error: "No response object received from AI.", details: "The 'response' field in the Gemini result was undefined or null." });
        }

        // Check for prompt feedback, which can indicate blocking or other issues
        if (geminiResponse.promptFeedback) {
            console.warn("⚠️ Получено promptFeedback от Gemini:", JSON.stringify(geminiResponse.promptFeedback, null, 2));
            if (geminiResponse.promptFeedback.blockReason) {
                console.error(`❌ Заявката е блокирана от Gemini. Причина: ${geminiResponse.promptFeedback.blockReason}`);
                return res.status(500).json({
                    error: "Request blocked by AI due to safety or other reasons.",
                    details: geminiResponse.promptFeedback
                });
            }
        }

        const text = geminiResponse.text();
        console.log("📜 Получен текст от Gemini (преди разделяне):", `"${text}"`); // Log the raw text

        if (!text || text.trim() === "") {
            // This is a very common scenario if content is filtered by safety settings
            // but doesn't cause an outright block with a blockReason.
            console.warn("⚠️ Текстът от Gemini е празен. Възможно е съдържанието да е филтрирано от настройките за безопасност.");
             const finishReason = geminiResponse.candidates?.[0]?.finishReason;
            if (finishReason === 'SAFETY') {
                 return res.status(500).json({ error: "AI returned empty text, likely due to safety filtering (SAFETY finishReason).", details: geminiResponse.promptFeedback || "No additional details." });
            } else if (finishReason) {
                 return res.status(500).json({ error: `AI returned empty text. Finish reason: ${finishReason}`, details: geminiResponse.promptFeedback || "No additional details." });
            }
            return res.status(500).json({ error: "AI returned empty text. Check server logs for promptFeedback or filtering details.", details: geminiResponse.promptFeedback || "No additional details." });
        }

        const ideas = text.split('\n')
                          .map(idea => idea.trim())
                          .filter(idea => idea.length > 0 && /^\d+\./.test(idea)); // Only keep lines starting with "1.", "2." etc.

        console.log("💡 Генерирани и филтрирани идеи:", ideas);

        if (ideas.length === 0) {
            console.warn("⚠️ Не са намерени форматирани идеи след разделяне на текста. Проверете суровия текст от Gemini.");
            return res.json({ ideas: [], message: "AI generated text, but it didn't match the expected format for ideas. Raw text: " + text });
        }

        res.json({ ideas: ideas.slice(0, 5) });

    } catch (error) {
        console.error("❌ Грешка при комуникация с Gemini API или обработка на отговора:", error); // More generic error here
        // The specific check for error.response.promptFeedback is good but error might not always have .response
        if (error.response && error.response.promptFeedback) {
            console.error("Prompt Feedback (in catch):", error.response.promptFeedback);
            return res.status(500).json({
                error: "Failed to generate ideas from AI due to content policy.",
                details: error.response.promptFeedback
            });
        }
        res.status(500).json({ error: "Failed to generate ideas from AI.", details: error.message });
    }
});

app.use(express.static('public'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(port, () => {
    console.log(`🚀 Backend server-ът работи на http://localhost:${port}`);
});