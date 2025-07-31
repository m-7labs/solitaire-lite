import {
    Card,
    createDeck,
    shuffleDeck,
    dealCards,
    checkWinCondition,
    attemptMove,
    attemptAutoComplete
} from './gameLogic.js';
import {
    updateDisplay,
    updateStatus,
    playSound,
    handleWin
} from './ui.js';

export class GameManager {
    constructor() {
        // Game state variables
        this.stockPile = [];
        this.wastePile = [];
        this.foundationPiles = [[], [], [], []];
        this.tableauPiles = [[], [], [], [], [], [], []];
        this.moveHistory = [];
        this.selectedCard = null; // For keyboard navigation
        this.draggedElement = null;
        this.touchDraggedElement = null;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchClone = null;
        this.timerInterval = null;
        this.startTime = 0;

        // Touch enhancements
        this.touchStartTime = 0;
        this.touchMoveThreshold = 10; // Minimum movement to register as drag
        this.touchDebounceDelay = 50; // Debounce delay in ms
        this.lastTouchAction = 0;
        this.isDragging = false;

        // DOM Element Cache for performance optimization
        this.domCache = new Map();
        this.cachedSelectors = new Map();

        // Event listener references for cleanup
        this.eventListeners = {
            touchStart: this.handleTouchStart.bind(this),
            touchMove: this.handleTouchMove.bind(this),
            touchEnd: this.handleTouchEnd.bind(this),
            touchCancel: this.handleTouchEnd.bind(this),
            keyDown: this.handleKeyDown.bind(this),
            stockClick: this.handleStockClick.bind(this)
        };
    }

    /**
     * Cached DOM element retrieval for performance
     */
    getDOMElement(id) {
        if (!this.domCache.has(id)) {
            this.domCache.set(id, document.getElementById(id));
        }
        return this.domCache.get(id);
    }

    /**
     * Cached selector queries for performance
     */
    getCachedElements(selector) {
        if (!this.cachedSelectors.has(selector)) {
            this.cachedSelectors.set(selector, document.querySelectorAll(selector));
        }
        return this.cachedSelectors.get(selector);
    }

    /**
     * Clear DOM cache when needed (e.g., on game reset)
     */
    clearDOMCache() {
        this.domCache.clear();
        this.cachedSelectors.clear();
    }

    saveGameState() {
        const gameState = {
            stockPile: this.stockPile,
            wastePile: this.wastePile,
            foundationPiles: this.foundationPiles,
            tableauPiles: this.tableauPiles,
            moveHistory: this.moveHistory,
            // Optionally save current timer state, though for simplicity, we'll reset on load
        };
        localStorage.setItem('solitaireGameState', JSON.stringify(gameState));
    }

    loadGameState() {
        const savedStateJSON = localStorage.getItem('solitaireGameState');
        if (!savedStateJSON) {
            return false;
        }

        try {
            const savedState = JSON.parse(savedStateJSON);

            if (savedState && typeof savedState === 'object' &&
                Array.isArray(savedState.stockPile) &&
                Array.isArray(savedState.wastePile) &&
                Array.isArray(savedState.foundationPiles) && savedState.foundationPiles.length === 4 &&
                Array.isArray(savedState.tableauPiles) && savedState.tableauPiles.length === 7) {

                const reconstructPile = (pile) => {
                    if (!pile) return [];
                    return pile.map(cardData => {
                        if (!cardData || typeof cardData.suit === 'undefined' || typeof cardData.rank === 'undefined') {
                            throw new Error('Invalid card data in pile.');
                        }
                        const card = new Card(cardData.suit, cardData.rank);
                        card.isFaceUp = cardData.isFaceUp;
                        return card;
                    });
                };

                this.stockPile = reconstructPile(savedState.stockPile);
                this.wastePile = reconstructPile(savedState.wastePile);
                this.foundationPiles = savedState.foundationPiles.map(reconstructPile);
                this.tableauPiles = savedState.tableauPiles.map(reconstructPile);
                this.moveHistory = savedState.moveHistory || [];

                return true;
            } else {
                console.warn('Invalid or missing saved game state, starting a new game.');
                return false;
            }
        } catch (e) {
            console.error('Error loading game state from localStorage:', e);
            return false;
        }
    }

