import { Card } from './gameLogic.js';

// UI Rendering System - Performance Optimized

// DOM Element Cache for performance optimization
const DOMCache = {
    elements: new Map(),
    get(id) {
        if (!this.elements.has(id)) {
            this.elements.set(id, document.getElementById(id));
        }
        return this.elements.get(id);
    },
    clear() {
        this.elements.clear();
    }
};

// Mobile detection and performance settings
const MobileOptimizer = {
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    isLowEnd: navigator.hardwareConcurrency <= 2 || navigator.deviceMemory <= 2,
    maxFrameRate: 60,

    init() {
        // Reduce frame rate for low-end devices
        if (this.isLowEnd) {
            this.maxFrameRate = 30;
        }

        // Enable performance monitoring if available
        if ('performance' in window) {
            this.startPerformanceMonitoring();
        }
    },

    startPerformanceMonitoring() {
        // Monitor frame rate and adjust animations accordingly
        let frameCount = 0;
        let lastTime = performance.now();

        const monitor = () => {
            const currentTime = performance.now();
            frameCount++;

            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                if (fps < 20 && this.maxFrameRate > 20) {
                    this.maxFrameRate = Math.max(20, this.maxFrameRate - 10);
                }
                frameCount = 0;
                lastTime = currentTime;
            }

            requestAnimationFrame(monitor);
        };

        requestAnimationFrame(monitor);
    }
};

// Initialize mobile optimizer
MobileOptimizer.init();

// Optimized card creation with object pooling
const CardPool = {
    pool: [],

    getCard() {
        return this.pool.pop() || document.createElement('div');
    },

    returnCard(card) {
        // Reset card state
        card.className = 'card';
        card.draggable = false;
        card.tabIndex = -1;
        card.removeAttribute('role');
        card.removeAttribute('aria-label');
        card.removeAttribute('data-rank');
        card.removeAttribute('data-suit');
        card.style.top = '';
        card.style.transform = '';
        card.textContent = '';

        // Return to pool if not too large
        if (this.pool.length < 52) {
            this.pool.push(card);
        }
    }
};

// Cached suit symbols for performance
const suitSymbols = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
};

function getSuitSymbol(suit) {
    return suitSymbols[suit];
}

/**
 * Renders a single card element with performance optimizations.
 * @param {Card} card - The card to render.
 * @returns {HTMLElement} The card element.
 */
