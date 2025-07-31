import { playSound, updateDisplay, updateStatus } from './ui.js';

/**
 * Represents a single playing card.
 * @param {string} suit - The suit of the card (e.g., 'hearts', 'diamonds').
 * @param {string} rank - The rank of the card (e.g., 'A', '2', 'K').
 */
export class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.isFaceUp = false;
    }
}

/**
 * Creates a standard 52-card deck.
 * @returns {Card[]} An array of Card objects.
 */
export function createDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push(new Card(suit, rank));
        }
    }
    return deck;
}

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param {Array} deck - The array to shuffle.
 */
export function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

/**
 * Deals cards to the tableau and stock piles.
 * @param {Card[]} deck - The shuffled deck of cards.
 * @param {Card[][]} tableauPiles - The tableau piles.
 * @returns {{stockPile: Card[], tableauPiles: Card[][]}}
 */
export function dealCards(deck, tableauPiles) {
    // Deal cards to the tableau piles
    for (let i = 0; i < 7; i++) {
        for (let j = i; j < 7; j++) {
            tableauPiles[j].push(deck.pop());
        }
    }

    // Set the top card of each tableau pile to be face up
    tableauPiles.forEach(pile => {
        if (pile.length > 0) {
            pile[pile.length - 1].isFaceUp = true;
        }
    });

    // The rest of the deck becomes the stock pile
    return { stockPile: deck, tableauPiles };
}

/**
 * Checks if the game has been won (all cards on foundation).
 * @param {Card[][]} foundationPiles
 * @returns {boolean}
 */
export function checkWinCondition(foundationPiles) {
    const foundationCardCount = foundationPiles.reduce((sum, pile) => sum + pile.length, 0);
    return foundationCardCount === 52;
}

/**
 * Checks if a proposed move is valid according to Klondike rules.
 * @param {Card[]} draggedCards - The card or stack of cards being moved.
 * @param {string} targetPileId - The ID of the target pile.
 * @param {Card[][]} foundationPiles
 * @param {Card[][]} tableauPiles
 * @returns {boolean} True if the move is valid, false otherwise.
 */
export function isValidMove(draggedCards, targetPileId, foundationPiles, tableauPiles) {
    if (!draggedCards || draggedCards.length === 0) return false;

    const draggedCard = draggedCards[0];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const getRankIndex = (rank) => ranks.indexOf(rank);
    const isRed = (suit) => suit === 'hearts' || suit === 'diamonds';

    // Move to Foundation
    if (targetPileId.startsWith('foundation-')) {
        if (draggedCards.length > 1) return false; // Only single cards to foundation

        const pileIndex = parseInt(targetPileId.split('-')[2]);
        const foundationPile = foundationPiles[pileIndex];
        const topCard = foundationPile.length > 0 ? foundationPile[foundationPile.length - 1] : null;

        if (topCard) {
            // Must be same suit and next rank
            return draggedCard.suit === topCard.suit && getRankIndex(draggedCard.rank) === getRankIndex(topCard.rank) + 1;
        } else {
            // Can only start with an Ace
            return draggedCard.rank === 'A';
        }
    }

    // Move to Tableau
    if (targetPileId.startsWith('tableau-')) {
        const pileIndex = parseInt(targetPileId.split('-')[2]);
        const tableauPile = tableauPiles[pileIndex];
        const topCard = tableauPile.length > 0 ? tableauPile[tableauPile.length - 1] : null;

        if (topCard) {
            // Must be alternating color and descending rank
            return isRed(draggedCard.suit) !== isRed(topCard.suit) && getRankIndex(topCard.rank) === getRankIndex(draggedCard.rank) + 1;
        } else {
            // Can only place a King on an empty tableau pile
            return draggedCard.rank === 'K';
        }
    }

    return false;
}

/**
 * Executes a move by transferring cards between piles.
 * @param {object} draggedInfo - Information about the dragged card(s).
 * @param {string} targetPileId - The ID of the target pile.
 * @param {Card[][]} tableauPiles
 * @param {Card[]} wastePile
 * @param {Card[][]} foundationPiles
         */
export function executeMove(draggedInfo, targetPileId, tableauPiles, wastePile, foundationPiles) {
    const { originPileType, originPileIndex, originCardIndex } = draggedInfo;
    let draggedCards = [];

    // Remove card(s) from source pile
    if (originPileType === 'tableau') {
        const sourcePile = tableauPiles[originPileIndex];
        draggedCards = sourcePile.splice(originCardIndex);
    } else if (originPileType === 'waste') {
        draggedCards.push(wastePile.pop());
    }

    // Add card(s) to target pile
    if (targetPileId.startsWith('foundation-')) {
        const pileIndex = parseInt(targetPileId.split('-')[2]);
        foundationPiles[pileIndex].push(...draggedCards);
    } else if (targetPileId.startsWith('tableau-')) {
        const pileIndex = parseInt(targetPileId.split('-')[2]);
        tableauPiles[pileIndex].push(...draggedCards);
    }

    // Flip exposed card in source tableau pile
    if (originPileType === 'tableau') {
        const sourcePile = tableauPiles[originPileIndex];
        if (sourcePile.length > 0 && !sourcePile[sourcePile.length - 1].isFaceUp) {
            sourcePile[sourcePile.length - 1].isFaceUp = true;
            playSound('flip');
        }
    }
}

/**
 * Checks if a card can be automatically moved to a foundation pile.
 * @param {Card} card - The card to check.
 * @param {Card[][]} foundationPiles
 * @returns {number|null} The index of the foundation pile if movable, otherwise null.
 */
