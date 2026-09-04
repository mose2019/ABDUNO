// Auto-reconnect if session data exists in localStorage
window.addEventListener('load', () => {
  const savedRoom = localStorage.getItem('abdu_roomId');
  const savedName = localStorage.getItem('abdu_playerName');
  
  if (savedRoom && savedName) {
    socket.emit('reconnectPlayer', { roomId: savedRoom, playerName: savedName });
  }
});
const socket = io();

let currentRoomId = null;
let selectedIndices = [];
let myHand = [];
let roomPlayers = [];

// DOM Elements
const createBtn = document.getElementById("create-room-btn");
const joinBtn = document.getElementById("join-room-btn");
const nameInput = document.getElementById("player-name");
const roomInput = document.getElementById("room-code-input");
const lobbyScreen = document.getElementById("lobby-screen");
const gameScreen = document.getElementById("game-screen");
const displayRoomCode = document.getElementById("display-room-code");
const myHandEl = document.getElementById("my-hand");
const discardPileEl = document.getElementById("discard-pile");
const drawPileEl = document.getElementById("draw-pile");
const playerListEl = document.getElementById("player-list");
const directionRing = document.getElementById("direction-ring");
const choiceModal = document.getElementById("choice-modal");
const madelonModal = document.getElementById("madelon-modal");

// Chat Elements
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");
const sendChatBtn = document.getElementById("send-chat-btn");

// Spotify Elements
const loadSpotifyBtn = document.getElementById("load-spotify-btn");
const spotifyInput = document.getElementById("spotify-link-input");
const spotifyFrame = document.getElementById("spotify-frame");

// Game Action Buttons
const playBtn = document.getElementById("play-btn");
const abdunoBtn = document.getElementById("abduno-btn");

let chosenMadelonMode = null;

// Draw Pile Setup
if (drawPileEl) {
  drawPileEl.style.backgroundImage = 'url("assets/card-back.png")';
  drawPileEl.style.backgroundSize = 'cover';
  drawPileEl.style.backgroundPosition = 'center';
}

if (createBtn) {
  createBtn.addEventListener("click", () => {
    const playerName = nameInput?.value.trim() || "Player";
    socket.emit("createRoom", { playerName });
  });
}

if (joinBtn) {
  joinBtn.addEventListener("click", () => {
    const playerName = nameInput?.value.trim() || "Player";
    const roomId = roomInput?.value.trim();
    if (!roomId) return alert("Please enter a room code.");
    socket.emit("joinRoom", { roomId, playerName });
  });
}

// Chat Handlers
function handleSendChat() {
  if (!chatInput) return;
  const msg = chatInput.value.trim();
  if (msg && currentRoomId) {
    socket.emit("chatMessage", { roomId: currentRoomId, message: msg });
    chatInput.value = "";
  }
}

if (sendChatBtn) {
  sendChatBtn.addEventListener("click", handleSendChat);
}

if (chatInput) {
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleSendChat();
    }
  });
}

// Spotify Controls Handler
if (loadSpotifyBtn && spotifyInput && spotifyFrame) {
  loadSpotifyBtn.addEventListener("click", () => {
    let val = spotifyInput.value.trim();
    if (!val) return;
    
    // Convert regular track/playlist links to embed format automatically
    if (val.includes("spotify.com") && !val.includes("/embed/")) {
      val = val.replace("spotify.com/", "spotify.com/embed/");
    }
    
    spotifyFrame.src = val;
    spotifyInput.value = "";
  });
}

socket.on("roomJoined", (data) => {
  currentRoomId = data.roomId;
  if (displayRoomCode) displayRoomCode.innerText = currentRoomId;
  if (lobbyScreen) lobbyScreen.style.display = "none";
  if (gameScreen) gameScreen.style.display = "block";
});

socket.on("errorMessage", (msg) => alert(msg));

