// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

console.log('Booting API server...');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
const MODEL = process.env.OPENAI_MODEL || 'openai/gpt-4o-mini';

// In-memory store (per ora niente DB)
const sessions = new Map();

/* ========= Helpers ========= */
function formatTasks(list = []) {
  if (!list?.length) return 'nessuno';
  return list
    .map(t => `• ${t.title} (stato: ${t.status})`)
    .join('\n');
}

function safeParseJSON(text) {
  // Prova a prendere il primo oggetto JSON presente
  const match = String(text || '').match(/\{[\s\S]*\}/);
  const candidate = match ? match[0] : text;
  try { return JSON.parse(candidate); }
  catch { return { suspicionChange: 5, taskStatus: "failed", reply: "Formato non valido. Serve JSON." }; }
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* ========= Prompt seed Manager ========= */
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
`.trim()
  };
}

/* ========= INIT sessione Manager ========= */
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

/* ========= EVALUATE risposta al Manager ========= */
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
`.trim();

  // Inseriamo la richiesta nell'history
  messages.push({ role: 'user', content: userContent });

  try {
    const payload = {
      model: MODEL,
      temperature: 0.3,
      messages
    };
    const headers = {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      // Opzionali:
      // 'HTTP-Referer': 'http://localhost:3000',
      // 'X-Title': 'Corporate Chat Game'
    };

    const { data } = await axios.post(
      `${BASE_URL}/chat/completions`,
      payload,
      { headers, timeout: 20000 }
    );

    const content = data?.choices?.[0]?.message?.content ?? '';
    const parsed = safeParseJSON(content);

    // Salviamo la risposta raw nell'history
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

/* ========= NEW TASK (SAP/ABAP + difficulty 1..5) ========= */
app.post('/api/manager/new-task', async (req, res) => {
  const { sessionId } = req.body;

  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'missing_api_key' });
  if (!sessionId || !sessions.has(sessionId)) return res.status(400).json({ error: 'invalid_session' });

  const messages = sessions.get(sessionId);
  const userContent = `
Genera un NUOVO task di lavoro realistico relativo a SAP o ABAP da assegnare all'Analyst.
Il task deve sembrare un'attività aziendale o tecnica (es: analizzare payroll cluster, ottimizzare un report ABAP, creare un data element da SE11, definire una CDS view, sistemare un BAPI, ecc.).
Indica anche la difficoltà da 1 (banale) a 5 (molto complesso).

Rispondi SOLO con JSON valido in questo formato:

{
  "title": "<titolo del task in italiano, max 8 parole>",
  "difficulty": <numero intero tra 1 e 5>
}
`.trim();

  messages.push({ role: "user", content: userContent });

  try {
    const payload = {
      model: MODEL,
      temperature: 0.6,
      messages
    };
    const headers = {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      // Opzionali:
      // 'HTTP-Referer': 'http://localhost:3000',
      // 'X-Title': 'Corporate Chat Game'
    };

    const { data } = await axios.post(
      `${BASE_URL}/chat/completions`,
      payload,
      { headers, timeout: 20000 }
    );

    const content = data?.choices?.[0]?.message?.content ?? '';
    const parsed = safeParseJSON(content);

    messages.push({ role: 'assistant', content: JSON.stringify(parsed) });
    sessions.set(sessionId, messages);

    return res.json(parsed);
  } catch (err) {
    console.error("NEW-TASK error:", err?.response?.data || err.message);
    return res.status(200).json({ title: "Task di fallback", difficulty: 1 });
  }
});

