import { Card } from './gameLogic.js';

// UI Rendering System

/**
 * Renders a single card element.
 * @param {Card} card - The card to render.
 * @returns {HTMLElement} The card element.
 */
export function renderCard(card) {
    const cardDiv = document.createElement('div');
    cardDiv.classList.add('card');
    cardDiv.dataset.rank = card.rank;
    cardDiv.dataset.suit = card.suit;

    if (card.isFaceUp) {
        const suitSymbols = {
            hearts: '♥',
            diamonds: '♦',
            clubs: '♣',
            spades: '♠'
        };
        const rankSpan = document.createElement('span');
        rankSpan.textContent = card.rank;
        const suitSpan = document.createElement('span');
        suitSpan.textContent = suitSymbols[card.suit];
        cardDiv.appendChild(rankSpan);
        cardDiv.appendChild(suitSpan);
        cardDiv.classList.add(card.suit);
        cardDiv.draggable = true;
        cardDiv.tabIndex = 0; // Make face-up cards focusable
        cardDiv.setAttribute('role', 'button');
        cardDiv.setAttribute('aria-label', `${card.rank} of ${card.suit}`);
        cardDiv.style.animation = 'card-flip 0.4s ease-in-out';
    } else {
        cardDiv.classList.add('card-back');
        cardDiv.draggable = false;
        cardDiv.setAttribute('aria-label', 'Face down card');
    }
    return cardDiv;
}

/**
 * Renders the stock pile.
 * @param {Card[]} stockPile - The stock pile array.
 * @param {Card[]} wastePile - The waste pile array.
 */
export function renderStockPile(stockPile, wastePile) {
    const stockPileDiv = document.getElementById('stock-pile');
    stockPileDiv.innerHTML = '';
    if (stockPile.length > 0) {
        const card = new Card('', ''); // Fake card for rendering back
        const cardDiv = renderCard(card);
        stockPileDiv.appendChild(cardDiv);
    } else {
        // Show reset symbol if stock is empty but waste is not
        if (wastePile.length > 0) {
            const resetDiv = document.createElement('div');
            resetDiv.textContent = '♻️';
            resetDiv.style.fontSize = '3rem';
            resetDiv.style.cursor = 'pointer';
            resetDiv.title = 'Reset Waste Pile';
            stockPileDiv.appendChild(resetDiv);
        }
    }
}

/**
 * Renders the waste pile.
 * @param {Card[]} wastePile - The waste pile array.
 * @param {Function} addDropListeners - Function to add drop event listeners.
 * @param {Function} addDragListeners - Function to add drag event listeners.
 */
export function renderWastePile(wastePile, addDropListeners, addDragListeners) {
    const wastePileDiv = document.getElementById('waste-pile');
    wastePileDiv.innerHTML = '';
    addDropListeners(wastePileDiv);
    if (wastePile.length > 0) {
        const topCard = wastePile[wastePile.length - 1];
        const cardDiv = renderCard(topCard);
        addDragListeners(cardDiv);
        wastePileDiv.appendChild(cardDiv);
    }
}

/**
 * Renders the foundation piles.
 * @param {Card[][]} foundationPiles - The foundation piles array.
 * @param {Function} addDropListeners - Function to add drop event listeners.
 */
export function renderFoundationPiles(foundationPiles, addDropListeners) {
    for (let i = 0; i < 4; i++) {
        const foundationPileDiv = document.getElementById(`foundation-pile-${i}`);
        foundationPileDiv.innerHTML = '';
        addDropListeners(foundationPileDiv);
        const pile = foundationPiles[i];
        if (pile.length > 0) {
            const topCard = pile[pile.length - 1];
            foundationPileDiv.appendChild(renderCard(topCard));
        }
    }
}

/**
 * Renders the tableau piles.
 * @param {Card[][]} tableauPiles - The tableau piles array.
 * @param {Function} addDropListeners - Function to add drop event listeners.
 * @param {Function} addDragListeners - Function to add drag event listeners.
 */
export function renderTableauPiles(tableauPiles, addDropListeners, addDragListeners) {
    for (let i = 0; i < 7; i++) {
        const tableauPileDiv = document.getElementById(`tableau-pile-${i}`);
        tableauPileDiv.innerHTML = '';
        addDropListeners(tableauPileDiv);
        const pile = tableauPiles[i];
        pile.forEach((card, index) => {
            const cardDiv = renderCard(card);
            cardDiv.style.top = `${index * 25}px`; // Stagger cards
            if (card.isFaceUp) {
                addDragListeners(cardDiv);
            }
            tableauPileDiv.appendChild(cardDiv);
        });
    }
}

/**
 * Updates the entire game display.
 * @param {object} gameState - The current game state.
 * @param {object} listeners - Event listener functions.
 */