    clearGameState() {
        this.stockPile = [];
        this.wastePile = [];
        this.foundationPiles = [[], [], [], []];
        this.tableauPiles = [[], [], [], [], [], [], []];
        this.moveHistory = [];
        localStorage.removeItem('solitaireGameState');
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.getDOMElement('timer').textContent = '00:00';
        this.getDOMElement('moves').textContent = '0';
        this.getDOMElement('score').textContent = '0';
        this.clearDOMCache(); // Clear cache on game reset
    }

    recordMove(move) {
        this.moveHistory.push(move);
        this.getDOMElement('moves').textContent = this.moveHistory.length;
    }

    getPile(type, index) {
        switch (type) {
            case 'tableau':
                return this.tableauPiles[index];
            case 'foundation':
                return this.foundationPiles[index];
            case 'waste':
                return this.wastePile;
            case 'stock':
                return this.stockPile;
            default:
                return [];
        }
    }

    undoLastMove() {
        if (this.moveHistory.length === 0) {
            console.log("No moves to undo.");
            updateStatus("No moves to undo.");
            return;
        }

        const lastMove = this.moveHistory.pop();
        const {
            type,
            movedCards,
            source,
            destination,
            flippedCard
        } = lastMove;

        const destPile = this.getPile(destination.type, destination.index);
        const cardsToMove = destPile.splice(destPile.length - movedCards.length);

        const sourcePile = this.getPile(source.type, source.index);
        if (type === 'reset-waste') {
            this.stockPile = cardsToMove.map(c => {
                c.isFaceUp = false;
                return c;
            })
            this.stockPile.reverse(); // Reverse to maintain order as it was from waste
            this.wastePile = [];
        } else {
            sourcePile.push(...cardsToMove);
        }

        if (flippedCard) {
            const sourceTableauPile = this.getPile(source.type, source.index);
            if (sourceTableauPile.length > 0) {
                const topCardIndex = sourceTableauPile.length - movedCards.length - 1;
                if (topCardIndex >= 0) {
                    const topCard = sourceTableauPile[topCardIndex];
                    if (topCard.id === flippedCard.id) { // Ensure it's the same card that was flipped up
                        topCard.isFaceUp = false;
                    }
                }
            }
        }

        if (type === 'stock-to-waste') {
            const card = sourcePile.pop(); // This card was moved from stock to waste, so it's in waste. sourcePile is stock.
            if (card) {
                card.isFaceUp = false;
                this.stockPile.push(card);
            }
        }

        this.getDOMElement('moves').textContent = this.moveHistory.length; // Update moves display
        this.updateDisplayWrapper();
        updateStatus("Undid the last move.");
        this.saveGameState(); // Save state after undo
    }

    handleDragStart(e) {
        if (e.target.classList.contains('card-back')) {
            e.preventDefault();
            return;
        }

        this.draggedElement = e.target;
        e.dataTransfer.effectAllowed = 'move';

        const pileElement = this.draggedElement.parentElement;
        const pileId = pileElement.id;
        const cardRank = this.draggedElement.dataset.rank;
        const cardSuit = this.draggedElement.dataset.suit;

        let originPileType = '';
        let pileIndex = -1;
        let cardIndex = -1;

        if (pileId.startsWith('tableau-')) {
            originPileType = 'tableau';
            pileIndex = parseInt(pileId.split('-')[2]);
            const pile = this.tableauPiles[pileIndex];
            cardIndex = pile.findIndex(c => c.isFaceUp && c.rank === cardRank && c.suit === cardSuit);
        } else if (pileId === 'waste-pile') {
            originPileType = 'waste';
            cardIndex = this.wastePile.length - 1;
        }

        const draggedInfo = {
            cardSuit,
            cardRank,
            originPileType,
            originPileIndex: pileIndex,
            originCardIndex: cardIndex,
        };

        e.dataTransfer.setData('application/json', JSON.stringify(draggedInfo));

        setTimeout(() => {
            this.draggedElement.classList.add('dragging');
        }, 0);
    }

