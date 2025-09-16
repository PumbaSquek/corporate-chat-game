
        document.addEventListener('DOMContentLoaded', function() {
            feather.replace();
            AOS.init();

            // Translations
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
                    statusOffline: "Offline"
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
                    statusOffline: "Offline"
                }
            };

            // Sample data
            const contacts = [
                { id: 1, name: "John Doe", initial: "JD", status: "online" },
                { id: 2, name: "Alice Smith", initial: "AS", status: "away" },
                { id: 3, name: "Bob Johnson", initial: "BJ", status: "offline" },
                { id: 4, name: "Emma Wilson", initial: "EW", status: "online" },
                { id: 5, name: "Michael Brown", initial: "MB", status: "offline" }
            ];

            const sampleMessages = {
                1: [
                    { text: "Hi there! How are you?", sender: "contact", time: "10:30 AM" },
                    { text: "I'm good, thanks! Just working on the quarterly report.", sender: "user", time: "10:32 AM" },
                    { text: "Great! Let me know if you need any help with it.", sender: "contact", time: "10:33 AM" }
                ],
                2: [
                    { text: "Don't forget about the meeting tomorrow at 2 PM.", sender: "contact", time: "Yesterday" },
                    { text: "Got it! I'll be there.", sender: "user", time: "Yesterday" }
                ],
                3: [],
                4: [
                    { text: "The project deadline has been extended to next Friday.", sender: "contact", time: "Monday" },
                    { text: "That's great news! We'll have more time to polish everything.", sender: "user", time: "Monday" }
                ],
                5: []
            };

            // Current state
            let currentLanguage = 'en';
            let currentContact = null;
            let suspicionLevel = 0;

            // DOM elements
            const contactsList = document.getElementById('contacts-list');
            const noContactSelected = document.getElementById('no-contact-selected');
            const contactHeader = document.getElementById('contact-header');
            const contactInitial = document.getElementById('contact-initial');
            const contactName = document.getElementById('contact-name');
            const contactStatus = document.getElementById('contact-status');
            const messagesContainer = document.getElementById('messages-container');
            const noMessages = document.getElementById('no-messages');
            const messageInput = document.getElementById('message-input');
            const sendButton = document.getElementById('send-button');
            const languageToggle = document.getElementById('language-toggle');
            const languageDropdown = document.getElementById('language-dropdown');
            const currentLanguageSpan = document.getElementById('current-language');

            // Initialize the app
            function initApp() {
                renderContacts();
                setupEventListeners();
                updateUI();
            }

            // Render contacts in the sidebar
            function renderContacts() {
                contactsList.innerHTML = '';
                
                contacts.forEach(contact => {
                    const contactElement = document.createElement('div');
                    contactElement.className = `flex items-center space-x-3 p-2 rounded-lg cursor-pointer hover:bg-gray-100 ${currentContact?.id === contact.id ? 'bg-blue-50' : ''}`;
                    contactElement.dataset.id = contact.id;
                    
                    const initial = document.createElement('div');
                    initial.className = 'w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold';
                    initial.textContent = contact.initial;
                    
                    const details = document.createElement('div');
                    details.className = 'flex-1 min-w-0';
                    
                    const name = document.createElement('h3');
                    name.className = 'text-sm font-semibold text-gray-800 truncate';
                    name.textContent = contact.name;
                    
                    const status = document.createElement('p');
                    status.className = 'text-xs flex items-center';
                    
                    const statusDot = document.createElement('span');
                    statusDot.className = `w-2 h-2 rounded-full mr-1 status-${contact.status}`;
                    
                    const statusText = document.createElement('span');
                    statusText.className = 'text-gray-500';
                    statusText.textContent = translations[currentLanguage][`status${contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}`];
                    
                    status.appendChild(statusDot);
                    status.appendChild(statusText);
                    details.appendChild(name);
                    details.appendChild(status);
                    contactElement.appendChild(initial);
                    contactElement.appendChild(details);
                    
                    contactElement.addEventListener('click', () => selectContact(contact.id));
                    contactsList.appendChild(contactElement);
                });
            }

            // Select a contact and show their chat
            function selectContact(contactId) {
                currentContact = contacts.find(c => c.id === contactId);
                updateUI();
                renderMessages();
            }

            // Render messages for the selected contact
            function renderMessages() {
                messagesContainer.innerHTML = '';
                
                if (!currentContact) {
                    noMessages.style.display = 'flex';
                    return;
                }
                
                const messages = sampleMessages[currentContact.id] || [];
                
                if (messages.length === 0) {
                    noMessages.style.display = 'flex';
                    return;
                }
                
                noMessages.style.display = 'none';
                
                messages.forEach(message => {
                    const messageElement = document.createElement('div');
                    messageElement.className = `flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`;
                    
                    const messageBubble = document.createElement('div');
                    messageBubble.className = `max-w-xs px-4 py-2 ${message.sender === 'user' ? 'message-user' : 'message-contact'}`;
                    
                    const messageText = document.createElement('p');
                    messageText.className = 'text-sm';
                    messageText.textContent = message.text;
                    
                    const messageTime = document.createElement('p');
                    messageTime.className = 'text-xs mt-1 text-right opacity-70';
                    messageTime.textContent = message.time;
                    
                    messageBubble.appendChild(messageText);
                    messageBubble.appendChild(messageTime);
                    messageElement.appendChild(messageBubble);
                    messagesContainer.appendChild(messageElement);
                });
                
                // Scroll to bottom
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            // Send a new message
            function sendMessage() {
                const text = messageInput.value.trim();
                if (!text || !currentContact) return;
                
                // Add user message
                const newUserMessage = {
                    text: text,
                    sender: 'user',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                
                if (!sampleMessages[currentContact.id]) {
                    sampleMessages[currentContact.id] = [];
                }
                
                sampleMessages[currentContact.id].push(newUserMessage);
                messageInput.value = '';
                renderMessages();
                
                // Simulate response after 1-2 seconds
                setTimeout(() => {
                    const responses = [
                        "Got it, thanks!",
                        "I'll look into that.",
                        "Let me check and get back to you.",
                        "Sounds good!",
                        "We should discuss this in our next meeting.",
                        "Can you send me more details about this?",
                        "I agree with your point.",
                        "Interesting suggestion."
                    ];
                    
                    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                    
                    const newContactMessage = {
                        text: randomResponse,
                        sender: 'contact',
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    };
                    
                    sampleMessages[currentContact.id].push(newContactMessage);
                    renderMessages();
                    
                    // Increase suspicion level slightly
                    suspicionLevel = Math.min(100, suspicionLevel + 5);
                    document.getElementById('suspicion-level').textContent = `${suspicionLevel}%`;
                }, 1000 + Math.random() * 1000);
            }

            // Change language
            function changeLanguage(lang) {
                currentLanguage = lang;
                currentLanguageSpan.textContent = lang.toUpperCase();
                updateUI();
            }

            // Update UI based on current state
            function updateUI() {
                // Update translations
                document.getElementById('app-title').textContent = translations[currentLanguage].appTitle;
                document.getElementById('suspicion-label').textContent = translations[currentLanguage].suspicionLabel;
                document.getElementById('contacts-label').textContent = translations[currentLanguage].contactsLabel;
                document.getElementById('no-contact-selected').textContent = translations[currentLanguage].selectContact;
                document.getElementById('no-messages').textContent = translations[currentLanguage].noMessages;
                messageInput.placeholder = translations[currentLanguage].inputPlaceholder;
                
                // Update contact header
                if (currentContact) {
                    noContactSelected.style.display = 'none';
                    contactHeader.style.display = 'flex';
                    contactInitial.textContent = currentContact.initial;
                    contactName.textContent = currentContact.name;
                    contactStatus.textContent = translations[currentLanguage][`status${currentContact.status.charAt(0).toUpperCase() + currentContact.status.slice(1)}`];
                } else {
                    noContactSelected.style.display = 'block';
                    contactHeader.style.display = 'none';
                }
                
                // Re-render contacts to update status translations
                renderContacts();
            }

            // Setup event listeners
            function setupEventListeners() {
                // Send message on button click or Enter key
                sendButton.addEventListener('click', sendMessage);
                messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') sendMessage();
                });
                
                // Language toggle
                languageToggle.addEventListener('click', () => {
                    languageDropdown.classList.toggle('hidden');
                });
                
                // Language selection
                document.querySelectorAll('[data-lang]').forEach(button => {
                    button.addEventListener('click', () => {
                        changeLanguage(button.dataset.lang);
                        languageDropdown.classList.add('hidden');
                    });
                });
                
                // Close dropdown when clicking outside
                document.addEventListener('click', (e) => {
                    if (!languageToggle.contains(e.target) && !languageDropdown.contains(e.target)) {
                        languageDropdown.classList.add('hidden');
                    }
                });
            }

            // Start the app
            initApp();
        });