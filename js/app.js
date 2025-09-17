// js/app.js
(() => {
  // ====== Config API Base URL ======
  const apiBaseUrl = `${window.location.protocol}//${window.location.hostname}:3000`;

  // ====== Costanti globali ======
  const PLAYER_ID = 99;
  const FALLBACK_TASK_TITLE = "Task di fallback";

  // ====== Stato Giorni ======
  let currentDay = 1;

  // ====== Traduzioni ======
  const translations = {
    en: {
      appTitle: "Corporate Chat",
      suspicionLabel: "Suspicion:",
      contactsLabel: "Contacts",
      selectContact: "Select a contact to start chatting",
      noMessages: "No messages yet",
      inputPlaceholder: "Type a message...",
      statusOnline: "Online",
      statusAway: "Away",
      statusOffline: "Offline",
    },
    it: {
      appTitle: "Chat Aziendale",
      suspicionLabel: "Sospetto:",
      contactsLabel: "Contatti",
      selectContact: "Seleziona un contatto per iniziare a chattare",
      noMessages: "Ancora nessun messaggio",
      inputPlaceholder: "Scrivi un messaggio...",
      statusOnline: "Online",
      statusAway: "Assente",
      statusOffline: "Offline",
    },
  };

  // ====== Contatti demo ======
  const contacts = [
    { id: 1, role: "Manager", status: "online", initial: "M", name: "Manager" },
    { id: 2, role: "Associate Manager", status: "away", initial: "AM", name: "Associate Manager" },
    { id: 3, role: "Senior", status: "online", initial: "S", name: "Senior" },
    { id: 4, role: "Associate", status: "offline", initial: "A", name: "Associate" },
    { id: PLAYER_ID, role: "Analyst", status: "online", initial: "Y", name: "You" }
  ];

  // ====== Override da Setup ======
  const savedCharacters = JSON.parse(localStorage.getItem("characters") || "{}");
  Object.entries(savedCharacters).forEach(([role, info]) => {
    const contact = contacts.find(c => c.role === role);
    if (contact) {
      contact.name = info.name || contact.name;
      contact.traits = info.traits || "";
      contact.initial = info.name
        ? info.name.split(" ").map(p => p[0]).join("").toUpperCase()
        : contact.initial;
    }
  });

  const managerSetup = savedCharacters["Manager"] || {
    name: "Manager",
    traits: "severo, aziendale"
  };

  // ====== Stato ======
  const tasks = [];
  let currentLanguage = localStorage.getItem("lang") || "it";
  let currentContact = null;
  let suspicionLevel = 0;
  let managerSessionId = null;
  let dayInterval = null;

  // Inizializza messaggi vuoti per ogni contatto
  const sampleMessages = contacts.reduce((acc, c) => {
    acc[c.id] = [];
    return acc;
  }, {});

  // ====== Cache DOM ======
  const contactsList = document.getElementById("contacts-list");
  const noContactSelected = document.getElementById("no-contact-selected");
  const contactHeader = document.getElementById("contact-header");
  const contactInitial = document.getElementById("contact-initial");
  const contactName = document.getElementById("contact-name");
  const contactStatus = document.getElementById("contact-status");

  const messagesContainer = document.getElementById("messages-container");
  const noMessages = document.getElementById("no-messages");

  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");

  const suspicionLevelSpan = document.getElementById("suspicion-level");

  const openTasksBtn = document.getElementById("open-tasks-btn");
  const openTasksModal = document.getElementById("open-tasks-modal");
  const closeTasksBtn = document.getElementById("close-tasks-btn");
  const tasksTableBody = document.getElementById("tasks-table-body");

  const currentLanguageSpan = document.getElementById("current-language");
  const requestTaskBtn = document.getElementById("request-task-btn");

  // 🔹 Popup riepilogo giornaliero
  const dailyModal = document.createElement("div");
  dailyModal.id = "daily-modal";
  dailyModal.className = "fixed inset-0 bg-black bg-opacity-50 hidden flex items-center justify-center z-50";
  dailyModal.innerHTML = `
    <div class="bg-white w-3/4 max-w-lg rounded-lg shadow-lg p-6 animate__animated animate__fadeInDown">
      <h2 class="text-lg font-semibold mb-4">Riepilogo Giornaliero <span id="day-label"></span></h2>
      <div id="daily-tasks" class="space-y-2 max-h-[50vh] overflow-y-auto"></div>
      <div class="flex justify-end mt-4">
        <button id="close-daily-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Chiudi</button>
      </div>
    </div>
  `;
  document.body.appendChild(dailyModal);

  // ====== Init Manager Session ======
  async function initManagerSession() {
    try {
      const res = await fetch(`${apiBaseUrl}/api/manager/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(managerSetup)
      });
      const data = await res.json();
      managerSessionId = data.sessionId;
      console.log("Manager session avviata:", managerSessionId);
    } catch (err) {
      console.error("Errore init session:", err);
    }
  }

  // ====== API ======
  const API = {
    async sendMessage(contactId, text) {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact || contact.role !== "Manager") {
        return {
          reply: "Scrivi al Manager, ancora mi devi sviluppare...",
          suspicionChange: 0,
          taskStatus: null
        };
      }
      try {
        const res = await fetch(`${apiBaseUrl}/api/manager/evaluate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: managerSessionId,
            suspicion: suspicionLevel,
            openTasks: tasks,
            taskTitle: tasks.length > 0 ? tasks[tasks.length - 1].title : "nessun task",
            playerMessage: text
          })
        });
        const data = await res.json();
        return {
          reply: data.reply || "Errore nella risposta del Manager.",
          suspicionChange: data.suspicionChange || 0,
          taskStatus: data.taskStatus || "failed"
        };
      } catch (err) {
        console.error("Errore fetch evaluate:", err);
        return { reply: "Non riesco a rispondere ora.", suspicionChange: 0, taskStatus: "failed" };
      }
    }
  };


  // ====== Genera Task ======