    handleDragEnd() {
        if (this.draggedElement) {
            this.draggedElement.classList.remove('dragging');
        }
        this.draggedElement = null;
        this.getCachedElements('.pile.drop-zone').forEach(pile => {
            pile.classList.remove('drop-zone');
        });
        this.getCachedElements('.drag-over').forEach(pile => {
            pile.classList.remove('drag-over');
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const targetPileElement = e.target.closest('.pile');
        if (targetPileElement) {
            targetPileElement.classList.add('drop-zone');
        }
    }

    handleDragLeave(e) {
        const targetPileElement = e.target.closest('.pile');
        if (targetPileElement) {
            targetPileElement.classList.remove('drop-zone');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();

        const targetElement = e.target.closest('.pile');
        if (!targetElement || !this.draggedElement) {
            return;
        }

        targetElement.classList.remove('drop-zone');
        this.draggedElement.classList.remove('dragging');


        const draggedInfo = JSON.parse(e.dataTransfer.getData('application/json'));
        const targetInfo = {
            targetPile: targetElement.id
        };

        this.attemptMoveWrapper(draggedInfo, targetInfo);
    }

    handleTouchStart(e) {
        // Debounce rapid touch events
        const now = Date.now();
        if (now - this.lastTouchAction < this.touchDebounceDelay) {
            return;
        }
        this.lastTouchAction = now;

        const target = e.target.closest('.card');
        if (!target || target.classList.contains('card-back')) {
            return;
        }

        // Prevent default only after validation to avoid blocking scroll
        e.preventDefault();

        this.touchDraggedElement = target;
        this.touchStartTime = now;
        this.isDragging = false;

        const touch = e.targetTouches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;

        // Add visual feedback immediately
        this.touchDraggedElement.classList.add('touch-active');

        // Haptic feedback if supported
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    }

    handleTouchMove(e) {
        if (!this.touchDraggedElement) return;

        const touch = e.targetTouches[0];
        const dx = touch.clientX - this.touchStartX;
        const dy = touch.clientY - this.touchStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only start dragging if movement exceeds threshold
        if (!this.isDragging && distance < this.touchMoveThreshold) {
            return;
        }

        // Prevent default to avoid scrolling during drag
        e.preventDefault();

        // Initialize drag clone if not already done
        if (!this.isDragging) {
            this.isDragging = true;
            this.touchDraggedElement.classList.remove('touch-active');
            this.touchDraggedElement.classList.add('dragging');

            this.touchClone = this.touchDraggedElement.cloneNode(true);
            this.touchClone.style.position = 'absolute';
            this.touchClone.style.zIndex = '1000';
            this.touchClone.style.pointerEvents = 'none';
            this.touchClone.style.opacity = '0.8';
            document.body.appendChild(this.touchClone);

            const rect = this.touchDraggedElement.getBoundingClientRect();
            this.touchClone.style.left = `${rect.left}px`;
            this.touchClone.style.top = `${rect.top}px`;
            this.touchClone.style.width = `${rect.width}px`;
            this.touchClone.style.height = `${rect.height}px`;
        }

        this.touchClone.style.transform = `translate(${dx}px, ${dy}px)`;

        // Find drop target with improved hit detection
        this.touchClone.style.display = 'none';
        const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        this.touchClone.style.display = '';

        this.getCachedElements('.pile.drop-zone').forEach(p => p.classList.remove('drop-zone'));
        const dropTarget = elementUnder ? elementUnder.closest('.pile') : null;
        if (dropTarget && dropTarget !== this.touchDraggedElement.parentElement) {
            dropTarget.classList.add('drop-zone');
        }
    }

    handleTouchEnd(e) {
        if (!this.touchDraggedElement) return;

        const touch = e.changedTouches[0];
        const touchDuration = Date.now() - this.touchStartTime;

        // Clean up visual states
        this.touchDraggedElement.classList.remove('touch-active', 'dragging');
        this.getCachedElements('.pile.drop-zone').forEach(p => p.classList.remove('drop-zone'));

        let dropTarget = null;

        if (this.isDragging && this.touchClone) {
            // Handle drag-based interaction
            this.touchClone.style.display = 'none';
            const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
            this.touchClone.style.display = '';
            dropTarget = elementUnder ? elementUnder.closest('.pile') : null;
        } else if (touchDuration < 300) {
            // Handle tap-based interaction with tolerance zone
            const toleranceRadius = 20; // Increased touch tolerance
            let closestElement = null;
            let closestDistance = Infinity;

            document.querySelectorAll('.pile').forEach(pile => {
                const rect = pile.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const distance = Math.sqrt(
                    Math.pow(touch.clientX - centerX, 2) +
                    Math.pow(touch.clientY - centerY, 2)
                );

                if (distance < toleranceRadius && distance < closestDistance) {
                    closestDistance = distance;
                    closestElement = pile;
                }
            });

            dropTarget = closestElement;
        }

        if (dropTarget && dropTarget !== this.touchDraggedElement.parentElement) {
            const pileElement = this.touchDraggedElement.parentElement;
            const pileId = pileElement.id;
            const cardRank = this.touchDraggedElement.dataset.rank;
            const cardSuit = this.touchDraggedElement.dataset.suit;

            let originPileType = '';
            let pileIndex = -1;
            let cardIndex = -1;

            if (pileId.startsWith('tableau-')) {
                originPileType = 'tableau';
                pileIndex = parseInt(pileId.split('-')[2]);
                const pile = this.tableauPiles[pileIndex];
                cardIndex = pile.findIndex(c => c.isFaceUp && c.rank === cardRank && c.suit === cardSuit);
            } else if (pileId === 'waste-pile') {
                originPileType = 'waste';
                cardIndex = this.wastePile.length - 1;
            }

            const draggedInfo = {
                cardSuit,
                cardRank,
                originPileType,
                originPileIndex: pileIndex,
                originCardIndex: cardIndex,
            };
            const targetInfo = {
                targetPile: dropTarget.id
            };

            this.attemptMoveWrapper(draggedInfo, targetInfo);
        }

        // Clean up
        if (this.touchClone) {
            document.body.removeChild(this.touchClone);
        }
        this.touchDraggedElement = null;
        this.touchClone = null;
        this.isDragging = false;
    }

    addDragListeners(element) {
        element.addEventListener('dragstart', this.handleDragStart.bind(this));
        element.addEventListener('dragend', this.handleDragEnd.bind(this));
    }

    addDropListeners(element) {
        element.addEventListener('dragover', this.handleDragOver.bind(this));
        element.addEventListener('dragleave', this.handleDragLeave.bind(this));
        element.addEventListener('drop', this.handleDrop.bind(this));
    }

    addGameEventListeners() {
        const stockPileDiv = this.getDOMElement('stock-pile');
        stockPileDiv.addEventListener('click', this.eventListeners.stockClick);

        // Add touch event listeners to card piles with optimizations
        this.getCachedElements('.pile').forEach(pile => {
            pile.addEventListener('touchstart', this.eventListeners.touchStart, {
                passive: false
            });
        });
        document.addEventListener('touchmove', this.eventListeners.touchMove, {
            passive: false
        });
        document.addEventListener('touchend', this.eventListeners.touchEnd, {
            passive: true
        });
        document.addEventListener('touchcancel', this.eventListeners.touchCancel, {
            passive: true
        });

        this.getDOMElement('undo').addEventListener('click', () => {
            this.undoLastMove();
        });
        this.getDOMElement('auto-complete').addEventListener('click', () => {
            this.attemptAutoCompleteWrapper();
        });
        this.getDOMElement('new-game').addEventListener('click', () => this.startNewGame());
        this.getDOMElement('play-again').addEventListener('click', () => this.startNewGame());

        // Mute button listener
        this.getDOMElement('mute-button').addEventListener('click', (e) => {
            const button = e.target;
            button.textContent = button.textContent === '🔊' ? '🔇' : '🔊';
            updateStatus(button.textContent === '🔊' ? 'Audio unmuted' : 'Audio muted');
        });

        document.addEventListener('keydown', this.eventListeners.keyDown);
    }

    /**
     * Remove event listeners for cleanup
     */
    removeEventListeners() {
        const stockPileDiv = this.getDOMElement('stock-pile');
        if (stockPileDiv) {
            stockPileDiv.removeEventListener('click', this.eventListeners.stockClick);
        }

        this.getCachedElements('.pile').forEach(pile => {
            pile.removeEventListener('touchstart', this.eventListeners.touchStart);
        });

        document.removeEventListener('touchmove', this.eventListeners.touchMove);
        document.removeEventListener('touchend', this.eventListeners.touchEnd);
        document.removeEventListener('touchcancel', this.eventListeners.touchCancel);
        document.removeEventListener('keydown', this.eventListeners.keyDown);
    }

    handleStockClick() {
        if (this.stockPile.length > 0) {
            const card = this.stockPile[this.stockPile.length - 1];
            this.recordMove({
                type: 'stock-to-waste',
                movedCards: [JSON.parse(JSON.stringify(card))],
                source: {
                    type: 'stock',
                    index: null
                },
                destination: {
                    type: 'waste',
                    index: null
                }
            });
            this.stockPile.pop();
            card.isFaceUp = true;
            this.wastePile.push(card);
            updateStatus(`Drew ${card.rank} of ${card.suit} from stock.`);
            playSound('flip');
        } else if (this.wastePile.length > 0) {
            this.recordMove({
                type: 'reset-waste',
                movedCards: JSON.parse(JSON.stringify(this.wastePile)), // Deep copy the waste pile
                source: {
                    type: 'waste',
                    index: null
                },
                destination: {
                    type: 'stock',
                    index: null
                }
            });
            this.stockPile = this.wastePile.reverse().map(c => {
                c.isFaceUp = false;
                return c
            });
            this.wastePile = [];
            updateStatus("Reset waste pile to stock.");
            playSound('move');
        }
        this.saveGameState();
        this.updateDisplayWrapper();
    }

    handleKeyDown(e) {
        const focusableElements = Array.from(this.getCachedElements('[tabindex="0"], button'));
        const focusedElement = document.activeElement;
        const focusedIndex = focusableElements.indexOf(focusedElement);

        if (e.key.startsWith('Arrow')) {
            e.preventDefault();
            let nextIndex = focusedIndex;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                nextIndex = (focusedIndex + 1) % focusableElements.length;
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                nextIndex = (focusedIndex - 1 + focusableElements.length) % focusableElements.length;
            }
            focusableElements[nextIndex].focus();
            return;
        }

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();

            if (focusedElement.tagName === 'BUTTON') {
                focusedElement.click();
                return;
            }

            if (focusedElement.id === 'stock-pile') {
                this.handleStockClick();
                return;
            }

            const isCard = focusedElement.classList.contains('card');
            const isPile = focusedElement.classList.contains('pile');

            if (isCard) {
                const pileElement = focusedElement.parentElement;
                const pileId = pileElement.id;
                const cardRank = focusedElement.dataset.rank;
                const cardSuit = focusedElement.dataset.suit;

                let originPileType = '';
                let pileIndex = -1;
                let cardIndex = -1;

                if (pileId.startsWith('tableau-')) {
                    originPileType = 'tableau';
                    pileIndex = parseInt(pileId.split('-')[2]);
                    const pile = this.tableauPiles[pileIndex];
                    cardIndex = pile.findIndex(c => c.isFaceUp && c.rank === cardRank && c.suit === cardSuit);
                } else if (pileId === 'waste-pile') {
                    originPileType = 'waste';
                    cardIndex = this.wastePile.length - 1;
                }

                const draggedInfo = {
                    cardSuit,
                    cardRank,
                    originPileType,
                    originPileIndex: pileIndex,
                    originCardIndex: cardIndex,
                    element: focusedElement
                };

                if (!this.selectedCard) {
                    this.selectedCard = draggedInfo;
                    focusedElement.classList.add('focused');
                    updateStatus(`Selected ${cardRank} of ${cardSuit}.`);
                } else {
                    if (this.selectedCard.element === focusedElement) {
                        this.selectedCard = null;
                        focusedElement.classList.remove('focused');
                        updateStatus(`Deselected ${cardRank} of ${cardSuit}.`);
                    } else {
                        const targetInfo = {
                            targetPile: pileId
                        };
                        this.attemptMoveWrapper(this.selectedCard, targetInfo);
                        this.selectedCard.element.classList.remove('focused');
                        this.selectedCard = null;
                    }
                }
            } else if (isPile && this.selectedCard) {
                const targetInfo = {
                    targetPile: focusedElement.id
                };
                this.attemptMoveWrapper(this.selectedCard, targetInfo);
                this.selectedCard.element.classList.remove('focused');
                this.selectedCard = null;
            }
        }
    }

    startNewGame() {
        const winCelebration = this.getDOMElement('win-celebration');
        if (winCelebration) {
            winCelebration.classList.remove('show');
        }
        this.clearGameState();
        this.initGame();
        updateStatus("New game started.");
        this.startTimer();
    }

    initGame() {
        let deck = createDeck();
        shuffleDeck(deck);
        const dealt = dealCards(deck, this.tableauPiles);
        this.stockPile = dealt.stockPile;
        this.tableauPiles = dealt.tableauPiles;
        this.updateDisplayWrapper();
        this.saveGameState();
    }

    updateDisplayWrapper() {
        const gameState = {
            stockPile: this.stockPile,
            wastePile: this.wastePile,
            foundationPiles: this.foundationPiles,
            tableauPiles: this.tableauPiles
        };
        const listeners = {
            addDropListeners: this.addDropListeners.bind(this),
            addDragListeners: this.addDragListeners.bind(this),
            addTouchStart: this.handleTouchStart.bind(this)
        };
        updateDisplay(gameState, listeners);
    }

    attemptMoveWrapper(draggedInfo, targetInfo) {
        const gameState = {
            stockPile: this.stockPile,
            wastePile: this.wastePile,
            foundationPiles: this.foundationPiles,
            tableauPiles: this.tableauPiles,
            moveHistory: this.moveHistory
        };
        const listeners = {
            addDropListeners: this.addDropListeners.bind(this),
            addDragListeners: this.addDragListeners.bind(this)
        };
        const recordMoveFunc = this.recordMove.bind(this);
        const saveGameStateFunc = this.saveGameState.bind(this);
        const checkWinConditionFunc = (fP) => checkWinCondition(fP);
        const attemptAutoCompleteFunc = this.attemptAutoCompleteWrapper.bind(this);

        const result = attemptMove(draggedInfo, targetInfo, gameState, listeners, recordMoveFunc, saveGameStateFunc, checkWinConditionFunc, attemptAutoCompleteFunc);


        if (result.valid) {
            this.stockPile = result.state.stockPile;
            this.wastePile = result.state.wastePile;
            this.foundationPiles = result.state.foundationPiles;
            this.tableauPiles = result.state.tableauPiles;
            this.moveHistory = result.state.moveHistory;


            this.updateDisplayWrapper();
            this.saveGameState();
            playSound('move');
            updateStatus(result.message);

            // Update scores
            this.getDOMElement('score').textContent = result.score;
            this.getDOMElement('moves').textContent = this.moveHistory.length;


            // Check for win condition
            if (checkWinCondition(this.foundationPiles)) {
                handleWin(this.foundationPiles);
                this.stopTimer();
            } else {
                // Try auto-complete after successful move
                setTimeout(() => {
                    if (this.attemptAutoCompleteWrapper()) { // Attempt auto-complete, if successful, it means cards moved to foundation
                        if (checkWinCondition(this.foundationPiles)) {
                            handleWin(this.foundationPiles);
                            this.stopTimer(); // Ensure timer stops on auto-complete win
                        } else {
                            this.updateDisplayWrapper(); // Update display for auto-complete moves
                        }
                    }
                }, 250);
            }
        } else {
            playSound('error');
            updateStatus(result.message);
        }
    }

    attemptAutoCompleteWrapper() {
        const initialScore = parseInt(this.getDOMElement('score').textContent);
        const cardsMovedToFoundation = attemptAutoComplete(
            this.tableauPiles,
            this.wastePile,
            this.foundationPiles,
            this.recordMove.bind(this) // Pass recordMove as callback for auto-complete moves
        );

        if (cardsMovedToFoundation > 0) {
            // Scoring for auto-complete: 10 points per card moved to foundation
            const newScore = initialScore + (cardsMovedToFoundation * 10);
            this.getDOMElement('score').textContent = newScore;
            updateStatus(`Auto-completed ${cardsMovedToFoundation} cards to foundation.`);
            playSound('place');
            this.saveGameState();
            this.updateDisplayWrapper();
            return true;
        }
        return false;
    }

    startTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        this.startTime = Date.now();
        const timerElement = this.getDOMElement('timer');
        this.timerInterval = setInterval(() => {
            const elapsedTime = Date.now() - this.startTime;
            const minutes = Math.floor(elapsedTime / 60000);
            const seconds = Math.floor((elapsedTime % 60000) / 1000);
            timerElement.textContent =
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    initializeGame() {
        if (!this.loadGameState()) {
            this.initGame();
        } else {
            this.updateDisplayWrapper();
            this.startTimer(); // Resume timer if game state loaded
        }
        this.addGameEventListeners();
    }
}