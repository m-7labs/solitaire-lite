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

// Game state variables
let stockPile = [];
let wastePile = [];
let foundationPiles = [[], [], [], []];
let tableauPiles = [[], [], [], [], [], [], []];
let moveHistory = [];
let selectedCard = null; // For keyboard navigation
let draggedElement = null;
let touchDraggedElement = null;
let touchStartX = 0;
let touchStartY = 0;
let touchClone = null;

function saveGameState() {
    const gameState = {
        stockPile: stockPile,
        wastePile: wastePile,
        foundationPiles: foundationPiles,
        tableauPiles: tableauPiles,
        moveHistory: moveHistory
    };
    localStorage.setItem('solitaireGameState', JSON.stringify(gameState));
}

function loadGameState() {
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

            stockPile = reconstructPile(savedState.stockPile);
            wastePile = reconstructPile(savedState.wastePile);
            foundationPiles = savedState.foundationPiles.map(reconstructPile);
            tableauPiles = savedState.tableauPiles.map(reconstructPile);
            moveHistory = savedState.moveHistory || [];

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

function clearGameState() {
    stockPile = [];
    wastePile = [];
    foundationPiles = [[], [], [], []];
    tableauPiles = [[], [], [], [], [], [], []];
    moveHistory = [];
    localStorage.removeItem('solitaireGameState');
}

function recordMove(move) {
    moveHistory.push(move);
}

function getPile(type, index) {
    switch (type) {
        case 'tableau':
            return tableauPiles[index];
        case 'foundation':
            return foundationPiles[index];
        case 'waste':
            return wastePile;
        case 'stock':
            return stockPile;
        default:
            return [];
    }
}

function undoLastMove() {
    if (moveHistory.length === 0) {
        console.log("No moves to undo.");
        updateStatus("No moves to undo.");
        return;
    }

    const lastMove = moveHistory.pop();
    const {
        type,
        movedCards,
        source,
        destination,
        flippedCard
    } = lastMove;

    const destPile = getPile(destination.type, destination.index);
    const cardsToMove = destPile.splice(destPile.length - movedCards.length);

    const sourcePile = getPile(source.type, source.index);
    if (type === 'reset-waste') {
        stockPile = cardsToMove.map(c => {
            c.isFaceUp = false;
            return c;
        });
        wastePile = [];
    } else {
        sourcePile.push(...cardsToMove);
    }

    if (flippedCard) {
        const sourceTableauPile = getPile(source.type, source.index);
        if (sourceTableauPile.length > 0) {
            const topCard = sourceTableauPile[sourceTableauPile.length - movedCards.length - 1];
            if (topCard) topCard.isFaceUp = false;
        }
    }

    if (type === 'stock-to-waste') {
        const card = sourcePile.pop();
        card.isFaceUp = false;
        stockPile.push(card);
    }

    updateDisplayWrapper();
    updateStatus("Undid the last move.");
}

function handleDragStart(e) {
    if (e.target.classList.contains('card-back')) {
        e.preventDefault();
        return;
    }

    draggedElement = e.target;
    e.dataTransfer.effectAllowed = 'move';

    const pileElement = draggedElement.parentElement;
    const pileId = pileElement.id;
    const cardRank = draggedElement.dataset.rank;
    const cardSuit = draggedElement.dataset.suit;

    let originPileType = '';
    let pileIndex = -1;
    let cardIndex = -1;

    if (pileId.startsWith('tableau-')) {
        originPileType = 'tableau';
        pileIndex = parseInt(pileId.split('-')[2]);
        const pile = tableauPiles[pileIndex];
        cardIndex = pile.findIndex(c => c.isFaceUp && c.rank === cardRank && c.suit === cardSuit);
    } else if (pileId === 'waste-pile') {
        originPileType = 'waste';
        cardIndex = wastePile.length - 1;
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
        draggedElement.classList.add('dragging');
    }, 0);
}

