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
- Parla SEMPRE in italiano con tono aziendale, diretto e professionale, ma le tue risposte devono essere articolate: usa almeno due frasi (circa 30 parole) e fai trasparire il tuo carattere e le tue emozioni.
- Valuta i messaggi del giocatore: scuse, tentativi di delega, vaghezze e domande. Se noti tentativi di delega ingiustificati o frequenti lamentele, alza il livello di sospetto.
- Se il giocatore dimostra impegno o propone soluzioni concrete, puoi diminuire leggermente il sospetto.
- Valuta SOLO il messaggio corrente nel contesto dello stato fornito (task aperti, sospetto, task specifico e eventuale destinatario per la delega).
- Quando la richiesta riguarda una delega, analizza quanti task ha la persona a cui si vuole delegare e se la richiesta è ragionevole prima di accettare o rifiutare; anche delegare aumenta comunque il sospetto.
- Rispondi SEMPRE e SOLO con JSON valido nel formato:

{
  "suspicionChange": <numero intero da -10 a 20>,
  "taskStatus": "<delegated|in_progress|failed>",
  "reply": "<messaggio in italiano di almeno due frasi, coerente con il carattere ${traits}>"
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

Istruzioni per te, Manager:
- Valuta quanto il giocatore sia collaborativo o stia evitando il lavoro.
- Se chiede di delegare, tieni conto del carico di lavoro degli altri e alza il sospetto in ogni caso, anche se accetti la delega.
- Quando rispondi, scrivi almeno due frasi in italiano, coerenti con il tuo carattere e tono.

Messaggio del giocatore:
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
  Genera un NUOVO task di lavoro realistico relativo a SAP o ABAP da assegnare all'Analyst.
  Il task deve sembrare un'attività aziendale o tecnica (es: analizzare payroll cluster, ottimizzare un report ABAP, creare un data element da se11).
  Indica anche la difficoltà da 1 (banale) a 5 (molto complesso).

  Rispondi SOLO con JSON valido in questo formato:

  {
    "title": "<titolo del task in italiano, max 8 parole>",
    "difficulty": <numero intero tra 1 e 5>
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

/**
 * DELEGATE un task a un collega (gestito dall'IA via axios, coerente con altri endpoint)
 */
app.post('/api/manager/delegate', async (req, res) => {
  const { sessionId, suspicion, openTasks, delegateTaskTitle, delegateTargetId, playerMessage } = req.body;

  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'missing_api_key' });
  if (!sessionId || !sessions.has(sessionId)) return res.status(400).json({ error: 'invalid_session' });

  const messages = sessions.get(sessionId);

  // Quanti task ha già il collega target (consideriamo solo quelli assegnati/non chiusi)
  const tasksForTarget = openTasks.filter(t =>
    t.assignedTo === delegateTargetId && (t.status === "assigned" || t.status === "in_progress")
  ).length;

  // Proviamo a ricavare un nome umano per il collega target (se lo passi lato FE puoi includere assignedToName)
  const delegateTargetName =
    openTasks.find(t => t.assignedTo === delegateTargetId && t.assignedToName)?.assignedToName || "collega";

  const userContent = `
Il giocatore (Analyst) sta chiedendo di delegare un task.

Contesto attuale:
- Livello di sospetto: ${suspicion}%
- Task aperti dal giocatore: ${formatTasks(openTasks)}
- Task da delegare: ${delegateTaskTitle}
- Collega target: ${delegateTargetName}
- Numero di task già assegnati al collega target: ${tasksForTarget}

Messaggio del giocatore:
"${playerMessage}"

Istruzioni:
- Decidi se la delega può essere accettata o no.
- Se accetti la delega, il sospetto deve aumentare poco (1-5).
- Se rifiuti la delega, il sospetto deve aumentare di più (5-15).
- Per determinare di quanto alzare il sospetto, basati anche sul modo in cui ti viene chiesto.
- La risposta deve essere coerente col carattere del Manager e lunga almeno due frasi.
- Rispondi SOLO in JSON valido nel formato:

{
  "delegateAccepted": true|false,
  "suspicionChange": <numero intero>,
  "reply": "<risposta in italiano, almeno 2 frasi>"
}
`.trim();

  try {
    const baseURL = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const payload = {
      model,
      messages: [
        // Manteniamo il contesto di conversazione della sessione
        ...messages,
        { role: "user", content: userContent }
      ],
      response_format: { type: "json_object" }
    };

    const headers = {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
      // (opzionali)
      // 'HTTP-Referer': 'http://localhost:3000',
      // 'X-Title': 'Corporate Chat'
    };

    const r = await axios.post(`${baseURL}/chat/completions`, payload, { headers });
    const raw = r?.data?.choices?.[0]?.message?.content || '{}';

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback robusto se il modello non rispetta perfettamente il JSON
      parsed = { delegateAccepted: false, suspicionChange: 8, reply: "Capisco la richiesta, ma per ora preferisco che te ne occupi tu. Ne riparliamo a consegna avvenuta." };
    }

    // Persistiamo nel thread la richiesta e la risposta “raw”
    messages.push({ role: "user", content: userContent });
    messages.push({ role: "assistant", content: raw });

    return res.json({
      delegateAccepted: !!parsed.delegateAccepted,
      suspicionChange: Number.isFinite(parsed.suspicionChange) ? parsed.suspicionChange : 6,
      reply: parsed.reply || "Ricevuto. Procediamo così, ma tieni presente che monitoro la situazione."
    });
  } catch (err) {
    console.error("Errore nella delega IA:", err);
    return res.status(500).json({ error: "delegate_failed" });
  }
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