async function generateTask(managerId) {
  try {
    const res = await fetch(`${apiBaseUrl}/api/manager/new-task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: managerSessionId, suspicion: suspicionLevel, openTasks: tasks })
    });
    const data = await res.json();

 const task = {
   id: Date.now(),
   title: data.title,
   assignedBy: managerId,
   assignedTo: PLAYER_ID,
   status: "assigned",
   // 1..3 giorni direttamente
   deadlineDay: currentDay + (Math.floor(Math.random() * 3) + 1)
 };
 tasks.push(task);
 return task;

    // Normalizzazione legacy (solo se arriva ancora "deadline" vecchio)
    if (!task.deadlineDay && task.deadline) {
      const daysFromNow = Math.ceil((task.deadline - Date.now()) / (5 * 60 * 1000));
      task.deadlineDay = currentDay + Math.max(1, daysFromNow);
      delete task.deadline;
    }

    console.log('[generateTask][TRY] currentDay=%d deltaDays=%d deadlineDay=%d',
      currentDay, deltaDays, task.deadlineDay);

    tasks.push(task);
    return task;

  } catch (err) {
    console.error("Errore generazione task:", err);

    const deltaDays = Math.floor(Math.random() * 3) + 1; // 1..3 anche nel fallback
  const task = {
    id: Date.now(),
    title: FALLBACK_TASK_TITLE,
    assignedBy: managerId,
    assignedTo: PLAYER_ID,
    status: "assigned",
    // 1..3 giorni direttamente anche nel fallback
    deadlineDay: currentDay + (Math.floor(Math.random() * 3) + 1)
  };
  tasks.push(task);
  return task;
    }
}


  // ====== Giorno Corrente ======
  function updateDayLabel() {
    const dayLabel = document.getElementById("day-label");
    if (dayLabel) {
      dayLabel.textContent = `(Giorno ${currentDay})`;
    }
  }

  // ====== Mostra riepilogo giornaliero ======
function showDailySummary() {
  const dailyTasksDiv = document.getElementById("daily-tasks");
  dailyTasksDiv.innerHTML = "";

  if (tasks.length === 0) {
    dailyTasksDiv.innerHTML = `<p class="text-gray-500 italic">Nessun task oggi.</p>`;
  } else {
    tasks.forEach(task => {
      // 🔹 Normalizza se esiste ancora un campo "deadline"
      if (!task.deadlineDay && task.deadline) {
        const daysFromNow = Math.ceil((task.deadline - Date.now()) / (5 * 60 * 1000));
        task.deadlineDay = currentDay + Math.max(1, daysFromNow);
        delete task.deadline;
      }

      const label = task.deadlineDay > currentDay
        ? `Giorno ${task.deadlineDay}`
        : `Scaduto`;

      const div = document.createElement("div");
      div.className = "p-2 border rounded bg-gray-50";
      div.innerHTML = `
        <strong>${task.title}</strong><br>
        Stato: ${task.status}<br>
        Deadline: ${label}
      `;
      dailyTasksDiv.appendChild(div);
    });
  }

  updateDayLabel();
  dailyModal.classList.remove("hidden");
}


  // ====== Render Contacts ======
  function renderContacts() {
    contactsList.innerHTML = "";
    const visibleContacts = contacts.filter(c => c.id !== PLAYER_ID);
    visibleContacts.forEach((c) => {
      const row = document.createElement("div");
      row.className = `flex items-center space-x-3 p-2 rounded-lg cursor-pointer hover:bg-gray-100 ${
        currentContact?.id === c.id ? "bg-blue-50" : ""
      }`;
      row.dataset.id = c.id;
      row.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold">${c.initial}</div>
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-semibold text-gray-800 truncate">${c.name}</h3>
          <p class="text-xs flex items-center text-gray-500">
            <span class="w-2 h-2 rounded-full mr-1 ${
              c.status === "online" ? "bg-green-500" :
              c.status === "away" ? "bg-yellow-500" :
              "bg-gray-400"
            }"></span>
            ${translations[currentLanguage]["status" + c.status.charAt(0).toUpperCase() + c.status.slice(1)]}
          </p>
        </div>`;
      contactsList.appendChild(row);
      row.addEventListener("click", () => selectContact(c.id));
    });
  }

  // ====== Render Messages ======
  function renderMessages() {
    messagesContainer.innerHTML = "";
    if (!currentContact) {
      noMessages.style.display = "flex";
      return;
    }
    const messages = sampleMessages[currentContact.id] || [];
    if (messages.length === 0) {
      noMessages.style.display = "flex";
      return;
    }
    noMessages.style.display = "none";
    messages.forEach((m) => {
      const line = document.createElement("div");
      line.className = `flex ${m.sender === "user" ? "justify-end" : "justify-start"}`;
      const bubble = document.createElement("div");
      bubble.className = `max-w-xs px-4 py-2 ${m.sender === "user" ? "message-user" : "message-contact"}`;
      bubble.innerHTML = `
        <p class="text-sm">${m.text}</p>
        <p class="text-xs mt-1 text-right opacity-70">${m.time}</p>
      `;
      line.appendChild(bubble);
      messagesContainer.appendChild(line);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ====== Suspicion ======
  function updateSuspicion(newLevel) {
    suspicionLevel = Math.max(0, Math.min(100, newLevel));
    suspicionLevelSpan.textContent = `${suspicionLevel}%`;
    suspicionLevelSpan.style.color = suspicionLevel >= 70 ? "#ef4444" :
                                     suspicionLevel >= 30 ? "#f59e0b" : "";
  }

  // ====== Badge Task ======
  function updateTaskBadge() {
    const badge = document.getElementById("open-tasks-count");
    const count = tasks.filter(t => t.status === "assigned").length;
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

// ====== Render Tasks ======
function renderTasks() {
  tasksTableBody.innerHTML = "";
  if (tasks.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="6" class="p-4 text-center text-gray-500 italic">No open tasks</td>`;
    tasksTableBody.appendChild(row);
    updateTaskBadge();
    return;
  }

  tasks.forEach(task => {
    // 🔹 Normalizza se esiste ancora un campo "deadline"
    if (!task.deadlineDay && task.deadline) {
      const daysFromNow = Math.ceil((task.deadline - Date.now()) / (5 * 60 * 1000));
      task.deadlineDay = currentDay + Math.max(1, daysFromNow);
      delete task.deadline;
    }

    const deadlineLabel = task.deadlineDay > currentDay
      ? `Giorno ${task.deadlineDay}`
      : `Scaduto`;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="p-2 border">${task.title}</td>
      <td class="p-2 border">${contacts.find(c => c.id === task.assignedBy)?.name || "-"}</td>
      <td class="p-2 border">${contacts.find(c => c.id === task.assignedTo)?.name || "-"}</td>
      <td class="p-2 border">${task.status}</td>
      <td class="p-2 border">${deadlineLabel}</td>
      <td class="p-2 border">
        <button class="start-task-btn bg-green-500 text-white px-2 py-1 rounded text-xs mr-2" data-id="${task.id}">Inizia</button>
        <button class="delegate-task-btn bg-yellow-500 text-white px-2 py-1 rounded text-xs mr-2" data-id="${task.id}">Delega</button>
        <button class="fail-task-btn bg-red-500 text-white px-2 py-1 rounded text-xs" data-id="${task.id}">Ignora</button>
      </td>
    `;
    tasksTableBody.appendChild(row);
  });

  updateTaskBadge();
}

  // ====== Gestione azioni task ======
  tasksTableBody.addEventListener("click", (e) => {
    const taskId = Number(e.target.dataset.id);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (e.target.classList.contains("start-task-btn")) {
      task.status = "in_progress";
      alert(`QUIZ placeholder per: ${task.title}`);
      renderTasks();
    }

    if (e.target.classList.contains("delegate-task-btn")) {
      const colleagues = contacts.filter(c => c.id !== PLAYER_ID && c.role !== "Manager");
      if (colleagues.length === 0) return alert("Nessun collega disponibile!");
      const chosen = colleagues[Math.floor(Math.random() * colleagues.length)];
      task.status = "delegated";
      task.assignedTo = chosen.id;
      sampleMessages[chosen.id].push({
        text: `Ti è stato delegato: ${task.title}`,
        sender: "system",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      });
      renderTasks();
    }

    if (e.target.classList.contains("fail-task-btn")) {
      task.status = "failed";
      updateSuspicion(suspicionLevel + 10);
      renderTasks();
    }
  });

  // ====== Seleziona Contatto ======
  function selectContact(contactId) {
    const next = contacts.find((c) => c.id === contactId);
    if (!next) return;
    currentContact = next;
    noContactSelected.style.display = "none";
    contactHeader.style.display = "flex";
    contactInitial.textContent = currentContact.initial;
    contactName.textContent = currentContact.name;
    const statusKey = "status" + currentContact.status.charAt(0).toUpperCase() + currentContact.status.slice(1);
    contactStatus.textContent = `${currentContact.role} • ${translations[currentLanguage][statusKey]}`;
    renderMessages();
    renderContacts();
  }

  // ====== Invia Messaggio ======
  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentContact) return;
    const msg = { text, sender: "user", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    sampleMessages[currentContact.id].push(msg);
    messageInput.value = "";
    renderMessages();
    API.sendMessage(currentContact.id, text).then((res) => {
      const reply = { text: res.reply, sender: "contact", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
      sampleMessages[currentContact.id].push(reply);
      renderMessages();
      updateSuspicion(suspicionLevel + res.suspicionChange);
      if (res.taskStatus && tasks.length > 0) {
        tasks[tasks.length - 1].status = res.taskStatus;
        renderTasks();
      }
    });
  }

  // ====== Loop Giorni ======
  function startDayLoop() {
    return setInterval(() => {
      currentDay++;
      updateDayLabel();
      showDailySummary();
      const manager = contacts.find(c => c.role === "Manager");
      if (!manager) return;
      generateTask(manager.id).then((newTask) => {
        sampleMessages[manager.id].push({
          text: `Nuovo task assegnato: ${newTask.title}`,
          sender: manager.name,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        });
        if (currentContact && currentContact.id === manager.id) renderMessages();
        renderTasks();
      });
    }, 5 * 60 * 1000); // 5 min = 1 giorno
  }

  // ====== Eventi ======
  function setupEventListeners() {
    sendButton.addEventListener("click", sendMessage);
    messageInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } });

    closeTasksBtn.addEventListener("click", () => openTasksModal.classList.add("hidden"));
    openTasksBtn.addEventListener("click", () => {
      renderTasks();
      openTasksModal.classList.remove("hidden");
    });

    requestTaskBtn.addEventListener("click", () => {
      const manager = contacts.find(c => c.role === "Manager");
      if (!manager) return;
      generateTask(manager.id).then((newTask) => {
        sampleMessages[manager.id].push({
          text: `New task assigned: ${newTask.title}`,
          sender: manager.name,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        });
        if (currentContact && currentContact.id === manager.id) renderMessages();
        renderTasks();
        updateTaskBadge();
      });
    });

    document.getElementById("menu-btn").addEventListener("click", () => {
      localStorage.setItem("gameState", "in_progress");
      window.location.href = "setup.html";
    });

    document.getElementById("close-daily-btn").addEventListener("click", () => {
      dailyModal.classList.add("hidden");
    });
  }

  // ====== Init ======
  function initApp() {
    currentLanguageSpan.textContent = currentLanguage.toUpperCase();
    updateSuspicion(0);
    renderContacts();
    setupEventListeners();
    initManagerSession();
    if (dayInterval) clearInterval(dayInterval);
    dayInterval = startDayLoop();
    updateDayLabel();
  }

  initApp();
})();
