// index.js
require('dotenv').config();
const express = require('express');
const OpenAI = require('openai'); // Import OpenAI

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// --- OpenAI Configuration ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    console.error("❌ OpenAI API key NOT FOUND. Please check the .env file and Render environment variables.");
    process.exit(1); // Exit if no API key
}

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

console.log("✅ Проектът тръгна с OpenAI!");
console.log(`🔑 OpenAI API ключът е конфигуриран.`);

// --- API Endpoint ---
app.post('/generate-ideas', async (req, res) => {
    const { topic } = req.body;

    if (!topic) {
        return res.status(400).json({ error: "Topic is required in the request body." });
    }

    console.log(`Получена тема за OpenAI: ${topic}`);

    try {
        const messages = [
            {
                role: "system",
                content: `You are a helpful assistant. Generate 5 distinct and engaging ideas for tweets or blog posts about a given topic.
Each idea should be concise and actionable.
Present each idea on a new line, starting with a number and a period (e.g., "1. ...").
Do not include any introductory or concluding sentences, just the 5 ideas.`
            },
            {
                role: "user",
                content: `Topic: "${topic}"`
            }
        ];

        console.log("✉️ Изпращане на заявка към OpenAI API (gpt-4o)...");

        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Using GPT-4o
            messages: messages,
            // max_tokens: 300, // Optional: Uncomment and adjust if you need longer responses
            // temperature: 0.7, // Optional: Adjust creativity
        });

        // Optional: Log the raw response for debugging
        // console.log("Full OpenAI completion object:", JSON.stringify(completion, null, 2));

        if (!completion.choices || completion.choices.length === 0 || !completion.choices[0].message || !completion.choices[0].message.content) {
            console.error("❌ OpenAI API не върна очакваното съдържание в choices.");
            return res.status(500).json({ error: "AI did not return valid content structure."});
        }

        const text = completion.choices[0].message.content.trim();
        console.log("📜 Получен текст от OpenAI (преди разделяне):", `"${text}"`);

        if (text === "") {
            console.warn("⚠️ Текстът от OpenAI е празен.");
            return res.status(500).json({ error: "AI returned empty text."});
        }

        const ideas = text.split('\n')
                          .map(idea => idea.trim())
                          .filter(idea => idea.length > 0 && /^\d+\./.test(idea)); // Keep lines starting with "1.", "2." etc.

        console.log("💡 Генерирани и филтрирани идеи от OpenAI:", ideas);

        if (ideas.length === 0 && text.length > 0) {
             console.warn("⚠️ Не са намерени форматирани идеи от OpenAI. Връщане на суров текст.");
             return res.json({ ideas: [text], message: "AI generated text, but it didn't match the expected numbered list format. Raw output shown as one idea." });
        }
        if (ideas.length === 0){
            console.warn("⚠️ Не са намерени форматирани идеи от OpenAI. Отговорът изглежда празен или неформатиран.");
            return res.json({ ideas: [], message: "No formatted ideas found in AI response." });
        }

        res.json({ ideas: ideas.slice(0, 5) });

    } catch (error) {
        console.error("❌ Грешка при комуникация с OpenAI API или обработка на отговора:", error);
        let errorMessage = "Failed to generate ideas from OpenAI AI.";
        let errorDetails = error.message;

        if (error instanceof OpenAI.APIError) { // Check for specific OpenAI API errors
            console.error("OpenAI API Error Status:", error.status);
            console.error("OpenAI API Error Message:", error.message);
            console.error("OpenAI API Error Code:", error.code);
            console.error("OpenAI API Error Type:", error.type);

            errorDetails = `Status: ${error.status}, Message: ${error.message}, Code: ${error.code}, Type: ${error.type}`;
            if (error.status === 401) {
                errorMessage = "OpenAI API Key is invalid, not authorized, or billing issue.";
            } else if (error.status === 429) {
                errorMessage = "OpenAI API rate limit exceeded or quota issue. Please check your OpenAI plan and usage limits.";
            } else if (error.message) {
                errorMessage = error.message; // Use the error message from the API
            }
        } else if (error.code) {
            errorDetails = `Code: ${error.code}, Message: ${error.message}`;
        }

        res.status(500).json({ error: errorMessage, details: errorDetails });
    }
});

// --- Serve Static Frontend Files ---
app.use(express.static('public'));
app.get('/', (req, res) => {
    // Ensure this path is correct relative to where your index.js is.
    // If public is in the same directory as index.js, this is fine.
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(port, () => {
    console.log(`🚀 Backend server-ът (с OpenAI) работи на http://localhost:${port}`);
});