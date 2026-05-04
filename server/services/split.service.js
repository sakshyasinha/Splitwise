/**
 * Advanced Split Calculation Service
 * Handles all split types: equal, percentage, shares, itemized, custom
 */

/**
 * Equal Split - Divide amount equally among all participants
 * @param {number} totalAmount - Total amount to split
 * @param {string[]} participantIds - Array of participant user IDs
 * @returns {Array} Array of {userId, amount} objects
 */
export const splitEqual = (totalAmount, participantIds) => {
    if (!participantIds || participantIds.length === 0) {
        throw new Error('At least one participant is required for equal split');
    }

    const share = totalAmount / participantIds.length;

    // Handle rounding by distributing remainder
    const roundedShare = Math.floor(share * 100) / 100; // Round to 2 decimal places
    const remainder = totalAmount - (roundedShare * participantIds.length);

    return participantIds.map((userId, index) => {
        // Add remainder to first participant to handle rounding
        const amount = index === 0 ? roundedShare + remainder : roundedShare;
        return {
            userId,
            amount: Math.round(amount * 100) / 100 // Ensure 2 decimal places
        };
    });
};

/**
 * Percentage Split - Divide amount based on specified percentages
 * @param {number} totalAmount - Total amount to split
 * @param {string[]} participantIds - Array of participant user IDs
 * @param {Map<string, number>} percentages - Map of userId -> percentage (0-100)
 * @returns {Array} Array of {userId, amount} objects
 */
export const splitPercentage = (totalAmount, participantIds, percentages) => {
    if (!percentages || percentages.size === 0) {
        throw new Error('Percentages map is required for percentage split');
    }

    // Validate percentages sum to 100
    const totalPercentage = Array.from(percentages.values())
        .reduce((sum, val) => sum + val, 0);

    if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new Error(`Percentages must sum to 100%, got ${totalPercentage}%`);
    }

    return participantIds.map(userId => {
        const percentage = percentages.get(userId) || 0;
        const amount = (totalAmount * percentage) / 100;
        return {
            userId,
            amount: Math.round(amount * 100) / 100
        };
    });
};

/**
 * Shares Split - Divide amount based on share counts
 * @param {number} totalAmount - Total amount to split
 * @param {string[]} participantIds - Array of participant user IDs
 * @param {Map<string, number>} shares - Map of userId -> share count
 * @returns {Array} Array of {userId, amount} objects
 */
export const splitShares = (totalAmount, participantIds, shares) => {
    if (!shares || shares.size === 0) {
        throw new Error('Shares map is required for shares split');
    }

    // Calculate total shares
    const totalShares = Array.from(shares.values())
        .reduce((sum, val) => sum + val, 0);

    if (totalShares === 0) {
        throw new Error('Total shares must be greater than 0');
    }

    // Calculate value per share
    const valuePerShare = totalAmount / totalShares;

    return participantIds.map(userId => {
        const shareCount = shares.get(userId) || 0;
        const amount = shareCount * valuePerShare;
        return {
            userId,
            amount: Math.round(amount * 100) / 100
        };
    });
};

/**
 * Itemized Split - Divide amount based on specific items
 * @param {number} totalAmount - Total amount to split
 * @param {string[]} participantIds - Array of participant user IDs
 * @param {Array} items - Array of {name, amount, assignedTo: [userIds]}
 * @returns {Array} Array of {userId, amount} objects
 */
export const splitItemized = (totalAmount, participantIds, items) => {
    if (!items || items.length === 0) {
        throw new Error('Items array is required for itemized split');
    }

    // Initialize amounts for each participant
    const participantAmounts = new Map(
        participantIds.map(id => [id, 0])
    );

    // Calculate each participant's share based on items
    items.forEach(item => {
        const itemAmount = Number(item.amount) || 0;
        const assignedTo = item.assignedTo || [];

        if (assignedTo.length === 0) {
            // If no one is assigned, split equally among all participants
            const share = itemAmount / participantIds.length;
            participantIds.forEach(userId => {
                participantAmounts.set(
                    userId,
                    (participantAmounts.get(userId) || 0) + share
                );
            });
        } else {
            // Split among assigned participants
            const share = itemAmount / assignedTo.length;
            assignedTo.forEach(userId => {
                participantAmounts.set(
                    userId,
                    (participantAmounts.get(userId) || 0) + share
                );
            });
        }
    });

    // Validate total matches expected amount
    const calculatedTotal = Array.from(participantAmounts.values())
        .reduce((sum, val) => sum + val, 0);

    if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
        console.warn(`Itemized split total (${calculatedTotal}) differs from expense amount (${totalAmount})`);
    }

    return Array.from(participantAmounts.entries()).map(([userId, amount]) => ({
        userId,
        amount: Math.round(amount * 100) / 100
    }));
};

/**
 * Custom Split - Use exact amounts specified for each participant
 * @param {number} totalAmount - Total amount to split
 * @param {string[]} participantIds - Array of participant user IDs
 * @param {Map<string, number>} customAmounts - Map of userId -> exact amount
 * @returns {Array} Array of {userId, amount} objects
 */
