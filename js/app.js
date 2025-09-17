// js/app.js
(() => {
  // ====== State & Data ======
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

  // Demo contacts (con ruoli)
  const contacts = [
    { id: 1, name: "Francesco Viola", initial: "FV", role: "Manager", status: "online", rapport: 50, busyLevel: 20 },
    { id: 2, name: "Giuseppe Origlia", initial: "GO", role: "Associate Manager", status: "away", rapport: 40, busyLevel: 30 },
    { id: 3, name: "Luciano Rinaldi", initial: "LR", role: "Associate Manager", status: "offline", rapport: 35, busyLevel: 60 },
    { id: 4, name: "Sebastiano Fotia", initial: "SF", role: "Senior", status: "online", rapport: 45, busyLevel: 50 },
    { id: 5, name: "Michael Brown", initial: "MB", role: "Senior", status: "offline", rapport: 30, busyLevel: 70 },
    { id: 6, name: "Marco Esposito", initial: "ME", role: "Associate", status: "online", rapport: 25, busyLevel: 20 },
    { id: 7, name: "Elena Russo", initial: "ER", role: "Associate", status: "offline", rapport: 25, busyLevel: 40 },
    { id: 99, name: "You", initial: "Y", role: "Analyst", status: "online" }

  ];

  // Demo messages
  const sampleMessages = {
    1: [
      { text: "Hi there! How are you?", sender: "contact", time: "10:30 AM" },
      { text: "I'm good, thanks! Just working on the quarterly report.", sender: "user", time: "10:32 AM" },
      { text: "Great! Let me know if you need any help with it.", sender: "contact", time: "10:33 AM" },
    ]
  };

  // ====== Tasks (inizialmente vuoti) ======
  const tasks = [];


  // ====== API layer (mock) ======
  const API = {
    async getContacts() {
      return contacts;
    },
    async getMessages(contactId) {
      return sampleMessages[contactId] || [];
    },
    async sendMessage(contactId, text) {
      const replyPool = [
        "Got it, thanks!",
        "I'll look into that.",
        "Let me check and get back to you.",
        "Sounds good!",
        "Can you send me more details?",
      ];
      return {
        reply: replyPool[Math.floor(Math.random() * replyPool.length)],
        suspicion: Math.min(100, suspicionLevel + 5),
      };
    },
  };

  // ====== App state ======
  let currentLanguage = localStorage.getItem("lang") || "en";
  let currentContact = null;
  let suspicionLevel = 0;

  // ====== DOM Cache ======
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

  const languageToggle = document.getElementById("language-toggle");
  const languageDropdown = document.getElementById("language-dropdown");
  const currentLanguageSpan = document.getElementById("current-language");

  const suspicionLabel = document.getElementById("suspicion-label");
  const suspicionLevelSpan = document.getElementById("suspicion-level");

  // ====== DOM for tasks modal ======
  const openTasksBtn = document.getElementById("open-tasks-btn");
  const openTasksModal = document.getElementById("open-tasks-modal");
  const closeTasksBtn = document.getElementById("close-tasks-btn");
  const tasksTableBody = document.getElementById("tasks-table-body");

  // ====== Render tasks ======
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

  // ====== Rendering contacts ======
function renderContacts() {
  contactsList.innerHTML = "";

  contacts.forEach((contact) => {
    const row = document.createElement("div");
    row.className = `flex items-center space-x-3 p-2 rounded-lg cursor-pointer hover:bg-gray-100 ${
      currentContact?.id === contact.id ? "bg-blue-50" : ""
    }`;
    row.dataset.id = contact.id;

    const initial = document.createElement("div");
    initial.className =
      "w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold";
    initial.textContent = contact.initial;

    const details = document.createElement("div");
    details.className = "flex-1 min-w-0";

    const name = document.createElement("h3");
    name.className = "text-sm font-semibold text-gray-800 truncate";
    name.textContent = contact.name;

    const status = document.createElement("p");
    status.className = "text-xs flex items-center";

    const statusDot = document.createElement("span");
    statusDot.className = `w-2 h-2 rounded-full mr-1 status-${contact.status}`;

    const statusText = document.createElement("span");
    statusText.className = "text-gray-500";
    const statusKey =
      "status" + contact.status.charAt(0).toUpperCase() + contact.status.slice(1);
    statusText.textContent = translations[currentLanguage][statusKey];

    status.appendChild(statusDot);
    status.appendChild(statusText);

    details.appendChild(name);
    details.appendChild(status);

    row.appendChild(initial);
    row.appendChild(details);

    contactsList.appendChild(row);
  });
}

  // ====== Rendering messages ======
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

      const text = document.createElement("p");
      text.className = "text-sm";
      text.textContent = m.text;

      const time = document.createElement("p");
      time.className = "text-xs mt-1 text-right opacity-70";
      time.textContent = m.time;

      bubble.appendChild(text);
      bubble.appendChild(time);
      line.appendChild(bubble);
      messagesContainer.appendChild(line);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ====== Task Notifications ======
  function updateTaskNotification() {
    const count = tasks.filter(t => t.status === "assigned").length;
    const badge = document.getElementById("open-tasks-count");

    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  // ====== Manager Logic ======
  function managerShouldAssignTask(managerId) {
    // Conta i task aperti del player
    const openTasks = tasks.filter(
      t => t.assignedTo === 99 && ["assigned", "in_progress"].includes(t.status)
    );

    if (openTasks.length >= 3) return false; // già troppo lavoro

    // Se un task scade entro 2 minuti → aspetta
    const urgentTask = openTasks.find(t => t.deadline - Date.now() < 2 * 60 * 1000);
    if (urgentTask) return false;

    // Random factor → non sempre assegna
    if (Math.random() < 0.5) return false;

    return true;
  }

  function generateTask(managerId) {
    const taskTemplates = [
      "Prepare Q1 financial report",
      "Review code for ticket #342",
      "Update project documentation",
      "Create a test plan for module X",
      "Investigate bug in system Y"
    ];

    const task = {
      id: Date.now(),
      title: taskTemplates[Math.floor(Math.random() * taskTemplates.length)],
      assignedBy: managerId,
      assignedTo: 99, // il giocatore
      status: "assigned",
      deadline: Date.now() + (3 + Math.floor(Math.random() * 5)) * 60 * 1000 // 3–7 min
    };

    tasks.push(task);
    return task;
  }

  // ====== Logic ======
function selectContact(contactId) {
  const next = contacts.find((c) => c.id === contactId);
  if (!next) return;

  currentContact = next;

  noContactSelected.style.display = "none";
  contactHeader.style.display = "flex";
  contactInitial.textContent = currentContact.initial;
  contactName.textContent = currentContact.name;

  // Mostra ruolo sotto al nome
  contactStatus.textContent = `${currentContact.role} • ${translations[currentLanguage][
    "status" + currentContact.status.charAt(0).toUpperCase() + currentContact.status.slice(1)
  ]}`;

  renderMessages();
  renderContacts();
}

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentContact) return;

    const msg = {
      text,
      sender: "user",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    if (!sampleMessages[currentContact.id]) sampleMessages[currentContact.id] = [];
    sampleMessages[currentContact.id].push(msg);
    messageInput.value = "";
    renderMessages();

    // Simula risposta via API mock
    API.sendMessage(currentContact.id, text).then((res) => {
      const reply = {
        text: res.reply,
        sender: "contact",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      sampleMessages[currentContact.id].push(reply);
      renderMessages();
      updateSuspicion(res.suspicion);
    });
  }

  function updateSuspicion(newLevel) {
    suspicionLevel = newLevel;
    suspicionLevelSpan.textContent = `${suspicionLevel}%`;

    if (suspicionLevel >= 70) {
      suspicionLevelSpan.style.color = "#ef4444"; // red-500
    } else if (suspicionLevel >= 30) {
      suspicionLevelSpan.style.color = "#f59e0b"; // amber-500
    } else {
      suspicionLevelSpan.style.color = ""; // default
    }
  }

  function changeLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem("lang", lang);
    currentLanguageSpan.textContent = lang.toUpperCase();
    updateUI();
  }

  function updateUI() {
    document.getElementById("app-title").textContent = translations[currentLanguage].appTitle;
    suspicionLabel.textContent = translations[currentLanguage].suspicionLabel;
    document.getElementById("contacts-label").textContent = translations[currentLanguage].contactsLabel;
    document.getElementById("no-contact-selected").textContent = translations[currentLanguage].selectContact;
    document.getElementById("no-messages").textContent = translations[currentLanguage].noMessages;
    messageInput.placeholder = translations[currentLanguage].inputPlaceholder;

   if (currentContact) {
       const statusKey =
         "status" + currentContact.status.charAt(0).toUpperCase() + currentContact.status.slice(1);
       contactStatus.textContent =
         `${currentContact.role} • ${translations[currentLanguage][statusKey]}`;
     }


    renderContacts();
  }

  // ====== Events ======
  function setupEventListeners() {
    sendButton.addEventListener("click", sendMessage);
    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
      }
    });

    languageToggle.addEventListener("click", () => {
      languageDropdown.classList.toggle("hidden");
    });

    document.querySelectorAll("[data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => {
        changeLanguage(btn.dataset.lang);
        languageDropdown.classList.add("hidden");
      });
    });

    document.addEventListener("click", (e) => {
      if (!languageToggle.contains(e.target) && !languageDropdown.contains(e.target)) {
        languageDropdown.classList.add("hidden");
      }
    });

    contactsList.addEventListener("click", (e) => {
      const row = e.target.closest("[data-id]");
      if (!row) return;
      const id = Number(row.dataset.id);
      selectContact(id);
    });

    // Open Tasks modal
    openTasksBtn.addEventListener("click", () => {
      renderTasks();
      openTasksModal.classList.remove("hidden");
    });

    closeTasksBtn.addEventListener("click", () => {
      openTasksModal.classList.add("hidden");
    });

    openTasksModal.addEventListener("click", (e) => {
      if (e.target === openTasksModal) openTasksModal.classList.add("hidden");
    });
  }

  // ====== Init ======
  function initApp() {
    currentLanguageSpan.textContent = currentLanguage.toUpperCase();
    updateSuspicion(0);

    renderContacts();
    setupEventListeners();
    updateUI();

    updateTaskNotification();

    if (window.feather) feather.replace();
    if (window.AOS) AOS.init();
  }

  initApp();

  // ====== Ciclo periodico per generare task ======
setInterval(() => {
  const manager = contacts.find(c => c.role === "Manager");
  if (!manager) return;

  if (managerShouldAssignTask(manager.id)) {
    const newTask = generateTask(manager.id);

    // Notifica in chat
    sampleMessages[manager.id] = sampleMessages[manager.id] || [];
    sampleMessages[manager.id].push({
      text: `New task assigned: ${newTask.title}`,
      sender: manager.name,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });

    if (currentContact && currentContact.id === manager.id) {
      renderMessages();
    }

    // === NEW: aggiorna badge + suona beep ===
    updateTaskNotification();
    const sound = document.getElementById("task-sound");
    if (sound) {
      sound.currentTime = 0;
      sound.play();
    }

    console.log("New task created:", newTask);
  }
}, 2 * 60 * 1000);
})();
