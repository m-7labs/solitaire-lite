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
        document.getElementById('timer').textContent = '00:00';
        document.getElementById('moves').textContent = '0';
        document.getElementById('score').textContent = '0';
    }

    recordMove(move) {
        this.moveHistory.push(move);
        document.getElementById('moves').textContent = this.moveHistory.length;
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

        document.getElementById('moves').textContent = this.moveHistory.length; // Update moves display
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
        document.querySelectorAll('.pile.drop-zone').forEach(pile => {
            pile.classList.remove('drop-zone');
        });
        document.querySelectorAll('.drag-over').forEach(pile => {
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
        const target = e.target.closest('.card');
        if (!target || target.classList.contains('card-back')) {
            return;
        }

        e.preventDefault();
        this.touchDraggedElement = target;

        const touch = e.targetTouches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;

        this.touchClone = this.touchDraggedElement.cloneNode(true);
        this.touchClone.style.position = 'absolute';
        this.touchClone.style.zIndex = '1000';
        this.touchClone.style.pointerEvents = 'none';
        document.body.appendChild(this.touchClone);

        const rect = this.touchDraggedElement.getBoundingClientRect();
        this.touchClone.style.left = `${rect.left}px`;
        this.touchClone.style.top = `${rect.top}px`;
        this.touchClone.style.width = `${rect.width}px`;
        this.touchClone.style.height = `${rect.height}px`;

        this.touchDraggedElement.classList.add('dragging');
    }

    handleTouchMove(e) {
        if (!this.touchDraggedElement) return;

        e.preventDefault();

        const touch = e.targetTouches[0];
        const dx = touch.clientX - this.touchStartX;
        const dy = touch.clientY - this.touchStartY;

        this.touchClone.style.transform = `translate(${dx}px, ${dy}px)`;

        this.touchClone.style.display = 'none';
        const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        this.touchClone.style.display = '';

        document.querySelectorAll('.pile.drop-zone').forEach(p => p.classList.remove('drop-zone'));
        const dropTarget = elementUnder ? elementUnder.closest('.pile') : null;
        if (dropTarget) {
            dropTarget.classList.add('drop-zone');
        }
    }

    handleTouchEnd(e) {
        if (!this.touchDraggedElement) return;

        const touch = e.changedTouches[0];
        this.touchClone.style.display = 'none';
        const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        this.touchClone.style.display = '';

        const dropTarget = elementUnder ? elementUnder.closest('.pile') : null;

        if (dropTarget) {
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

        this.touchDraggedElement.classList.remove('dragging');
        document.querySelectorAll('.pile.drop-zone').forEach(p => p.classList.remove('drop-zone'));
        if (this.touchClone) {
            document.body.removeChild(this.touchClone);
        }
        this.touchDraggedElement = null;
        this.touchClone = null;
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
        const stockPileDiv = document.getElementById('stock-pile');
        stockPileDiv.addEventListener('click', this.handleStockClick.bind(this));

        // Add touch event listeners to card piles
        document.querySelectorAll('.pile').forEach(pile => {
            pile.addEventListener('touchstart', this.handleTouchStart.bind(this), {
                passive: false
            });
        });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), {
            passive: false
        });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));


        document.getElementById('undo').addEventListener('click', () => {
            this.undoLastMove();
        });
        document.getElementById('auto-complete').addEventListener('click', () => {
            this.attemptAutoCompleteWrapper();
        });
        document.getElementById('new-game').addEventListener('click', () => this.startNewGame());
        document.getElementById('play-again').addEventListener('click', () => this.startNewGame());

        // Dummy mute button listener
        // document.getElementById('mute-button').addEventListener('click', (e) => {
        //     const button = e.target;
        //     button.textContent = button.textContent === '🔊' ? '🔇' : '🔊';
        //     updateStatus(button.textContent === '🔊' ? 'Audio unmuted' : 'Audio muted');
        // });

        document.addEventListener('keydown', this.handleKeyDown.bind(this));
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
        const focusableElements = Array.from(document.querySelectorAll('[tabindex="0"], button'));
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
        document.getElementById('win-celebration').classList.remove('show');
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
            document.getElementById('score').textContent = result.score;
            document.getElementById('moves').textContent = this.moveHistory.length;


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
        const initialScore = parseInt(document.getElementById('score').textContent);
        const cardsMovedToFoundation = attemptAutoComplete(
            this.tableauPiles,
            this.wastePile,
            this.foundationPiles,
            this.recordMove.bind(this) // Pass recordMove as callback for auto-complete moves
        );

        if (cardsMovedToFoundation > 0) {
            // Scoring for auto-complete: 10 points per card moved to foundation
            const newScore = initialScore + (cardsMovedToFoundation * 10);
            document.getElementById('score').textContent = newScore;
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
        this.timerInterval = setInterval(() => {
            const elapsedTime = Date.now() - this.startTime;
            const minutes = Math.floor(elapsedTime / 60000);
            const seconds = Math.floor((elapsedTime % 60000) / 1000);
            document.getElementById('timer').textContent =
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