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
 * Creates a gentle envelope for smooth sound transitions.
 * @param {GainNode} gainNode - The gain node to apply envelope to.
 * @param {AudioContext} audioContext - The audio context.
 * @param {number} attack - Attack time in seconds.
 * @param {number} sustain - Sustain level (0-1).
 * @param {number} decay - Decay time in seconds.
 * @param {number} release - Release time in seconds.
 */
function createGentleEnvelope(gainNode, audioContext, attack = 0.05, sustain = 0.3, decay = 0.1, release = 0.3) {
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(sustain, now + attack);
    gainNode.gain.linearRampToValueAtTime(sustain * 0.7, now + attack + decay);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + attack + decay + release);
}

/**
 * Creates a warm filter for more pleasant tones.
 * @param {AudioContext} audioContext - The audio context.
 * @returns {BiquadFilterNode} The configured filter.
 */
function createWarmFilter(audioContext) {
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, audioContext.currentTime);
    filter.Q.setValueAtTime(1, audioContext.currentTime);
    return filter;
}

/**
 * Plays a gentle whoosh sound for card flips.
 * @param {AudioContext} audioContext - The audio context.
 */
function playFlipSound(audioContext) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = createWarmFilter(audioContext);

    // Create a gentle frequency sweep for a soft whoosh
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.15);

    createGentleEnvelope(gainNode, audioContext, 0.02, 0.25, 0.05, 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.22);
}

/**
 * Plays an encouraging ascending tone for valid moves.
 * @param {AudioContext} audioContext - The audio context.
 */
function playMoveSound(audioContext) {
    const oscillator1 = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const gainNode1 = audioContext.createGain();
    const gainNode2 = audioContext.createGain();
    const masterGain = audioContext.createGain();
    const filter = createWarmFilter(audioContext);

    // Create a pleasant chord with fundamental and fifth
    oscillator1.connect(gainNode1);
    oscillator2.connect(gainNode2);
    gainNode1.connect(filter);
    gainNode2.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(audioContext.destination);

    oscillator1.type = 'sine';
    oscillator2.type = 'sine';

    // Root note and perfect fifth for harmony
    oscillator1.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    oscillator2.frequency.setValueAtTime(783.99, audioContext.currentTime); // G5

    // Gentle ascending glide
    oscillator1.frequency.exponentialRampToValueAtTime(587.33, audioContext.currentTime + 0.25); // D5
    oscillator2.frequency.exponentialRampToValueAtTime(880.00, audioContext.currentTime + 0.25); // A5

    createGentleEnvelope(gainNode1, audioContext, 0.03, 0.3, 0.08, 0.2);
    createGentleEnvelope(gainNode2, audioContext, 0.03, 0.25, 0.08, 0.2);

    oscillator1.start(audioContext.currentTime);
    oscillator2.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.31);
    oscillator2.stop(audioContext.currentTime + 0.31);
}

/**
 * Plays a gentle, non-punitive sound for invalid moves.
 * @param {AudioContext} audioContext - The audio context.
 */
function playInvalidSound(audioContext) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = createWarmFilter(audioContext);

    // Create a soft, descending tone that suggests "try again"
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(349.23, audioContext.currentTime); // F4
    oscillator.frequency.exponentialRampToValueAtTime(293.66, audioContext.currentTime + 0.3); // D4

    // Softer envelope for less jarring feedback
    createGentleEnvelope(gainNode, audioContext, 0.04, 0.2, 0.1, 0.25);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.39);
}

// Global AudioContext for reuse
let globalAudioContext = null;

/**
 * Gets or creates the global AudioContext and ensures it's running.
 * @returns {AudioContext|null} The audio context or null if unavailable.
 */
async function getAudioContext() {
    if (!globalAudioContext) {
        try {
            globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('[SOUND DEBUG] AudioContext created, state:', globalAudioContext.state);
        } catch (e) {
            console.error('[SOUND DEBUG] Failed to create AudioContext:', e);
            return null;
        }
    }

    // Resume if suspended (required by modern browsers)
    if (globalAudioContext.state === 'suspended') {
        try {
            await globalAudioContext.resume();
            console.log('[SOUND DEBUG] AudioContext resumed, new state:', globalAudioContext.state);
        } catch (e) {
            console.error('[SOUND DEBUG] Failed to resume AudioContext:', e);
            return null;
        }
    }

    return globalAudioContext;
}

/**
 * Plays a sound for a game action with pleasant, encouraging tones.
 * @param {string} type - The type of sound ('move', 'flip', 'invalid', 'win').
 */
export async function playSound(type) {
    const isMuted = document.getElementById('mute-button').textContent === '🔇';
    console.log('[SOUND DEBUG] playSound called with type:', type, 'muted:', isMuted);

    if (isMuted) {
        console.log('[SOUND DEBUG] Sound is muted, skipping');
        return;
    }

    try {
        const audioContext = await getAudioContext();
        if (!audioContext) {
            console.error('[SOUND DEBUG] AudioContext unavailable');
            return;
        }

        console.log('[SOUND DEBUG] Playing sound type:', type, 'AudioContext state:', audioContext.state);

        switch (type) {
            case 'flip':
                playFlipSound(audioContext);
                break;
            case 'move':
                playMoveSound(audioContext);
                break;
            case 'invalid':
                playInvalidSound(audioContext);
                break;
            case 'win':
                playWinSound(); // Use the specialized win sound
                break;
            default:
                console.warn('[SOUND DEBUG] Unknown sound type:', type);
        }
    } catch (e) {
        console.error('[SOUND DEBUG] Error in playSound:', e);
    }
}

/**
 * Plays a single chord for the win sound sequence.
 * @param {AudioContext} audioContext - The audio context.
 * @param {number[]} frequencies - Array of frequencies for the chord.
 * @param {number} delay - Delay offset for the chord.
 */
function playWinChord(audioContext, frequencies, delay) {
    const masterGain = audioContext.createGain();
    const filter = createWarmFilter(audioContext);

    masterGain.connect(filter);
    filter.connect(audioContext.destination);

    const oscillators = frequencies.map((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(masterGain);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + delay);

        // Slight detuning for richness
        const detune = (index - 1) * 2;
        oscillator.detune.setValueAtTime(detune, audioContext.currentTime + delay);

        // Individual voice envelopes
        const voiceGain = 0.2 / frequencies.length; // Normalize by chord size
        createGentleEnvelope(gainNode, audioContext, 0.05 + delay, voiceGain, 0.1, 0.4);

        return oscillator;
    });

    // Start all oscillators
    oscillators.forEach(osc => {
        osc.start(audioContext.currentTime + delay);
        osc.stop(audioContext.currentTime + delay + 0.55);
    });
}

/**
 * Plays a celebratory sound for winning the game with rich harmonics.
 */
export async function playWinSound() {
    try {
        const audioContext = await getAudioContext();
        if (!audioContext) {
            console.error('[SOUND DEBUG] AudioContext unavailable for win sound');
            return;
        }

        console.log('[SOUND DEBUG] Playing win sound sequence');

        // Create a joyful chord progression
        setTimeout(() => playWinChord(audioContext, [523.25, 659.25, 783.99], 0), 0);      // C major
        setTimeout(() => playWinChord(audioContext, [587.33, 739.99, 880.00], 0.3), 300);  // D major
        setTimeout(() => playWinChord(audioContext, [659.25, 830.61, 987.77], 0.6), 600);  // E major
        setTimeout(() => playWinChord(audioContext, [698.46, 880.00, 1046.50], 0.9), 900); // F major

    } catch (e) {
        console.error('[SOUND DEBUG] Error in playWinSound:', e);
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