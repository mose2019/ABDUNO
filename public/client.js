const socket = io();

let currentRoomId = null;
let myHand = [];
let selectedIndices = [];
let pendingChoiceCardIndices = [];
let chosenWildColor = null;
let pendingMadelonMode = null;

// DOM Elements
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const roomCodeInput = document.getElementById('room-code-input');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const displayRoomCode = document.getElementById('display-room-code');
const playerList = document.getElementById('player-list');
const myHandDiv = document.getElementById('my-hand');
const drawPile = document.getElementById('draw-pile');
const discardPile = document.getElementById('discard-pile');
const playBtn = document.getElementById('play-btn');
const abdunoBtn = document.getElementById('abduno-btn');
const choiceModal = document.getElementById('choice-modal');

// Chat DOM Elements
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

// Spotify DOM Elements
const spotifyLinkInput = document.getElementById('spotify-link-input');
const loadSpotifyBtn = document.getElementById('load-spotify-btn');
const spotifyFrame = document.getElementById('spotify-frame');

// Room Actions
createRoomBtn.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim();
  if (!playerName) return alert('Please enter your name.');
  socket.emit('createRoom', { playerName });
});

joinRoomBtn.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim();
  const roomId = roomCodeInput.value.trim().toUpperCase();
  if (!playerName || !roomId) return alert('Please enter both your name and room code.');
  socket.emit('joinRoom', { roomId, playerName });
});

socket.on('roomJoined', ({ roomId }) => {
  currentRoomId = roomId;
  lobbyScreen.style.display = 'none';
  gameScreen.style.display = 'block';
  displayRoomCode.innerText = roomId;
});

socket.on('errorMessage', (msg) => {
  alert(msg);
});

// Hand Update
socket.on('handUpdate', (hand) => {
  myHand = hand;
  selectedIndices = [];
  renderHand();
});

function renderHand() {
  myHandDiv.innerHTML = '';
  myHand.forEach((card, idx) => {
    const cardEl = document.createElement('div');
    cardEl.classList.add('card');
    
    // Style card based on color/value
    if (card.color === 'wild') {
      cardEl.style.backgroundColor = '#1e293b';
      cardEl.style.backgroundImage = `radial-gradient(circle, #ef4444, #3b82f6, #10b981, #f59e0b)`;
    } else {
      cardEl.style.backgroundColor = getCardColorHex(card.color);
    }
    
    // Display text/value on card
    cardEl.innerHTML = `<span style="position: absolute; top: 6px; left: 8px; font-weight: bold; font-size: 14px; color: white;">${getCardSymbol(card.value)}</span>`;

    if (selectedIndices.includes(idx)) {
      cardEl.classList.add('selected');
    }

    cardEl.addEventListener('click', () => {
      const pos = selectedIndices.indexOf(idx);
      if (pos > -1) {
        selectedIndices.splice(pos, 1);
      } else {
        selectedIndices.push(idx);
      }
      renderHand();
    });

    myHandDiv.appendChild(cardEl);
  });
}

function getCardColorHex(color) {
  switch(color) {
    case 'red': return '#ef4444';
    case 'blue': return '#3b82f6';
    case 'green': return '#10b981';
    case 'yellow': return '#f59e0b';
    default: return '#334155';
  }
}

function getCardSymbol(val) {
  if (val === 'skip') return '⃠';
  if (val === 'reverse') return '⇄';
  if (val === '+2') return '+2';
  if (val === '+4') return '+4';
  if (val === 'wild') return '★';
  if (val === 'madelon') return '👑';
  return val;
}

// Play Cards Button Action
playBtn.addEventListener('click', () => {
  if (selectedIndices.length === 0) return alert('Select cards to play!');
  
  const playedCards = selectedIndices.map(i => myHand[i]);
  const firstCard = playedCards[0];

  // Check if Wild or Madelon needs color/mode choice
  if (firstCard.color === 'wild' || firstCard.value === 'madelon') {
    pendingChoiceCardIndices = [...selectedIndices];
    if (firstCard.value === 'madelon') {
      const modeChoice = prompt("Madelon Card Activated! Type '+6' to stack +6 cards, 'nullify' to clear stack, or leave blank for normal wild play:");
      pendingMadelonMode = modeChoice ? modeChoice.trim().toLowerCase() : null;
    } else {
      pendingMadelonMode = null;
    }
    choiceModal.style.display = 'flex';
    return;
  }

  executePlay(selectedIndices, null, null);
});

function chooseColor(color) {
  chosenWildColor = color;
  choiceModal.style.display = 'none';
  executePlay(pendingChoiceCardIndices, chosenWildColor, pendingMadelonMode);
}

