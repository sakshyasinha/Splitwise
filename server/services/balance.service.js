import Expense from '../models/expense.model.js';

export const CalculateBalance=async(groupId)=>{
    const expenses=await Expense.find({ group: groupId });

    const balances={};

    for(const expense of expenses){
        const { paidBy, amount, participants, splitType }=expense;
        const payerId = paidBy?.toString();
        const totalAmount = Number(amount || 0);

        // For payment expenses, derive balances from payer/recipient roles directly.
        if (splitType === 'payment') {
            participants.forEach(({ userId }) => {
                const participantId = userId?.toString();
                if (!participantId) return;

                if (participantId === payerId) {
                    balances[participantId] = (balances[participantId] || 0) + totalAmount;
                } else {
                    balances[participantId] = (balances[participantId] || 0) - totalAmount;
                }
            });
            continue;
        }

        // For regular expenses, add the full amount to the payer's balance.
        balances[payerId]=(balances[payerId] || 0) + totalAmount;

        participants.forEach(({ userId, balance: participantBalance })=>{
            const participantId = userId?.toString();
            const shareAmount = Number(participantBalance) || 0;
            balances[participantId] = (balances[participantId] || 0) + shareAmount;
        });
    }
    return balances;
};