export const splitCustom = (totalAmount, participantIds, customAmounts) => {
    if (!customAmounts || customAmounts.size === 0) {
        throw new Error('Custom amounts map is required for custom split');
    }

    // Validate custom amounts sum to total
    const customTotal = Array.from(customAmounts.values())
        .reduce((sum, val) => sum + Number(val), 0);

    if (Math.abs(customTotal - totalAmount) > 0.01) {
        throw new Error(`Custom amounts (${customTotal}) must sum to total amount (${totalAmount})`);
    }

    return participantIds.map(userId => {
        const amount = customAmounts.get(userId) || 0;
        return {
            userId,
            amount: Math.round(amount * 100) / 100
        };
    });
};

/**
 * Payment Split - Direct payment from payer to recipient
 * The recipient owes the full amount to the payer
 * @param {number} totalAmount - Total amount paid
 * @param {string[]} participantIds - Array of participant user IDs [payerId, recipientId]
 * @returns {Array} Array of {userId, amount} objects
 */
export const splitPayment = (totalAmount, participantIds) => {
    if (!participantIds || participantIds.length !== 2) {
        throw new Error('Payment split requires exactly 2 participants (payer and recipient)');
    }

    const [payerId, recipientId] = participantIds;

    return [
        {
            userId: payerId,
            amount: 0 // Payer doesn't owe anything, they paid
        },
        {
            userId: recipientId,
            amount: totalAmount // Recipient owes the full amount
        }
    ];
};

/**
 * Adjustment Split - Add adjustments to base equal split
 * Useful for adding tips, taxes, or adjustments to specific users
 * @param {number} totalAmount - Total amount to split
 * @param {string[]} participantIds - Array of participant user IDs
 * @param {Map<string, number>} adjustments - Map of userId -> adjustment amount
 * @returns {Array} Array of {userId, amount} objects
 */
export const splitAdjustment = (totalAmount, participantIds, adjustments) => {
    if (!adjustments || adjustments.size === 0) {
        // If no adjustments, fall back to equal split
        return splitEqual(totalAmount, participantIds);
    }

    // Calculate total adjustments
    const totalAdjustments = Array.from(adjustments.values())
        .reduce((sum, val) => sum + Number(val), 0);

    // Calculate base amount (total minus adjustments)
    const baseAmount = totalAmount - totalAdjustments;

    // Get equal split of base amount
    const baseSplits = splitEqual(baseAmount, participantIds);

    // Apply adjustments
    return baseSplits.map(split => {
        const adjustment = adjustments.get(split.userId) || 0;
        return {
            userId: split.userId,
            amount: Math.round((split.amount + adjustment) * 100) / 100
        };
    });
};

/**
 * Validate split configuration
 * @param {string} splitType - Type of split
 * @param {object} splitDetails - Split details object
 * @param {number} totalAmount - Total amount
 * @param {string[]} participantIds - Participant IDs
 * @returns {object} Validation result {valid: boolean, error: string}
 */
export const validateSplit = (splitType, splitDetails, totalAmount, participantIds) => {
    if (!splitType) {
        return { valid: false, error: 'Split type is required' };
    }

    if (!participantIds || participantIds.length === 0) {
        return { valid: false, error: 'At least one participant is required' };
    }

    if (totalAmount <= 0) {
        return { valid: false, error: 'Total amount must be greater than 0' };
    }

    try {
        switch (splitType) {
            case 'equal':
                // No additional validation needed
                break;

            case 'percentage':
                if (!splitDetails.percentages) {
                    return { valid: false, error: 'Percentages are required for percentage split' };
                }
                const totalPercentage = Array.from(splitDetails.percentages.values())
                    .reduce((sum, val) => sum + val, 0);
                if (Math.abs(totalPercentage - 100) > 0.01) {
                    return { valid: false, error: `Percentages must sum to 100%, got ${totalPercentage}%` };
                }
                break;

            case 'shares':
                if (!splitDetails.shares) {
                    return { valid: false, error: 'Shares are required for shares split' };
                }
                const totalShares = Array.from(splitDetails.shares.values())
                    .reduce((sum, val) => sum + val, 0);
                if (totalShares <= 0) {
                    return { valid: false, error: 'Total shares must be greater than 0' };
                }
                break;

            case 'itemized':
                if (!splitDetails.items || splitDetails.items.length === 0) {
                    return { valid: false, error: 'Items are required for itemized split' };
                }
                break;

            case 'custom':
                if (!splitDetails.customAmounts) {
                    return { valid: false, error: 'Custom amounts are required for custom split' };
                }
                const customTotal = Array.from(splitDetails.customAmounts.values())
                    .reduce((sum, val) => sum + Number(val), 0);
                if (Math.abs(customTotal - totalAmount) > 0.01) {
                    return { valid: false, error: `Custom amounts must sum to total amount` };
                }
                break;

            case 'payment':
                // Payment requires exactly 2 participants
                if (participantIds.length !== 2) {
                    return { valid: false, error: 'Payment requires exactly 2 participants (payer and recipient)' };
                }
                // No additional validation needed for payment
                break;

            default:
                return { valid: false, error: `Invalid split type: ${splitType}` };
        }

        return { valid: true, error: null };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

export default {
    splitEqual,
    splitPercentage,
    splitShares,
    splitItemized,
    splitCustom,
    splitPayment,
    splitAdjustment,
    validateSplit
};