function executePlay(indices, color, madelonMode) {
  socket.emit('playCards', {
    roomId: currentRoomId,
    cardIndices: indices,
    chosenColor: color,
    madelonMode: madelonMode
  });
  selectedIndices = [];
  pendingChoiceCardIndices = [];
  chosenWildColor = null;
  pendingMadelonMode = null;
}

// Draw Pile Action
drawPile.addEventListener('click', () => {
  socket.emit('drawCard', { roomId: currentRoomId });
});

// Call ABDU-NO Button
abdunoBtn.addEventListener('click', () => {
  socket.emit('callAbduno', { roomId: currentRoomId });
});

// Game State Update & Stack Counter
socket.on('gameStateUpdate', (state) => {
  displayRoomCode.innerText = currentRoomId;
  
  // Render Stack Banner Counter
  const stackBanner = document.getElementById('stack-counter-banner');
  const stackNum = document.getElementById('stack-count-num');
  if (state.drawStack > 0) {
    stackNum.innerText = state.drawStack;
    stackBanner.style.display = 'block';
  } else {
    stackBanner.style.display = 'none';
  }

  // Render Discard Pile Top Card
  if (state.topCard) {
    discardPile.style.backgroundColor = state.topCard.color === 'wild' ? '#1e293b' : getCardColorHex(state.topCard.color);
    discardPile.innerHTML = `<span style="position: absolute; top: 6px; left: 8px; font-weight: bold; font-size: 16px; color: white;">${getCardSymbol(state.topCard.value)}</span>`;
  }

  // Render Player List Sidebar
  playerList.innerHTML = '';
  state.players.forEach(p => {
    const pEl = document.createElement('div');
    pEl.classList.add('player-card');
    if (p.id === state.activePlayerId) pEl.classList.add('active');

    pEl.innerHTML = `
      <span>${p.name} ${p.calledAbduno ? '🔥(ABDU-NO)' : ''}</span>
      <span style="font-weight: bold; color: var(--accent-blue);">${p.cardCount} cards</span>
    `;

    // Click to call out opponent if they have 1 card and didn't call ABDU-NO
    if (p.cardCount === 1 && !p.calledAbduno && p.id !== socket.id) {
      const callOutBtn = document.createElement('button');
      callOutBtn.innerText = 'Call Out!';
      callOutBtn.style.padding = '2px 6px';
      callOutBtn.style.fontSize = '10px';
      callOutBtn.style.background = '#ef4444';
      callOutBtn.style.color = 'white';
      callOutBtn.onclick = () => {
        socket.emit('callAbduno', { roomId: currentRoomId, targetPlayerId: p.id });
      };
      pEl.appendChild(callOutBtn);
    }

    playerList.appendChild(pEl);
  });
});

// Victory & Fireworks Trigger Handler
socket.on('gameOver', ({ winner }) => {
  const modal = document.getElementById('victory-modal');
  const winnerText = document.getElementById('winner-text');
  winnerText.innerText = `${winner} WINS!`;
  modal.style.display = 'flex';
  
  launchFireworks();
});

function launchFireworks() {
  const container = document.querySelector('.fireworks-container');
  const colors = ['#ff4757', '#2ed573', '#ffa502', '#1e90ff', '#9b59b6', '#ffd700'];
  
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const x = window.innerWidth * (0.2 + Math.random() * 0.6);
      const y = window.innerHeight * (0.2 + Math.random() * 0.4);
      
      for (let j = 0; j < 30; j++) {
        const spark = document.createElement('div');
        spark.classList.add('firework-spark');
        spark.style.left = `${x}px`;
        spark.style.top = `${y}px`;
        spark.style.background = colors[Math.floor(Math.random() * colors.length)];
        
        const angle = Math.random() * Math.PI * 2;
        const distance = 50 + Math.random() * 150;
        spark.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
        spark.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
        
        container.appendChild(spark);
        setTimeout(() => spark.remove(), 1000);
      }
    }, i * 400);
  }
}

// Chat Functionality
sendChatBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendChatMessage();
});

function sendChatMessage() {
  const message = chatInput.value.trim();
  if (!message || !currentRoomId) return;
  socket.emit('chatMessage', { roomId: currentRoomId, message });
  chatInput.value = '';
}

socket.on('chatUpdate', ({ name, message }) => {
  const msgEl = document.createElement('div');
  msgEl.innerHTML = `<strong>${name}:</strong> ${message}`;
  chatBox.appendChild(msgEl);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// Spotify Player Integration
loadSpotifyBtn.addEventListener('click', () => {
  let link = spotifyLinkInput.value.trim();
  if (!link) return;

  if (link.includes('open.spotify.com')) {
    link = link.replace('open.spotify.com', 'open.spotify.com/embed');
  } else {
    link = `https://open.spotify.com/embed/search/${encodeURIComponent(link)}`;
  }

  spotifyFrame.src = link;
});