export function canAutoMoveToFoundation(card, foundationPiles) {
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const getRankIndex = (rank) => ranks.indexOf(rank);

    // First, check for a foundation pile with the same suit
    for (let i = 0; i < 4; i++) {
        const foundationPile = foundationPiles[i];
        if (foundationPile.length > 0 && foundationPile[0].suit === card.suit) {
            const topCard = foundationPile[foundationPile.length - 1];
            if (getRankIndex(card.rank) === getRankIndex(topCard.rank) + 1) {
                return i;
            }
            // Card of this suit is on a foundation, but this card is not next.
            // No other foundation will accept this suit.
            return null;
        }
    }

    // If no foundation with this suit exists, check for an empty one if the card is an Ace
    if (card.rank === 'A') {
        for (let i = 0; i < 4; i++) {
            if (foundationPiles[i].length === 0) {
                return i;
            }
        }
    }

    return null;
}

/**
 * Attempts to automatically move cards to the foundation piles.
 * @param {Card[][]} tableauPiles
 * @param {Card[]} wastePile
 * @param {Card[][]} foundationPiles
 * @param {function} checkWinCondition
 * @param {function} saveGameState
         */
export function attemptAutoComplete(tableauPiles, wastePile, foundationPiles, checkWinCondition, saveGameState) {
    const allTableauCardsVisible = tableauPiles.every(pile => pile.every(card => card.isFaceUp));
    if (!allTableauCardsVisible) {
        return;
    }

    let cardMoved;
    do {
        cardMoved = false;

        // Prioritize moving from tableau piles
        for (let i = 0; i < 7; i++) {
            const pile = tableauPiles[i];
            if (pile.length > 0) {
                const topCard = pile[pile.length - 1];
                const foundationIndex = canAutoMoveToFoundation(topCard, foundationPiles);
                if (foundationIndex !== null) {
                    const draggedInfo = {
                        originPileType: 'tableau',
                        originPileIndex: i,
                        originCardIndex: pile.length - 1,
                    };
                    executeMove(draggedInfo, `foundation-pile-${foundationIndex}`, tableauPiles, wastePile, foundationPiles);
                    cardMoved = true;
                    // Break and restart scan to re-evaluate priorities
                    break;
                }
            }
        }

        if (cardMoved) {
            continue;
        }

        // Then check waste pile
        if (wastePile.length > 0) {
            const topCard = wastePile[wastePile.length - 1];
            const foundationIndex = canAutoMoveToFoundation(topCard, foundationPiles);
            if (foundationIndex !== null) {
                const draggedInfo = {
                    originPileType: 'waste',
                    originPileIndex: -1, // Not applicable
                    originCardIndex: wastePile.length - 1,
                };
                executeMove(draggedInfo, `foundation-pile-${foundationIndex}`, tableauPiles, wastePile, foundationPiles);
                cardMoved = true;
            }
        }

    } while (cardMoved);
    if (checkWinCondition) checkWinCondition();
    if (saveGameState) saveGameState();
}

/**
 * Attempts to move a card or a stack of cards.
 * @param {object} draggedInfo - Information about the dragged card(s).
 * @param {object} targetInfo - Information about the drop target.
 * @param {object} gameState - The current game state.
 * @param {object} listeners - Event listener functions from ui.js
 * @param {function} recordMove
 * @param {function} saveGameState
 * @param {function} checkWinCondition
 * @param {function} attemptAutoComplete
         */
export function attemptMove(draggedInfo, targetInfo, gameState, listeners, recordMove, saveGameState, checkWinCondition, attemptAutoComplete) {
    const { originPileType, originPileIndex, originCardIndex } = draggedInfo;
    const { targetPile } = targetInfo;
    const { tableauPiles, wastePile, foundationPiles, moveHistory } = gameState;
    let draggedCards = [];

    if (originPileType === 'tableau') {
        const pile = tableauPiles[originPileIndex];
        draggedCards = pile.slice(originCardIndex);
    } else if (originPileType === 'waste') {
        if (wastePile.length > 0) {
            draggedCards = [wastePile[wastePile.length - 1]];
        }
    }

    const isValid = isValidMove(draggedCards, targetPile, foundationPiles, tableauPiles);

    if (isValid) {
        const sourcePileType = originPileType;
        const sourcePileIndex = originPileIndex;
        const targetPileType = targetPile.split('-')[0];
        const targetPileIndex = parseInt(targetPile.split('-')[2]);

        const sourcePileBeforeMove = getPile(sourcePileType, sourcePileIndex, gameState);
        const wasCardFlipped = sourcePileType === 'tableau' && sourcePileBeforeMove.length > draggedCards.length && !sourcePileBeforeMove[sourcePileBeforeMove.length - draggedCards.length - 1].isFaceUp;

        if (recordMove) recordMove({
            type: `${sourcePileType}-to-${targetPileType}`,
            movedCards: JSON.parse(JSON.stringify(draggedCards)),
            source: {
                type: sourcePileType,
                index: sourcePileIndex
            },
            destination: {
                type: targetPileType,
                index: targetPileIndex
            },
            flippedCard: wasCardFlipped
        });

        executeMove(draggedInfo, targetPile, tableauPiles, wastePile, foundationPiles);
        const cardName = `${draggedCards[0].rank} of ${draggedCards[0].suit}`;
        const pileName = document.getElementById(targetPile)?.getAttribute('aria-label') || targetPile;

        return {
            valid: true,
            state: { stockPile: gameState.stockPile, wastePile, foundationPiles, tableauPiles, moveHistory },
            message: `Moved ${cardName} to ${pileName}.`
        };
    } else {
        return {
            valid: false,
            state: gameState,
            message: "Invalid move."
        };
    }
}

function getPile(type, index, gameState) {
    const { tableauPiles, foundationPiles, wastePile, stockPile } = gameState;
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