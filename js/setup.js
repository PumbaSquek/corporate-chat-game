// js/setup.js
document.addEventListener("DOMContentLoaded", () => {
  const roleSelect = document.getElementById("role-select");
  const addCharacterBtn = document.getElementById("add-character-btn");
  const charactersContainer = document.getElementById("characters-container");
  const startGameBtn = document.getElementById("start-game-btn");

  const builderSection = document.getElementById("builder-section");
  const lockedBanner = document.getElementById("locked-banner");

  const resumeControls = document.getElementById("resume-controls");
  const resumeGameBtn = document.getElementById("resume-game-btn");
  const newGameBtn = document.getElementById("new-game-btn");

  // Per tenere traccia dei personaggi aggiunti
  let characters = [];

  // ===== UI helpers =====
  function disableBuilderUI(disabled) {
    // bottone aggiungi
    addCharacterBtn.disabled = disabled;
    addCharacterBtn.classList.toggle("opacity-50", disabled);
    addCharacterBtn.classList.toggle("cursor-not-allowed", disabled);
    // select ruoli
    roleSelect.disabled = disabled;
    roleSelect.classList.toggle("opacity-50", disabled);
    roleSelect.classList.toggle("cursor-not-allowed", disabled);
  }

  function setLayoutLocked(isLocked) {
    if (isLocked) {
      // nascondi tutto il builder, mostra banner e controlli resume
      builderSection.classList.add("hidden");
      lockedBanner.classList.remove("hidden");
      resumeControls.classList.remove("hidden");
      disableBuilderUI(true);
    } else {
      builderSection.classList.remove("hidden");
      lockedBanner.classList.add("hidden");
      resumeControls.classList.add("hidden");
      disableBuilderUI(false);
    }
  }

  // ===== Builder: crea blocco personaggio =====
  function createCharacterBlock(role) {
    if (characters.includes(role)) {
      alert(`${role} è già stato aggiunto.`);
      return;
    }

    characters.push(role);

    const wrapper = document.createElement("div");
    wrapper.className = "p-4 border rounded-md bg-gray-50";
    wrapper.dataset.role = role;

    wrapper.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <h3 class="font-semibold text-gray-800">${role}</h3>
        <button type="button" class="remove-character text-red-500 hover:text-red-700 text-sm">
          Rimuovi
        </button>
      </div>
      <label class="block text-sm mb-1">Nome</label>
      <input type="text" class="name-input w-full p-2 border rounded mb-3" placeholder="Inserisci nome ${role}">
      <label class="block text-sm mb-1">Carattere</label>
      <textarea class="traits-input w-full p-2 border rounded" rows="2" placeholder="Descrivi il carattere del ${role}"></textarea>
    `;

    wrapper.querySelector(".remove-character").addEventListener("click", () => {
      characters = characters.filter(r => r !== role);
      wrapper.remove();
    });

    charactersContainer.appendChild(wrapper);
  }

  // ===== Aggiungi personaggio =====
  addCharacterBtn.addEventListener("click", () => {
    const role = roleSelect.value;
    if (!role) {
      alert("Seleziona un ruolo prima di aggiungere.");
      return;
    }
    createCharacterBlock(role);
  });

  // ===== Stato gioco & layout =====
  const gameState = localStorage.getItem("gameState");
  // Se c'è una partita in corso, blocchiamo il builder e mostriamo Riprendi/Nuova partita
  setLayoutLocked(gameState === "in_progress");

  // ===== Avvia nuova partita =====
  startGameBtn.addEventListener("click", () => {
    const data = {};
    document.querySelectorAll("#characters-container > div").forEach(block => {
      const role = block.dataset.role;
      const name = block.querySelector(".name-input").value.trim() || role;
      const traits = block.querySelector(".traits-input").value.trim();
      data[role] = { name, traits };
    });

    localStorage.setItem("characters", JSON.stringify(data));
    localStorage.setItem("gameState", "in_progress"); // segna partita attiva
    window.location.href = "index.html";
  });

  // ===== Riprendi partita =====
  resumeGameBtn?.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  // ===== Nuova partita (reset) =====
  newGameBtn?.addEventListener("click", () => {
    localStorage.removeItem("characters");
    localStorage.setItem("gameState", "ended");
    // sblocca il layout (senza reload potresti voler pulire charactersContainer)
    characters = [];
    charactersContainer.innerHTML = "";
    setLayoutLocked(false);
  });
});
