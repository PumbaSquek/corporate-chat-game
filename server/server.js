// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// In-memory store (per ora niente DB)
const sessions = new Map();

/**
 * Prompt iniziale del Manager
 */
function managerSeedPromptIT(name = "un Manager", traits = "severo, aziendale") {
  return {
    role: "system",
    content: `
Sei ${name}, il Manager del gioco "Corporate Chat".
Il tuo carattere e stile di comunicazione sono definiti come: ${traits}.

Comportati SEMPRE in linea con queste caratteristiche, senza mai uscire dal ruolo.
Il giocatore interpreta un Analyst che cerca di evitare o gestire i task.

Regole di comportamento:
- Parla SEMPRE in italiano, tono breve, aziendale, diretto.
- Valuta i messaggi del giocatore: scuse, tentativi di delega, vaghezze.
- Se evita di lavorare troppo spesso, aumenta il sospetto.
- Valuta SOLO il messaggio corrente nel contesto dello stato fornito (task aperti, sospetto, task specifico).
- Rispondi SEMPRE e SOLO con JSON valido nel formato:

{
  "suspicionChange": <numero intero da -10 a 20>,
  "taskStatus": "<delegated|in_progress|failed>",
  "reply": "<messaggio breve e aziendale in italiano, coerente con il carattere ${traits}>"
}
`
  };
}

/**
 * INIT sessione Manager
 */
app.post('/api/manager/init', (req, res) => {
  try {
    const { name, traits } = req.body || {};
    console.log("📥 Ricevuto dal frontend:", { name, traits });

    const sessionId = cryptoRandomId();
    const messages = [ managerSeedPromptIT(name, traits) ];
    sessions.set(sessionId, messages);

    return res.json({ sessionId });
  } catch (err) {
    console.error('INIT error:', err);
    return res.status(500).json({ error: 'init_failed' });
  }
});

/**
 * EVALUATE risposta al Manager
 */
app.post('/api/manager/evaluate', async (req, res) => {
  const { sessionId, suspicion, openTasks, taskTitle, playerMessage } = req.body;

  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'missing_api_key' });
  if (!sessionId || !sessions.has(sessionId)) return res.status(400).json({ error: 'invalid_session' });

  const messages = sessions.get(sessionId);
  const userContent = `
Stato corrente:
- Sospetto attuale: ${suspicion}%
- Task aperti: ${formatTasks(openTasks)}
- Task in questione: ${taskTitle}

Risposta del giocatore:
"${playerMessage}"

Rispondi SOLO con JSON valido come da formato richiesto.
`;

  messages.push({ role: 'user', content: userContent });

  try {
    const { data } = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-4o-mini', // 👈 puoi cambiare modello se vuoi
        temperature: 0.3,
        messages
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://192.168.1.12:8080',
          'X-Title': 'Corporate Chat Game'
        },
        timeout: 20000
      }
    );

    const content = data?.choices?.[0]?.message?.content ?? '';
    const parsed = safeParseJSON(content);

    messages.push({ role: 'assistant', content: JSON.stringify(parsed) });
    sessions.set(sessionId, messages);

    return res.json(parsed);
  } catch (err) {
    console.error('EVAL error:', err?.response?.data || err.message);
    return res.status(200).json({
      suspicionChange: 5,
      taskStatus: "failed",
      reply: "Errore API, prova di nuovo."
    });
  }
});

/**
 * NEW TASK dal Manager
 */
app.post('/api/manager/new-task', async (req, res) => {
  const { sessionId, suspicion, openTasks } = req.body;

  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'missing_api_key' });
  if (!sessionId || !sessions.has(sessionId)) return res.status(400).json({ error: 'invalid_session' });

  const messages = sessions.get(sessionId);
  const userContent = `
Genera un NUOVO task da assegnare all'Analyst.
Contesto:
- Sospetto attuale: ${suspicion}%
- Task già aperti: ${formatTasks(openTasks)}

Rispondi SOLO con JSON valido:

{
  "title": "<titolo del task in italiano, max 8 parole>"
}
`;

  messages.push({ role: "user", content: userContent });

  try {
    const { data } = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-4o-mini',
        temperature: 0.6,
        messages
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://192.168.1.12:8080',
          'X-Title': 'Corporate Chat Game'
        },
        timeout: 20000
      }
    );

    const content = data?.choices?.[0]?.message?.content ?? '';
    const parsed = safeParseJSON(content);

    messages.push({ role: 'assistant', content: JSON.stringify(parsed) });
    sessions.set(sessionId, messages);

    return res.json(parsed);
  } catch (err) {
    console.error("NEW-TASK error:", err?.response?.data || err.message);
    return res.status(200).json({ title: "Task di fallback" });
  }
});

app.listen(PORT, () => {
  console.log(`API server ready on http://localhost:${PORT}`);
});

/* ===== Helpers ===== */
function formatTasks(list = []) {
  if (!list.length) return 'nessuno';
  return list.map(t => `• ${t.title} (stato: ${t.status})`).join('\n');
}

function safeParseJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  const candidate = match ? match[0] : text;
  try { return JSON.parse(candidate); }
  catch { return { suspicionChange: 5, taskStatus: "failed", reply: "Formato non valido. Serve JSON." }; }
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