export function updateDisplay(gameState, listeners) {
    renderStockPile(gameState.stockPile, gameState.wastePile);
    renderWastePile(gameState.wastePile, listeners.addDropListeners, listeners.addDragListeners);
    renderFoundationPiles(gameState.foundationPiles, listeners.addDropListeners);
    renderTableauPiles(gameState.tableauPiles, listeners.addDropListeners, listeners.addDragListeners);
}


// Accessibility & User Feedback

/**
 * Announce a message to screen readers.
 * @param {string} message - The message to announce.
 */
export function updateStatus(message) {
    const statusDiv = document.getElementById('game-status');
    if (statusDiv) {
        // Clear previous message to ensure it's re-announced if the same message is sent again
        statusDiv.textContent = '';
        setTimeout(() => {
            statusDiv.textContent = message;
        }, 100);
    }
}

// Audio Management

/**
 * Plays a sound for a game action.
 * @param {string} type - The type of sound ('move', 'flip', 'invalid', 'win').
 */
export function playSound(type) {
    const isMuted = document.getElementById('mute-button').textContent === '🔇';
    if (isMuted) return;

    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);

        switch (type) {
            case 'flip':
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
                gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.2);
                break;
            case 'move':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
                gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
                break;
            case 'invalid':
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(110, audioContext.currentTime); // A2
                gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.4);
                break;
            case 'win':
                playWinSound(); // Use the more complex win sound
                return;
        }

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.error("Web Audio API is not supported.", e);
    }
}

/**
 * Plays a specialized sound for winning the game.
 */
export function playWinSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.01);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioContext.currentTime + 0.5); // C6

        oscillator.start(audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.error("Web Audio API is not supported in this browser.", e);
    }
}

// Animation & Visual Effects

/**
 * Handles the win celebration, including animations and sounds.
 * @param {Card[][]} foundationPiles - The foundation piles array.
 */
export function handleWin(foundationPiles) {
    updateStatus("Congratulations, you win!");
    playSound('win');

    document.body.style.animation = 'screen-flash 0.5s ease-in-out';

    launchFireworks();
    createConfetti();

    const foundationPilesElements = document.querySelectorAll('.foundation .card-pile');
    let allCards = [];
    foundationPilesElements.forEach((pileElem, pileIndex) => {
        const pile = foundationPiles[pileIndex];
        pile.forEach((card, cardIndex) => {
            const cardDiv = renderCard(card);
            const rect = pileElem.getBoundingClientRect();
            cardDiv.style.left = `${rect.left}px`;
            cardDiv.style.top = `${rect.top}px`;
            cardDiv.classList.add('win-animation-card');
            document.body.appendChild(cardDiv);
            allCards.push(cardDiv);
        });
    });

    allCards.forEach((cardDiv, i) => {
        setTimeout(() => {
            cardDiv.style.animation = `card-cascade ${2 + Math.random() * 2}s forwards`;
            cardDiv.style.left = `${Math.random() * 100}vw`;
        }, i * 50);
    });

    setTimeout(() => {
        document.getElementById('win-modal').style.display = 'flex';
        document.body.style.animation = '';
        allCards.forEach(c => c.remove());
    }, 4000);
}

/**
 * Launches a canvas-based fireworks animation.
 */
export function launchFireworks() {
    const canvas = document.getElementById('fireworks-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let particles = [];

    function createParticle(x, y) {
        const count = 100;
        const hue = Math.random() * 360;
        for (let i = 0; i < count; i++) {
            particles.push({
                x: x,
                y: y,
                angle: Math.random() * Math.PI * 2,
                speed: Math.random() * 5 + 2,
                friction: 0.95,
                gravity: 1,
                hue: hue,
                brightness: Math.random() * 50 + 50,
                alpha: 1,
                decay: Math.random() * 0.015 + 0.015
            });
        }
    }

    function updateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.speed *= p.friction;
            p.x += Math.cos(p.angle) * p.speed;
            p.y += Math.sin(p.angle) * p.speed + p.gravity;
            p.alpha -= p.decay;

            if (p.alpha <= p.decay) {
                particles.splice(i, 1);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2, 0, Math.PI * 2, false);
                ctx.fillStyle = `hsla(${p.hue}, 100%, ${p.brightness}%, ${p.alpha})`;
                ctx.fill();
            }
        }
    }

    let fireworkInterval = setInterval(() => createParticle(Math.random() * canvas.width, Math.random() * canvas.height / 2), 800);
    let animationFrame;

    function animate() {
        animationFrame = requestAnimationFrame(animate);
        updateParticles();
    }

    animate();

    setTimeout(() => {
        clearInterval(fireworkInterval);
        setTimeout(() => {
            cancelAnimationFrame(animationFrame);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 2000);
    }, 3000);
}

/**
 * Creates a DOM-based confetti animation.
 */
export function createConfetti() {
    const confettiCount = 200;
    const colors = ['#f00', '#0f0', '#00f', '#ff0', '#0ff', '#f0f'];
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.left = `${Math.random() * 100}vw`;
        confetti.style.top = `${-Math.random() * 100}vh`;
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = `${Math.random() * 2}s`;
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 3000);
    }
}