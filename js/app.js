// js/app.js
(() => {
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
    { id: 99, role: "Analyst", status: "online", initial: "Y", name: "You" }
  ];

  // ====== Override da Setup (se presenti) ======
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
  let suspicionLevel = 0;
  let currentContact = null;
  let currentLanguage = localStorage.getItem("lang") || "en";
  let managerSessionId = null;

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

  const suspicionLabel = document.getElementById("suspicion-label");
  const suspicionLevelSpan = document.getElementById("suspicion-level");

  const openTasksBtn = document.getElementById("open-tasks-btn");
  const openTasksModal = document.getElementById("open-tasks-modal");
  const closeTasksBtn = document.getElementById("close-tasks-btn");
  const tasksTableBody = document.getElementById("tasks-table-body");

  const currentLanguageSpan = document.getElementById("current-language");
  const languageToggle = document.getElementById("language-toggle");
  const languageDropdown = document.getElementById("language-dropdown");

  // ====== Messaggi demo ======
  const sampleMessages = { 1: [] };

  // ====== Init Manager ======
  async function initManagerSession() {
    try {
      const res = await fetch("http://localhost:3000/api/manager/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(managerSetup)
      });
      const data = await res.json();
      managerSessionId = data.sessionId;
      console.log(" Manager session:", managerSessionId);
    } catch (err) {
      console.error("Errore init session:", err);
    }
  }

  // ====== API Layer ======
  const API = {
    async sendMessage(contactId, text) {
      const contact = contacts.find(c => c.id === contactId);

      if (!contact || contact.role !== "Manager") {
        const replyPool = [
          "Got it, thanks!",
          "I'll look into that.",
          "Let me check and get back to you.",
          "Sounds good!",
          "Can you send me more details?",
        ];
        return { reply: replyPool[Math.floor(Math.random() * replyPool.length)], suspicionChange: 0 };
      }

      try {
        const res = await fetch("http://localhost:3000/api/manager/evaluate", {
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
        console.error("Errore evaluate:", err);
        return { reply: "Non riesco a rispondere ora.", suspicionChange: 0, taskStatus: "failed" };
      }
    }
  };

  // ====== Render ======
  function renderContacts() {
    contactsList.innerHTML = "";
    contacts.forEach((c) => {
      const row = document.createElement("div");
      row.className = `flex items-center space-x-3 p-2 rounded-lg cursor-pointer hover:bg-gray-100 ${currentContact?.id === c.id ? "bg-blue-50" : ""}`;
      row.dataset.id = c.id;

      row.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold">${c.initial}</div>
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-semibold text-gray-800 truncate">${c.name}</h3>
          <p class="text-xs text-gray-500"><span class="w-2 h-2 rounded-full inline-block mr-1 bg-green-500"></span>${c.role}</p>
        </div>`;
      contactsList.appendChild(row);
    });
  }

  function renderMessages() {
    messagesContainer.innerHTML = "";
    if (!currentContact) {
      noMessages.style.display = "flex";
      return;
    }
    const messages = sampleMessages[currentContact.id] || [];
    if (!messages.length) {
      noMessages.style.display = "flex";
      return;
    }
    noMessages.style.display = "none";
    messages.forEach((m) => {
      const line = document.createElement("div");
      line.className = `flex ${m.sender === "user" ? "justify-end" : "justify-start"}`;
      line.innerHTML = `<div class="max-w-xs px-4 py-2 ${m.sender === "user" ? "message-user" : "message-contact"}">
        <p class="text-sm">${m.text}</p>
        <p class="text-xs mt-1 text-right opacity-70">${m.time}</p>
      </div>`;
      messagesContainer.appendChild(line);
    });
  }

  function renderTasks() {
    tasksTableBody.innerHTML = "";
    if (!tasks.length) {
      tasksTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500 italic">No open tasks</td></tr>`;
      return;
    }
    tasks.forEach(t => {
      tasksTableBody.innerHTML += `
        <tr>
          <td class="p-2 border">${t.title}</td>
          <td class="p-2 border">${contacts.find(c => c.id === t.assignedBy)?.name || "-"}</td>
          <td class="p-2 border">${contacts.find(c => c.id === t.assignedTo)?.name || "-"}</td>
          <td class="p-2 border">${t.status}</td>
          <td class="p-2 border">${new Date(t.deadline).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</td>
        </tr>`;
    });
  }

  // ====== Messaging ======
  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentContact) return;

    const msg = { text, sender: "user", time: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) };
    sampleMessages[currentContact.id] = sampleMessages[currentContact.id] || [];
    sampleMessages[currentContact.id].push(msg);
    messageInput.value = "";
    renderMessages();

    API.sendMessage(currentContact.id, text).then(res => {
      const reply = { text: res.reply, sender: "contact", time: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) };
      sampleMessages[currentContact.id].push(reply);
      renderMessages();
      suspicionLevel += res.suspicionChange;
      suspicionLevelSpan.textContent = suspicionLevel + "%";
      if (res.taskStatus && tasks.length > 0) {
        tasks[tasks.length - 1].status = res.taskStatus;
        renderTasks();
      }
    });
  }

  // ====== Events ======
  function setupEvents() {
    sendButton.addEventListener("click", sendMessage);
    messageInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } });
    contactsList.addEventListener("click", e => {
      const row = e.target.closest("[data-id]");
      if (!row) return;
      currentContact = contacts.find(c => c.id === Number(row.dataset.id));
      contactHeader.style.display = "flex";
      noContactSelected.style.display = "none";
      contactInitial.textContent = currentContact.initial;
      contactName.textContent = currentContact.name;
      contactStatus.textContent = currentContact.role;
      renderContacts();
      renderMessages();
    });
    openTasksBtn.addEventListener("click", () => { renderTasks(); openTasksModal.classList.remove("hidden"); });
    closeTasksBtn.addEventListener("click", () => openTasksModal.classList.add("hidden"));
  }

  // ====== Init ======
  function initApp() {
    renderContacts();
    setupEvents();
    initManagerSession();
  }

  initApp();
})();
