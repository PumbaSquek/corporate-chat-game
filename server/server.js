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

const sessions = new Map();

// ===== Prompt Manager =====
function managerSeedPromptIT(name = "un Manager", traits = "severo, aziendale") {
  return {
    role: "system",
    content: `
Sei ${name}, Manager nel gioco "Corporate Chat".
Carattere: ${traits}.

Regole:
- Parla SEMPRE in italiano, tono breve, aziendale, diretto.
- Valuti risposte dell'Analyst e assegni task.
- Rispondi SOLO in JSON valido nei formati richiesti.
`
  };
}

// ===== INIT session =====
app.post('/api/manager/init', (req, res) => {
  try {
    const { name, traits } = req.body || {};
    const sessionId = cryptoRandomId();
    const messages = [ managerSeedPromptIT(name, traits) ];
    sessions.set(sessionId, messages);
    return res.json({ sessionId });
  } catch (err) {
    console.error('INIT error:', err);
    return res.status(500).json({ error: 'init_failed' });
  }
});

// ===== Evaluate response =====
app.post('/api/manager/evaluate', async (req, res) => {
  const { sessionId, suspicion, openTasks, taskTitle, playerMessage } = req.body;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'missing_api_key' });
  if (!sessionId || !sessions.has(sessionId)) return res.status(400).json({ error: 'invalid_session' });

  const messages = sessions.get(sessionId);
  const userContent = `
Sospetto attuale: ${suspicion}%
Task aperti: ${formatTasks(openTasks)}
Task in questione: ${taskTitle}

Risposta Analyst:
"${playerMessage}"

Rispondi SOLO in JSON:
{
  "suspicionChange": <int>,
  "taskStatus": "<delegated|in_progress|failed>",
  "reply": "<risposta breve in italiano>"
}
`;
  messages.push({ role: 'user', content: userContent });

  try {
    const { data } = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages
    },{
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      timeout: 20000
    });

    const content = data?.choices?.[0]?.message?.content ?? '';
    const parsed = safeParseJSON(content);
    messages.push({ role: 'assistant', content: JSON.stringify(parsed) });
    sessions.set(sessionId, messages);
    return res.json(parsed);
  } catch (err) {
    console.error('EVAL error:', err?.response?.data || err.message);
    return res.status(200).json({ suspicionChange: 5, taskStatus: "failed", reply: "Risposta non valida. Fornisci più dettagli." });
  }
});

// ===== New Task generator =====
app.post('/api/manager/new-task', async (req, res) => {
  const { sessionId, suspicion, openTasks } = req.body;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'missing_api_key' });
  if (!sessionId || !sessions.has(sessionId)) return res.status(400).json({ error: 'invalid_session' });

  const messages = sessions.get(sessionId);
  const userContent = `
Genera un titolo breve e chiaro per un nuovo task aziendale da assegnare a un Analyst.
Sospetto attuale: ${suspicion}%
Task già aperti: ${formatTasks(openTasks)}

Rispondi SOLO in JSON:
{ "title": "<titolo del task>" }
`;
  messages.push({ role: 'user', content: userContent });

  try {
    const { data } = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages
    },{
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      timeout: 15000
    });

    const content = data?.choices?.[0]?.message?.content ?? '';
    const parsed = safeParseJSON(content);
    messages.push({ role: 'assistant', content: JSON.stringify(parsed) });
    sessions.set(sessionId, messages);
    return res.json(parsed);
  } catch (err) {
    console.error('TASK error:', err?.response?.data || err.message);
    return res.status(200).json({ title: "Task di fallback" });
  }
});

app.listen(PORT, () => console.log(`API server ready on http://localhost:${PORT}`));

// ===== Helpers =====
function formatTasks(list = []) {
  if (!list.length) return 'nessuno';
  return list.map(t => `• ${t.title} (${t.status})`).join('\n');
}
function safeParseJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  const candidate = match ? match[0] : text;
  try { return JSON.parse(candidate); }
  catch { return { title: "Errore parsing JSON" }; }
}
function cryptoRandomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