function handleDragEnd() {
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
    }
    draggedElement = null;
    document.querySelectorAll('.drag-over').forEach(pile => {
        pile.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('.card-pile');
    if (target) {
        target.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const target = e.target.closest('.card-pile');
    if (target) {
        target.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const targetElement = e.target.closest('.card-pile');
    if (!targetElement || !draggedElement) {
        return;
    }

    targetElement.classList.remove('drag-over');

    const draggedInfo = JSON.parse(e.dataTransfer.getData('application/json'));
    const targetInfo = {
        targetPile: targetElement.id
    };

    attemptMoveWrapper(draggedInfo, targetInfo);
}

function handleTouchStart(e) {
    const target = e.target.closest('.card');
    if (!target || target.classList.contains('card-back')) {
        return;
    }

    e.preventDefault();
    touchDraggedElement = target;

    const touch = e.targetTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    touchClone = touchDraggedElement.cloneNode(true);
    touchClone.style.position = 'absolute';
    touchClone.style.zIndex = '1000';
    touchClone.style.pointerEvents = 'none';
    document.body.appendChild(touchClone);

    const rect = touchDraggedElement.getBoundingClientRect();
    touchClone.style.left = `${rect.left}px`;
    touchClone.style.top = `${rect.top}px`;
    touchClone.style.width = `${rect.width}px`;
    touchClone.style.height = `${rect.height}px`;

    touchDraggedElement.classList.add('dragging');
}

function handleTouchMove(e) {
    if (!touchDraggedElement) return;

    e.preventDefault();

    const touch = e.targetTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    touchClone.style.transform = `translate(${dx}px, ${dy}px)`;

    touchClone.style.display = 'none';
    const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
    touchClone.style.display = '';

    document.querySelectorAll('.drag-over').forEach(p => p.classList.remove('drag-over'));
    const dropTarget = elementUnder ? elementUnder.closest('.card-pile') : null;
    if (dropTarget) {
        dropTarget.classList.add('drag-over');
    }
}

function handleTouchEnd(e) {
    if (!touchDraggedElement) return;

    const touch = e.changedTouches[0];
    touchClone.style.display = 'none';
    const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
    touchClone.style.display = '';

    const dropTarget = elementUnder ? elementUnder.closest('.card-pile') : null;

    if (dropTarget) {
        const pileElement = touchDraggedElement.parentElement;
        const pileId = pileElement.id;
        const cardRank = touchDraggedElement.dataset.rank;
        const cardSuit = touchDraggedElement.dataset.suit;

        let originPileType = '';
        let pileIndex = -1;
        let cardIndex = -1;

        if (pileId.startsWith('tableau-')) {
            originPileType = 'tableau';
            pileIndex = parseInt(pileId.split('-')[2]);
            const pile = tableauPiles[pileIndex];
            cardIndex = pile.findIndex(c => c.isFaceUp && c.rank === cardRank && c.suit === cardSuit);
        } else if (pileId === 'waste-pile') {
            originPileType = 'waste';
            cardIndex = wastePile.length - 1;
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

        attemptMoveWrapper(draggedInfo, targetInfo);
    }

    touchDraggedElement.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(p => p.classList.remove('drag-over'));
    if (touchClone) {
        document.body.removeChild(touchClone);
    }
    touchDraggedElement = null;
    touchClone = null;
}

function addDragListeners(element) {
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragend', handleDragEnd);
    element.addEventListener('touchstart', handleTouchStart, {
        passive: false
    });
}

function addDropListeners(element) {
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('dragleave', handleDragLeave);
    element.addEventListener('drop', handleDrop);
}

function addGameEventListeners() {
    const stockPileDiv = document.getElementById('stock-pile');
    stockPileDiv.addEventListener('click', handleStockClick);

    document.addEventListener('touchmove', handleTouchMove, {
        passive: false
    });
    document.addEventListener('touchend', handleTouchEnd);

    document.getElementById('undo-button').addEventListener('click', () => {
        undoLastMove();
        saveGameState();
    });
    document.getElementById('autocomplete-button').addEventListener('click', () => {
        attemptAutoComplete(tableauPiles, wastePile, foundationPiles, () => checkWinCondition(foundationPiles), saveGameState);
        updateDisplayWrapper();
        if (checkWinCondition(foundationPiles)) {
            handleWin(foundationPiles);
        }
    });
    document.getElementById('new-game-button').addEventListener('click', startNewGame);
    document.getElementById('play-again-button').addEventListener('click', startNewGame);

    document.getElementById('mute-button').addEventListener('click', (e) => {
        const button = e.target;
        button.textContent = button.textContent === '🔊' ? '🔇' : '🔊';
        updateStatus(button.textContent === '🔊' ? 'Audio unmuted' : 'Audio muted');
    });

    document.addEventListener('keydown', handleKeyDown);
}

function handleStockClick() {
    if (stockPile.length > 0) {
        const card = stockPile[stockPile.length - 1];
        recordMove({
            type: 'stock-to-waste',
            movedCards: [JSON.parse(JSON.stringify(card))],
            source: {
                type: 'waste'
            },
            destination: {
                type: 'stock'
            }
        });
        stockPile.pop();
        card.isFaceUp = true;
        wastePile.push(card);
        updateStatus(`Drew ${card.rank} of ${card.suit} from stock.`);
        playSound('flip');
    } else if (wastePile.length > 0) {
        recordMove({
            type: 'reset-waste',
            movedCards: JSON.parse(JSON.stringify(wastePile)),
            source: {
                type: 'stock'
            },
            destination: {
                type: 'waste'
            }
        });
        stockPile = wastePile.reverse();
        stockPile.forEach(c => c.isFaceUp = false);
        wastePile = [];
        updateStatus("Reset waste pile to stock.");
        playSound('move');
    }
    saveGameState();
    updateDisplayWrapper();
}

function handleKeyDown(e) {
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
            handleStockClick();
            return;
        }

        const isCard = focusedElement.classList.contains('card');
        const isPile = focusedElement.classList.contains('card-pile');

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
                const pile = tableauPiles[pileIndex];
                cardIndex = pile.findIndex(c => c.isFaceUp && c.rank === cardRank && c.suit === cardSuit);
            } else if (pileId === 'waste-pile') {
                originPileType = 'waste';
                cardIndex = wastePile.length - 1;
            }

            const cardInfo = {
                originPileType,
                originPileIndex: pileIndex,
                originCardIndex: cardIndex,
                element: focusedElement
            };

            if (!selectedCard) {
                selectedCard = cardInfo;
                focusedElement.classList.add('focused');
                updateStatus(`Selected ${cardRank} of ${cardSuit}.`);
            } else {
                if (selectedCard.element === focusedElement) {
                    selectedCard = null;
                    focusedElement.classList.remove('focused');
                    updateStatus(`Deselected ${cardRank} of ${cardSuit}.`);
                } else {
                    const targetInfo = {
                        targetPile: pileId
                    };
                    attemptMoveWrapper(selectedCard, targetInfo);
                    selectedCard.element.classList.remove('focused');
                    selectedCard = null;
                }
            }
        } else if (isPile && selectedCard) {
            const targetInfo = {
                targetPile: focusedElement.id
            };
            attemptMoveWrapper(selectedCard, targetInfo);
            selectedCard.element.classList.remove('focused');
            selectedCard = null;
        }
    }
}

