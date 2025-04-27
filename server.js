import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Funkcja pobierająca ciekawostkę na podstawie tematu od AI
async function getFactFromAI(topic) {
  const prompt = `
Twoim zadaniem jest stworzenie krótkiej ciekawostki o temacie "${topic}".
- Maksymalnie 500 znaków.
- Styl: przyjazny, lekko naukowy.
- Na końcu podaj źródło w formie URL.
Przykład odpowiedzi:
{
  "title": "Tytuł ciekawostki",
  "fact": "Krótki opis ciekawostki w maks 500 znakach.",
  "source": "https://linkdokategorii.pl"
}
Zwróć odpowiedź w formacie JSON.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo", // lub "gpt-4" jeśli masz dostęp
    messages: [
      { role: "system", content: "Jesteś asystentem tworzącym krótkie ciekawostki edukacyjne." },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });

  const response = completion.choices[0].message.content;
  return JSON.parse(response);
}

// Endpoint: pobieranie ciekawostki
app.get('/fact', async (req, res) => {
  const { topic } = req.query;

  if (!topic) {
    return res.status(400).json({ error: 'Brak tematu (topic) w zapytaniu.' });
  }

  try {
    const fact = await getFactFromAI(topic);
    res.json(fact);
  } catch (error) {
    console.error('Błąd podczas pobierania ciekawostki od AI:', error);
    res.status(500).json({ error: 'Nie udało się wygenerować ciekawostki.' });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
