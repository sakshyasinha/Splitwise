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

        // For regular expenses, derive each participant's net amount directly.
        participants.forEach(({ userId, paidAmount, shareAmount, amount: participantAmount })=>{
            const participantId = userId?.toString();
            const shareValue = Number(shareAmount ?? participantAmount ?? 0);
            const paidValue = Number(paidAmount || 0);
            const participantNet = paidValue - shareValue;
            balances[participantId] = (balances[participantId] || 0) + participantNet;
        });
    }
    return balances;
};