export function renderCard(card) {
    const cardDiv = CardPool.getCard();
    cardDiv.classList.add('card');
    cardDiv.dataset.rank = card.rank;
    cardDiv.dataset.suit = card.suit;

    if (card.isFaceUp) {
        cardDiv.classList.add('face-up');

        // Use cached suit symbols
        const suitSymbol = getSuitSymbol(card.suit);

        // Create elements more efficiently
        const fragment = document.createDocumentFragment();

        const rankTopLeft = document.createElement('span');
        rankTopLeft.className = 'card-rank';
        rankTopLeft.textContent = card.rank;

        const suitCenter = document.createElement('span');
        suitCenter.className = 'card-suit';
        suitCenter.textContent = suitSymbol;

        const rankBottomRight = document.createElement('span');
        rankBottomRight.className = 'card-rank-bottom';
        rankBottomRight.textContent = card.rank;

        fragment.appendChild(rankTopLeft);
        fragment.appendChild(suitCenter);
        fragment.appendChild(rankBottomRight);
        cardDiv.appendChild(fragment);

        // Set color class efficiently
        cardDiv.classList.add(card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black');

        cardDiv.draggable = true;
        cardDiv.tabIndex = 0;
        cardDiv.setAttribute('role', 'button');
        cardDiv.setAttribute('aria-label', `${card.rank} of ${card.suit}`);
    } else {
        cardDiv.classList.add('face-down');
        cardDiv.setAttribute('aria-label', 'Face down card');
    }
    return cardDiv;
}

/**
 * Efficiently clears an element's children and returns them to object pool.
 * @param {HTMLElement} element - The element to clear.
 */
function clearElement(element) {
    while (element.firstChild) {
        const child = element.firstChild;
        if (child.classList && child.classList.contains('card')) {
            CardPool.returnCard(child);
        }
        element.removeChild(child);
    }
}

/**
 * Renders the stock pile with performance optimizations.
 * @param {Card[]} stockPile - The stock pile array.
 * @param {Card[]} wastePile - The waste pile array.
 */
export function renderStockPile(stockPile, wastePile) {
    const stockPileDiv = DOMCache.get('stock-pile');

    // Efficiently clear existing content
    clearElement(stockPileDiv);

    if (stockPile.length > 0) {
        const card = new Card('', ''); // Fake card for rendering back
        const cardDiv = renderCard(card);
        stockPileDiv.appendChild(cardDiv);
    } else if (wastePile.length > 0) {
        // Show reset symbol if stock is empty but waste is not
        const resetDiv = document.createElement('div');
        resetDiv.textContent = '♻️';
        resetDiv.style.fontSize = '3rem';
        resetDiv.style.cursor = 'pointer';
        resetDiv.title = 'Reset Waste Pile';
        stockPileDiv.appendChild(resetDiv);
    }
}

/**
 * Renders the waste pile with performance optimizations.
 * @param {Card[]} wastePile - The waste pile array.
 * @param {Function} addDropListeners - Function to add drop event listeners.
 * @param {Function} addDragListeners - Function to add drag event listeners.
 */
export function renderWastePile(wastePile, addDropListeners, addDragListeners) {
    const wastePileDiv = DOMCache.get('waste-pile');

    // Efficiently clear existing content
    clearElement(wastePileDiv);
    addDropListeners(wastePileDiv);

    if (wastePile.length > 0) {
        const topCard = wastePile[wastePile.length - 1];
        const cardDiv = renderCard(topCard);
        addDragListeners(cardDiv);
        wastePileDiv.appendChild(cardDiv);
    }
}

/**
 * Renders the foundation piles with performance optimizations.
 * @param {Card[][]} foundationPiles - The foundation piles array.
 * @param {Function} addDropListeners - Function to add drop event listeners.
 */
export function renderFoundationPiles(foundationPiles, addDropListeners) {
    for (let i = 0; i < 4; i++) {
        const foundationPileDiv = DOMCache.get(`foundation-pile-${i}`);

        // Efficiently clear existing content
        clearElement(foundationPileDiv);
        addDropListeners(foundationPileDiv);

        const pile = foundationPiles[i];
        if (pile.length > 0) {
            const topCard = pile[pile.length - 1];
            foundationPileDiv.appendChild(renderCard(topCard));
        }
    }
}

/**
 * Renders the tableau piles with performance optimizations.
 * @param {Card[][]} tableauPiles - The tableau piles array.
 * @param {Function} addDropListeners - Function to add drop event listeners.
 * @param {Function} addDragListeners - Function to add drag event listeners.
 */
export function renderTableauPiles(tableauPiles, addDropListeners, addDragListeners) {
    for (let i = 0; i < 7; i++) {
        const tableauPileDiv = DOMCache.get(`tableau-pile-${i}`);

        // Efficiently clear existing content
        clearElement(tableauPileDiv);
        addDropListeners(tableauPileDiv);

        const pile = tableauPiles[i];

        // Use DocumentFragment for batch DOM operations
        const fragment = document.createDocumentFragment();

        pile.forEach((card, index) => {
            const cardDiv = renderCard(card);

            // Use transform instead of top for better performance
            cardDiv.style.transform = `translateY(${index * 25}px)`;

            if (card.isFaceUp) {
                addDragListeners(cardDiv);
            }
            fragment.appendChild(cardDiv);
        });

        tableauPileDiv.appendChild(fragment);
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
    const statusDiv = DOMCache.get('game-status');
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
 * Launches an optimized canvas-based fireworks animation.
 */
export function launchFireworks() {
    const canvas = DOMCache.get('fireworks-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let particles = [];
    let isAnimating = true;

    function createParticle(x, y) {
        // Reduce particle count for mobile devices
        const count = MobileOptimizer.isMobile ? 50 : 100;
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
        if (!isAnimating) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Use reverse loop for efficient array removal
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

    // Optimize animation frame rate for mobile
    let lastFrameTime = 0;
    const targetFrameTime = 1000 / MobileOptimizer.maxFrameRate;

    function animate(currentTime) {
        if (!isAnimating) return;

        if (currentTime - lastFrameTime >= targetFrameTime) {
            updateParticles();
            lastFrameTime = currentTime;
        }

        requestAnimationFrame(animate);
    }

    // Reduce firework frequency for mobile
    const fireworkInterval = MobileOptimizer.isMobile ? 1200 : 800;
    let fireworkTimer = setInterval(() => {
        if (isAnimating) {
            createParticle(Math.random() * canvas.width, Math.random() * canvas.height / 2);
        }
    }, fireworkInterval);

    requestAnimationFrame(animate);

    setTimeout(() => {
        clearInterval(fireworkTimer);
        setTimeout(() => {
            isAnimating = false;
            particles = [];
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 2000);
    }, 3000);
}

/**
 * Creates an optimized DOM-based confetti animation.
 */
export function createConfetti() {
    // Reduce confetti count significantly for mobile devices
    const confettiCount = MobileOptimizer.isMobile ? 50 : 200;
    const colors = ['#f00', '#0f0', '#00f', '#ff0', '#0ff', '#f0f'];

    // Use DocumentFragment for batch DOM operations
    const fragment = document.createDocumentFragment();
    const confettiElements = [];

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}vw`;
        confetti.style.top = `${-Math.random() * 100}vh`;
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = `${Math.random() * 2}s`;

        fragment.appendChild(confetti);
        confettiElements.push(confetti);
    }

    document.body.appendChild(fragment);

    // Clean up confetti elements efficiently
    setTimeout(() => {
        confettiElements.forEach(confetti => {
            if (confetti.parentNode) {
                confetti.parentNode.removeChild(confetti);
            }
        });
    }, 3000);
}