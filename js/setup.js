// js/setup.js

document.addEventListener("DOMContentLoaded", () => {
  const roleSelect = document.getElementById("role-select");
  const addCharacterBtn = document.getElementById("add-character-btn");
  const charactersContainer = document.getElementById("characters-container");
  const startGameBtn = document.getElementById("start-game-btn");

  // Per tenere traccia dei personaggi aggiunti
  let characters = [];

  // Funzione per creare un blocco personaggio
  function createCharacterBlock(role) {
    // Controlla se quel ruolo è già stato aggiunto
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

    // Rimuovi personaggio
    wrapper.querySelector(".remove-character").addEventListener("click", () => {
      characters = characters.filter(r => r !== role);
      wrapper.remove();
    });

    charactersContainer.appendChild(wrapper);
  }

  // Aggiungi personaggio al click
  addCharacterBtn.addEventListener("click", () => {
    const role = roleSelect.value;
    if (!role) {
      alert("Seleziona un ruolo prima di aggiungere.");
      return;
    }
    createCharacterBlock(role);
  });

  // Avvia Gioco
  startGameBtn.addEventListener("click", () => {
    const data = {};

    document.querySelectorAll("#characters-container > div").forEach(block => {
      const role = block.dataset.role;
      const name = block.querySelector(".name-input").value.trim() || role;
      const traits = block.querySelector(".traits-input").value.trim();

      data[role] = { name, traits };
    });

    // Salva su localStorage
    localStorage.setItem("characters", JSON.stringify(data));

    // Vai al gioco
    window.location.href = "index.html";
  });
});