socket.on("chatUpdate", ({ name, message }) => {
  if (!chatBox) return;
  const msgEl = document.createElement("div");
  msgEl.innerHTML = `<strong style="color:var(--accent-blue, #3b82f6);">${name}:</strong> ${message}`;
  chatBox.appendChild(msgEl);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// Asset Path Normalizer for all Wild, Action, and Color variations
function getCardImagePath(card) {
  if (!card) return 'assets/card-back.png';

  let color = (card.color || 'wild').toLowerCase().trim();
  let val = card.value !== undefined && card.value !== null ? card.value.toString().toLowerCase().trim() : '';

  if (val === 'madelon' || color === 'madelon') return 'assets/madelon.png';
  if (color === 'wild') {
    if (val === '+4' || val === 'draw4' || val === 'draw 4' || val === 'plus4') return 'assets/wild-draw4.png';
    return 'assets/wild-wild.png';
  }

  if (val === '+2' || val === 'draw2' || val === 'draw 2' || val === 'plus2') val = 'draw2';
  if (val === 'skip') val = 'skip';
  if (val === 'reverse') val = 'reverse';

  return `assets/${color}-${val}.png`;
}

function createCardElement(card, index) {
  const cardEl = document.createElement("div");
  const isMadelon = card.value === 'madelon' || card.color === 'madelon';
  const colorClass = (card.color || 'wild').toLowerCase();
  
  cardEl.className = `card card-${colorClass} ${isMadelon ? 'madelon-card' : ''}`;
  
  // Style defaults so cards are ALWAYS visible even if assets are missing
  cardEl.style.display = "flex";
  cardEl.style.flexDirection = "column";
  cardEl.style.alignItems = "center";
  cardEl.style.justifyContent = "center";
  cardEl.style.fontWeight = "bold";
  cardEl.style.color = "#ffffff";
  cardEl.style.borderRadius = "8px";
  cardEl.style.boxShadow = "0 4px 6px rgba(0,0,0,0.3)";
  
  // Quick text fallback representation
  let displayVal = card.value || '';
  if (displayVal === 'wild') displayVal = 'WILD';
  if (displayVal === '+4') displayVal = '+4';
  if (displayVal === 'madelon') displayVal = 'MADELON';
  
  cardEl.innerHTML = `<span style="font-size:12px; opacity:0.8;">${colorClass.toUpperCase()}</span><span style="font-size:18px">${displayVal}</span>`;

  // Try loading the image asset on top if it exists
  const imgUrl = getCardImagePath(card);
  const img = new Image();
  img.src = imgUrl;

  img.onload = () => {
    cardEl.style.backgroundImage = `url("${imgUrl}")`;
    cardEl.style.backgroundSize = "cover";
    cardEl.style.backgroundPosition = "center";
    cardEl.innerText = ""; // Clear text if image loads successfully
  };

  if (index !== undefined) {
    cardEl.addEventListener("click", () => {
      if (selectedIndices.includes(index)) {
        selectedIndices = selectedIndices.filter(i => i !== index);
        cardEl.classList.remove("selected");
      } else {
        selectedIndices.push(index);
        cardEl.classList.add("selected");
      }
    });
  }

  return cardEl;
}

socket.on("handUpdate", (hand) => {
  myHand = hand;
  if (!myHandEl) return;

  myHandEl.innerHTML = "";
  selectedIndices = [];

  hand.forEach((card, index) => {
    const cardEl = createCardElement(card, index);
    myHandEl.appendChild(cardEl);
  });
});

// Unified Game State Update Listener
socket.on("gameStateUpdate", (state) => {
  // 1. Update Discard Pile & Madelon Animation Trigger
  if (state.topCard && discardPileEl) {
    const isMadelon = state.topCard.value === 'madelon' || state.topCard.color === 'madelon';
    
    discardPileEl.className = `card card-${(state.topCard.color || 'wild').toLowerCase()}`;
    if (isMadelon) {
      void discardPileEl.offsetWidth; // Force DOM reflow to restart CSS keyframe animation
      discardPileEl.classList.add('madelon-card');
    }

    const imgUrl = getCardImagePath(state.topCard);
    const img = new Image();
    img.src = imgUrl;

    img.onload = () => {
      discardPileEl.style.backgroundImage = `url("${imgUrl}")`;
      discardPileEl.style.backgroundSize = "cover";
      discardPileEl.innerText = "";
    };

    img.onerror = () => {
      discardPileEl.style.backgroundImage = "none";
      discardPileEl.innerText = `${(state.topCard.color || 'WILD').toUpperCase()}\n${state.topCard.value || ''}`;
      discardPileEl.style.display = "flex";
      discardPileEl.style.alignItems = "center";
      discardPileEl.style.justifyContent = "center";
    };

    let stackBadge = document.getElementById("stack-badge");
    if (state.drawStack > 0) {
      if (!stackBadge) {
        stackBadge = document.createElement("div");
        stackBadge.id = "stack-badge";
        stackBadge.className = "stack-badge";
        discardPileEl.appendChild(stackBadge);
      }
      stackBadge.innerText = `+${state.drawStack}`;
    } else if (stackBadge) {
      stackBadge.remove();
    }
  }

  // 2. Update Stack Counter Banner
  const stackBanner = document.getElementById('stack-counter-banner');
  const stackNum = document.getElementById('stack-count-num');
  if (state.drawStack > 0) {
    stackNum.innerText = state.drawStack;
    stackBanner.style.display = 'block';
  } else {
    stackBanner.style.display = 'none';
  }

  // 3. Update Direction Ring
  if (directionRing) {
    if (state.direction === -1) directionRing.classList.add("reverse");
    else directionRing.classList.remove("reverse");
  }

  // 4. Update Player List & Call-Out Buttons
  if (playerListEl) {
    playerListEl.innerHTML = "";
    roomPlayers = state.players;
    state.players.forEach(p => {
      const pEl = document.createElement("div");
      pEl.className = `player-card ${p.id === state.activePlayerId ? 'active' : ''}`;
      pEl.innerHTML = `<div><strong>${p.name}</strong> (${p.cardCount} cards)</div>`;

      if (p.id !== socket.id && p.cardCount === 1 && !p.calledAbduno) {
        const callOutBtn = document.createElement("button");
        callOutBtn.style.cssText = "padding:2px 6px; font-size:10px; background:#ef4444; color:white; border-radius:4px; margin-left:6px;";
        callOutBtn.innerText = "CALL OUT!";
        callOutBtn.onclick = () => socket.emit("callAbduno", { roomId: currentRoomId, targetPlayerId: p.id });
        pEl.appendChild(callOutBtn);
      }

      playerListEl.appendChild(pEl);
    });
  }
});

// Handle Victory & Fireworks
socket.on('gameOver', ({ winner }) => {
  const modal = document.getElementById('victory-modal');
  const winnerText = document.getElementById('winner-text');
  winnerText.innerText = `${winner} WINS!`;
  modal.style.display = 'flex';
  
  launchFireworks();
});

function launchFireworks() {
  const container = document.querySelector('.fireworks-container');
  if (!container) return;
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

// Play Flow with Madelon Mode & Wild Color Selection
if (playBtn) {
  playBtn.addEventListener("click", () => {
    if (selectedIndices.length === 0 || !currentRoomId) return;

    const firstCard = myHand[selectedIndices[0]];
    if (firstCard && firstCard.value === 'madelon' && madelonModal) {
      madelonModal.style.display = "flex";
    } else if (firstCard && firstCard.color === 'wild' && choiceModal) {
      choiceModal.style.display = "flex";
    } else {
      socket.emit("playCards", { roomId: currentRoomId, cardIndices: selectedIndices });
    }
  });
}

window.selectMadelonMode = function(mode) {
  chosenMadelonMode = mode;
  if (madelonModal) madelonModal.style.display = "none";
  if (choiceModal) choiceModal.style.display = "flex";
};

window.chooseColor = function(color) {
  if (choiceModal) choiceModal.style.display = "none";
  socket.emit("playCards", {
    roomId: currentRoomId,
    cardIndices: selectedIndices,
    chosenColor: color,
    madelonMode: chosenMadelonMode
  });
  chosenMadelonMode = null;
};

if (drawPileEl) {
  drawPileEl.addEventListener("click", () => {
    if (currentRoomId) socket.emit("drawCard", { roomId: currentRoomId });
  });
}

if (abdunoBtn) {
  abdunoBtn.addEventListener("click", () => {
    if (currentRoomId) socket.emit("callAbduno", { roomId: currentRoomId });
  });
}