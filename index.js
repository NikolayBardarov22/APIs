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

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const model = genAI.getGenerativeModel({
    model: "gemini-pro", // ✅ FIXED: заменено от "gemini-1.0-pro"
    safetySettings: safetySettings,
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
        const geminiResponse = await result.response;

        console.log("--- RAW GEMINI API RESPONSE ---");
        console.log("Full result object:", JSON.stringify(result, null, 2));
        console.log("-------------------------------");

        if (!geminiResponse) {
            console.error("❌ Няма 'response' обект от Gemini API.");
            return res.status(500).json({ error: "No response object received from AI." });
        }

        if (geminiResponse.promptFeedback) {
            console.warn("⚠️ Получено promptFeedback от Gemini:", JSON.stringify(geminiResponse.promptFeedback, null, 2));
            if (geminiResponse.promptFeedback.blockReason) {
                console.error(`❌ Заявката е блокирана. Причина: ${geminiResponse.promptFeedback.blockReason}`);
                return res.status(500).json({
                    error: "Request blocked due to safety settings.",
                    details: geminiResponse.promptFeedback
                });
            }
        }

        const text = geminiResponse.text();
        console.log("📜 Получен текст:", `"${text}"`);

        if (!text || text.trim() === "") {
            const finishReason = geminiResponse.candidates?.[0]?.finishReason;
            return res.status(500).json({ error: `Empty text. Finish reason: ${finishReason || 'Unknown'}` });
        }

        const ideas = text.split('\n')
                          .map(idea => idea.trim())
                          .filter(idea => idea.length > 0 && /^\d+\./.test(idea));

        console.log("💡 Генерирани идеи:", ideas);

        if (ideas.length === 0) {
            return res.json({ ideas: [], message: "Text didn't match expected format. Raw: " + text });
        }

        res.json({ ideas: ideas.slice(0, 5) });

    } catch (error) {
        console.error("❌ Грешка при Gemini API:", error);
        if (error.response && error.response.promptFeedback) {
            return res.status(500).json({
                error: "Gemini blocked the content.",
                details: error.response.promptFeedback
            });
        }
        res.status(500).json({ error: "Error from Gemini API", details: error.message });
    }
});

app.use(express.static('public'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(port, () => {
    console.log(`🚀 Backend server-ът работи на http://localhost:${port}`);
});
