const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const rooms = {};

function createDeck() {
  const colors = ['red', 'blue', 'green', 'yellow'];
  const deck = [];

  colors.forEach(color => {
    deck.push({ color, value: '0' });
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, value: i.toString() });
      deck.push({ color, value: i.toString() });
    }
    deck.push({ color, value: 'skip' }); deck.push({ color, value: 'skip' });
    deck.push({ color, value: 'reverse' }); deck.push({ color, value: 'reverse' });
    deck.push({ color, value: '+2' }); deck.push({ color, value: '+2' });
  });

  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', value: 'wild' });
    deck.push({ color: 'wild', value: '+4' });
  }

  // Madelon Wild Cards
  deck.push({ color: 'wild', value: 'madelon' });
  deck.push({ color: 'wild', value: 'madelon' });

  return shuffle(deck);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

io.on('connection', (socket) => {
  
  socket.on('createRoom', ({ playerName }) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[roomId] = {
      id: roomId,
      players: [{
        id: socket.id,
        name: playerName,
        hand: [],
        calledAbduno: false,
        abdunoTimer: null,
        usedMadelonPlus6: false,
        usedMadelonNullify: false
      }],
      deck: createDeck(),
      discardPile: [],
      topCard: null,
      activePlayerIndex: 0,
      direction: 1,
      drawStack: 0
    };

    socket.join(roomId);
    const room = rooms[roomId];
    for (let i = 0; i < 7; i++) room.players[0].hand.push(room.deck.pop());
    room.topCard = room.deck.pop();
    room.discardPile.push(room.topCard);

    socket.emit('roomJoined', { roomId });
    socket.emit('handUpdate', room.players[0].hand);
    broadcastGameState(roomId);
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit('errorMessage', 'Room not found.');

    const player = {
      id: socket.id,
      name: playerName,
      hand: [],
      calledAbduno: false,
      abdunoTimer: null,
      usedMadelonPlus6: false,
      usedMadelonNullify: false
    };
    for (let i = 0; i < 7; i++) player.hand.push(room.deck.pop());

    room.players.push(player);
    socket.join(roomId);

    socket.emit('roomJoined', { roomId });
    socket.emit('handUpdate', player.hand);
    broadcastGameState(roomId);
  });

socket.on('playCards', ({ roomId, cardIndices, chosenColor, madelonMode }) => {
    const room = rooms[roomId];
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== room.activePlayerIndex) return socket.emit('errorMessage', "Not your turn!");

    const player = room.players[playerIndex];
    const playedCards = cardIndices.map(i => player.hand[i]);
    if (playedCards.length === 0) return;

    // Rule: Same symbol/number multi-card matching check
    const firstVal = playedCards[0].value;
    const allSameValue = playedCards.every(c => c.value === firstVal);
    if (!allSameValue) return socket.emit('errorMessage', 'All played cards must share the same symbol or number!');

    const top = room.topCard;
    const firstCard = playedCards[0];

    // Stack Interception Rules
    if (room.drawStack > 0) {
      const isPlusCard = firstCard.value === '+2' || firstCard.value === '+4' || firstCard.value === 'madelon';
      const isMadelonNullify = (firstCard.value === 'madelon' && madelonMode === 'nullify');
      const isColorMatchSkip = (firstCard.value === 'skip' && firstCard.color === top.color);
      const isColorMatchReverse = (firstCard.value === 'reverse' && firstCard.color === top.color);

      if (!isPlusCard && !isMadelonNullify && !isColorMatchSkip && !isColorMatchReverse) {
        return socket.emit('errorMessage', `You must stack (+2/+4), pass/reverse with matching color skip/reverse, or nullify with Madelon!`);
      }
    } else {
      // Standard match check
      const isValidPlay = (
        firstCard.color === 'wild' ||
        firstCard.value === 'madelon' ||
        firstCard.color === top.color ||
        firstCard.value === top.value
      );
      if (!isValidPlay) return socket.emit('errorMessage', 'Invalid move! Card color or value does not match.');
    }

 // Process Madelon Rules & Per-Round Usage Limits
    if (firstCard.value === 'madelon') {
      if (madelonMode === 'nullify') {
        if (player.usedMadelonNullify) return socket.emit('errorMessage', 'You have already used Madelon Nullify this round!');
        player.usedMadelonNullify = true;
        room.drawStack = 0;
      } else {
        if (player.usedMadelonPlus6) return socket.emit('errorMessage', 'You have already used Madelon +6 this round!');
        player.usedMadelonPlus6 = true;
      }
    }

    // Apply Stack Additions
    playedCards.forEach(card => {
      if (card.value === '+2') room.drawStack += 2;
      if (card.value === '+4') room.drawStack += 4;
      if (card.value === 'madelon' && madelonMode !== 'nullify') room.drawStack += 6;
      room.discardPile.push(card);
    });


    // Remove played cards from hand
    player.hand = player.hand.filter((_, idx) => !cardIndices.includes(idx));
    
    // Check for Win Condition
    if (player.hand.length === 0) {
    io.to(roomId).emit('gameOver', { winner: player.name });
    io.to(roomId).emit('chatUpdate', { name: 'SYSTEM', message: `🏆 ${player.name} has won the game!` });
    return; // Stop further execution for this turn
    }

    // Update Top Card
    let newTopCard = { ...playedCards[playedCards.length - 1] };
    if (chosenColor) newTopCard.color = chosenColor;
    room.topCard = newTopCard;

    // Handle Skip & Reverse Turn Adjustments
    const skipCount = playedCards.filter(c => c.value === 'skip').length;
    const reverseCount = playedCards.filter(c => c.value === 'reverse').length;

    if (reverseCount % 2 !== 0) {
      room.direction *= -1;
    }

    let step = 1;

    // 2-Player Logic Adjustments for Skip and Reverse
    if (room.players.length === 2) {
      if (skipCount > 0 || (reverseCount % 2 !== 0)) {
        step = 0; // Turn stays with the active player
      }
    } else {
      if (skipCount > 0) step += skipCount;
    }

    // Check ABDU-NO state & 5-Second Penalty Timer Initiation
    if (player.hand.length === 1 && !player.calledAbduno) {
      if (player.abdunoTimer) clearTimeout(player.abdunoTimer);
      player.abdunoTimer = setTimeout(() => {
        if (player.hand.length === 1 && !player.calledAbduno) {
          drawPenaltyCards(room, player, 2);
          io.to(roomId).emit('chatUpdate', { name: 'SYSTEM', message: `⚠️ ${player.name} failed to call ABDU-NO in 5s! +2 Penalty.` });
          socket.emit('handUpdate', player.hand);
          broadcastGameState(roomId);
        }
      }, 5000);
    }

    room.activePlayerIndex = (room.activePlayerIndex + (step * room.direction) + room.players.length * 100) % room.players.length;

    socket.emit('handUpdate', player.hand);
    broadcastGameState(roomId);
  });

  // Continuous Draw Mechanic
  socket.on('drawCard', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== room.activePlayerIndex) return;

    const player = room.players[playerIndex];

    // If taking a stack, draw the whole stack and DO NOT pass turn (player must still play)
    if (room.drawStack > 0) {
      drawPenaltyCards(room, player, room.drawStack);
      room.drawStack = 0;
      socket.emit('handUpdate', player.hand);
      broadcastGameState(roomId);
      return;
    }

    // Otherwise, continuous draw until finding an eligible playable card
    let foundPlayable = false;
    while (!foundPlayable) {
      if (room.deck.length === 0) {
        if (room.discardPile.length <= 1) break;
        room.deck = shuffle(room.discardPile.splice(0, room.discardPile.length - 1));
      }

      const card = room.deck.pop();
      if (!card) break;
      player.hand.push(card);

      const top = room.topCard;
      if (card.color === 'wild' || card.value === 'madelon' || card.color === top.color || card.value === top.value) {
        foundPlayable = true;
      }
    }

    socket.emit('handUpdate', player.hand);
    broadcastGameState(roomId);
  });

  // Calling ABDU-NO & Calling Out Other Players
  socket.on('callAbduno', ({ roomId, targetPlayerId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const caller = room.players.find(p => p.id === socket.id);

    // Call Out Another Player
    if (targetPlayerId) {
      const target = room.players.find(p => p.id === targetPlayerId);
      if (target && target.hand.length === 1 && !target.calledAbduno) {
        if (target.abdunoTimer) clearTimeout(target.abdunoTimer);
        drawPenaltyCards(room, target, 2);
        io.to(roomId).emit('chatUpdate', { name: 'SYSTEM', message: `🎯 ${caller.name} called out ${target.name}! ${target.name} receives a 2-card penalty.` });
        io.to(target.id).emit('handUpdate', target.hand);
        broadcastGameState(roomId);
      }
      return;
    }

    // Self-Call ABDU-NO
    if (caller && caller.hand.length === 1) {
      caller.calledAbduno = true;
      if (caller.abdunoTimer) clearTimeout(caller.abdunoTimer);
      io.to(roomId).emit('chatUpdate', { name: 'SYSTEM', message: `🔥 ${caller.name} called ABDU-NO!` });
    } else if (caller) {
      drawPenaltyCards(room, caller, 2);
      socket.emit('handUpdate', caller.hand);
      socket.emit('errorMessage', 'False ABDU-NO call! Drawn 2 penalty cards.');
    }
  });

  
  // Room Chat Event Handler
  socket.on('chatMessage', ({ roomId, message }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      io.to(roomId).emit('chatUpdate', { name: player.name, message });
    }
  });
});

function drawPenaltyCards(room, player, count) {
  for (let i = 0; i < count; i++) {
    if (room.deck.length === 0) {
      if (room.discardPile.length <= 1) break;
      room.deck = shuffle(room.discardPile.splice(0, room.discardPile.length - 1));
    }
    if (room.deck.length > 0) player.hand.push(room.deck.pop());
  }
}

function broadcastGameState(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const state = {
    topCard: room.topCard,
    direction: room.direction,
    drawStack: room.drawStack,
    activePlayerId: room.players[room.activePlayerIndex]?.id,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      calledAbduno: p.calledAbduno
    }))
  };

  io.to(roomId).emit('gameStateUpdate', state);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`ABDU-NO active on port ${PORT}`));