function startNewGame() {
    document.getElementById('win-modal').style.display = 'none';
    clearGameState();
    initGame();
    updateStatus("New game started.");
}

function initGame() {
    let deck = createDeck();
    shuffleDeck(deck);
    const dealt = dealCards(deck, tableauPiles);
    stockPile = dealt.stockPile;
    tableauPiles = dealt.tableauPiles;
    updateDisplayWrapper();
    saveGameState();
}

function updateDisplayWrapper() {
    const gameState = { stockPile, wastePile, foundationPiles, tableauPiles };
    const listeners = { addDropListeners, addDragListeners };
    updateDisplay(gameState, listeners);
}

function attemptMoveWrapper(draggedInfo, targetInfo) {
    const gameState = { stockPile, wastePile, foundationPiles, tableauPiles, moveHistory };
    const listeners = { addDropListeners, addDragListeners };
    const result = attemptMove(draggedInfo, targetInfo, gameState, listeners, recordMove, saveGameState, checkWinCondition, attemptAutoComplete);

    if (result.valid) {
        stockPile = result.state.stockPile;
        wastePile = result.state.wastePile;
        foundationPiles = result.state.foundationPiles;
        tableauPiles = result.state.tableauPiles;
        moveHistory = result.state.moveHistory;

        updateDisplayWrapper();
        saveGameState();
        playSound('move');
        updateStatus(result.message);

        // Check for win condition
        if (checkWinCondition(foundationPiles)) {
            handleWin(foundationPiles);
        } else {
            // Try auto-complete after successful move
            setTimeout(() => {
                attemptAutoComplete(tableauPiles, wastePile, foundationPiles, () => checkWinCondition(foundationPiles), saveGameState);
                updateDisplayWrapper();
                if (checkWinCondition(foundationPiles)) {
                    handleWin(foundationPiles);
                }
            }, 250);
        }
    } else {
        playSound('error');
        updateStatus(result.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!loadGameState()) {
        initGame();
    } else {
        updateDisplayWrapper();
    }
    addGameEventListeners();
});