/* ========= DELEGATE (IA via axios con rubric + esempi) ========= */
app.post('/api/manager/delegate', async (req, res) => {
  const { sessionId, suspicion, openTasks, delegateTaskTitle, delegateTargetId, playerMessage } = req.body;

  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'missing_api_key' });
  if (!sessionId || !sessions.has(sessionId)) return res.status(400).json({ error: 'invalid_session' });

  const messages = sessions.get(sessionId);

  // Quanti task ha già il collega target (consideriamo assigned o in_progress)
  const tasksForTarget = (openTasks || []).filter(t =>
    t.assignedTo === delegateTargetId && (t.status === "assigned" || t.status === "in_progress")
  ).length;

  // Nome umano del collega target (se disponibile)
  const targetFromTasks = (openTasks || []).find(t => t.assignedTo === delegateTargetId && t.assignedToName);
  const delegateTargetName = targetFromTasks?.assignedToName || "collega";

  const playerOpen = (openTasks || []).filter(t =>
    t.assignedTo === 99 && (t.status === "assigned" || t.status === "in_progress")
  ).length; // 99 è il PLAYER_ID lato FE; opzionale

  const userContent = `
Il giocatore (Analyst) chiede di DELEGARE un task.

Contesto:
- Sospetto attuale: ${suspicion}%
- Task aperti del giocatore: ${playerOpen} (${formatTasks(openTasks)})
- Task da delegare: ${delegateTaskTitle}
- Collega target: ${delegateTargetName}
- Task già assegnati al target: ${tasksForTarget}

Messaggio del giocatore:
"${playerMessage}"

DECISIONE con punteggio (0–10). Assegna 0, 1 o 2 punti a ciascun criterio:

1) Blocco oggettivo fuori controllo del giocatore (permessi mancanti, step che SOLO il target può fare) → +2 se presente.
2) Motivazione professionale concreta (dati, impatti, priorità) → +2 se concreta; +1 se debole; +0 se vaga.
3) Carico target: accetta se target ha pochi task (<=2) → +2; se medio (3–4) → +1; se alto (>=5) → +0.
4) Carico giocatore: se il giocatore ha già molti task (>=3) o scadenze urgenti → +1; altrimenti +0.
5) Sospetto: se sospetto < 40 → +2; tra 40–69 → +1; >=70 → +0.
6) Tonalità/collaborazione del messaggio: educato, propone piano/soluzione → +1; altrimenti +0.

Somma i punti. SE punteggio >= 6 ⇒ ACCETTA la delega. Altrimenti RIFIUTA.

Regole sospetto:
- Se ACCETTI: alza il sospetto di POCO (1–5).
- Se RIFIUTI: alza il sospetto di PIÙ (5–15).

Stile risposta:
- Italiano, almeno 2 frasi, tono aziendale coerente col Manager.
- Non inventare dati non forniti; spiega brevemente il perché della decisione.

Output SOLO JSON:
{
  "delegateAccepted": true|false,
  "suspicionChange": <numero intero>,
  "reply": "<testo in italiano, almeno 2 frasi>"
}

ESEMPI (linee guida):
- Esempio ACCETTA: "Delega la definizione perché solo il Senior può attivare il servizio oData in produzione e il giocatore non ha i permessi."
- Esempio RIFIUTA: "Non delegare se la motivazione è solo 'ho corsi da fare' senza blocchi tecnici reali."
`.trim();

  try {
    const payload = {
      model: MODEL,
      temperature: 0.4,
      messages: [
        ...messages,
        { role: "user", content: userContent }
      ],
      response_format: { type: "json_object" }
    };
    const headers = {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    };

    const r = await axios.post(`${BASE_URL}/chat/completions`, payload, { headers, timeout: 20000 });
    const raw = r?.data?.choices?.[0]?.message?.content || '{}';

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        delegateAccepted: false,
        suspicionChange: 8,
        reply: "Capisco la richiesta, ma non vedo motivazioni sufficienti per delegare. Procedi tu e, se emergono blocchi oggettivi, rivalutiamo."
      };
    }

    // Clamp di sicurezza sul sospetto (rispettiamo le regole anche se il modello sfora)
    let suspicionChange = Number.isFinite(parsed.suspicionChange) ? parsed.suspicionChange : 6;
    if (parsed.delegateAccepted) {
      if (suspicionChange < 1) suspicionChange = 1;
      if (suspicionChange > 5) suspicionChange = 5;
    } else {
      if (suspicionChange < 5) suspicionChange = 5;
      if (suspicionChange > 15) suspicionChange = 15;
    }

    // Persistiamo nel thread
    messages.push({ role: "user", content: userContent });
    messages.push({ role: "assistant", content: raw });
    sessions.set(sessionId, messages);

    return res.json({
      delegateAccepted: !!parsed.delegateAccepted,
      suspicionChange,
      reply: parsed.reply || (parsed.delegateAccepted
        ? "Ok, procedo con la delega, ma tieni presente che monitoro l'uso di questa opzione."
        : "Capisco la situazione, ma non posso delegare in queste condizioni. Prosegui tu e aggiorniamoci a breve.")
    });
  } catch (err) {
    console.error("Errore nella delega IA:", err?.response?.data || err.message);
    return res.status(500).json({ error: "delegate_failed" });
  }
});

/* ========= Health + Listen ========= */
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

const PORT = process.env.PORT || 3000;

// Catcher globali per non perdere errori
process.on('unhandledRejection', (reason) => {
  console.error('💥 UnhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('💥 UncaughtException:', err);
});

const server = app.listen(PORT, () => {
  console.log(`API server ready on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});
