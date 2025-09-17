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
  let currentLanguage = localStorage.getItem("lang") || "it";
  let currentContact = null;
  let suspicionLevel = 0;
  let managerSessionId = null;
  let taskInterval = null;
  const sampleMessages = {};

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

  // ====== Init Manager Session ======
  async function initManagerSession() {
    try {
      const res = await fetch("http://192.168.1.12:3000/api/manager/init", {
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
        const replyPool = [
          "Got it, thanks!",
          "I'll look into that.",
          "Let me check and get back to you.",
          "Sounds good!",
          "Can you send me more details?",
        ];
        return {
          reply: replyPool[Math.floor(Math.random() * replyPool.length)],
          suspicionChange: 0
        };
      }

      try {
        const res = await fetch("http://192.168.1.12:3000/api/manager/evaluate", {
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
      const res = await fetch("http://192.168.1.12:3000/api/manager/new-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: managerSessionId, suspicion: suspicionLevel, openTasks: tasks })
      });
      const data = await res.json();
      const task = {
        id: Date.now(),
        title: data.title,
        assignedBy: managerId,
        assignedTo: 99,
        status: "assigned",
        deadline: Date.now() + (3 + Math.floor(Math.random() * 5)) * 60 * 1000
      };
      tasks.push(task);
      return task;
    } catch (err) {
      console.error("Errore generazione task:", err);
      const task = {
        id: Date.now(),
        title: "Task di fallback",
        assignedBy: managerId,
        assignedTo: 99,
        status: "assigned",
        deadline: Date.now() + 5 * 60 * 1000
      };
      tasks.push(task);
      return task;
    }
  }

  // ====== Render Contacts ======
  function renderContacts() {
    contactsList.innerHTML = "";
    const visibleContacts = contacts.filter(c => c.id !== 99);
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

  // ====== Aggiorna badge dei task ======
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

  // ====== Eventi ======
  function setupEventListeners() {
    sendButton.addEventListener("click", sendMessage);
    messageInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } });
    contactsList.addEventListener("click", (e) => {
      const row = e.target.closest("[data-id]");
      if (!row) return;
      selectContact(Number(row.dataset.id));
    });

    closeTasksBtn.addEventListener("click", () => openTasksModal.classList.add("hidden"));
    openTasksBtn.addEventListener("click", () => {
      renderTasks();
      openTasksModal.classList.remove("hidden");
    });

    requestTaskBtn.addEventListener("click", () => {
      const manager = contacts.find(c => c.role === "Manager");
      if (!manager) return;
      if (taskInterval) clearInterval(taskInterval);
      taskInterval = startTaskLoop();

      generateTask(manager.id).then((newTask) => {
        sampleMessages[manager.id] = sampleMessages[manager.id] || [];
        sampleMessages[manager.id].push({
          text: `New task assigned: ${newTask.title}`,
          sender: manager.name,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        });
        if (currentContact && currentContact.id === manager.id) renderMessages();
        renderTasks();
        updateTaskBadge(); // 🔥 qui

        const sound = document.getElementById("task-sound");
        if (sound) {
          sound.currentTime = 0;
          sound.play();
        }
      });
    });
  }

  // ====== Render Tasks ======
  function renderTasks() {
    tasksTableBody.innerHTML = "";
    if (tasks.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="5" class="p-4 text-center text-gray-500 italic">No open tasks</td>`;
      tasksTableBody.appendChild(row);
      return;
    }
    tasks.forEach(task => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="p-2 border">${task.title}</td>
        <td class="p-2 border">${contacts.find(c => c.id === task.assignedBy)?.name || "-"}</td>
        <td class="p-2 border">${contacts.find(c => c.id === task.assignedTo)?.name || "-"}</td>
        <td class="p-2 border">${task.status}</td>
        <td class="p-2 border">${new Date(task.deadline).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</td>
      `;
      tasksTableBody.appendChild(row);
    });
  }

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
    if (!sampleMessages[currentContact.id]) sampleMessages[currentContact.id] = [];
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
        updateTaskBadge(); // 🔥 qui
      }
    });
  }

  // ====== Ciclo Task ======
  function startTaskLoop() {
    return setInterval(() => {
      const manager = contacts.find(c => c.role === "Manager");
      if (!manager) return;
      if (tasks.filter(t => t.assignedTo === 99 && ["assigned","in_progress"].includes(t.status)).length >= 3) return;
      generateTask(manager.id).then((newTask) => {
        sampleMessages[manager.id] = sampleMessages[manager.id] || [];
        sampleMessages[manager.id].push({
          text: `New task assigned: ${newTask.title}`,
          sender: manager.name,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        });
        if (currentContact && currentContact.id === manager.id) renderMessages();
        renderTasks();
        updateTaskBadge(); // 🔥 qui

        const sound = document.getElementById("task-sound");
        if (sound) {
          sound.currentTime = 0;
          sound.play();
        }
      });
    }, 2 * 60 * 1000);
  }

  // ====== Init ======
  function initApp() {
    currentLanguageSpan.textContent = currentLanguage.toUpperCase();
    updateSuspicion(0);
    renderContacts();
    setupEventListeners();
    initManagerSession();
    if (taskInterval) clearInterval(taskInterval);
    taskInterval = startTaskLoop();
  }

  initApp();
})();
