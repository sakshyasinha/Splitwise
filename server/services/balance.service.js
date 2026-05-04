import Expense from '../models/expense.model.js';

export const CalculateBalance=async(groupId)=>{
    const expenses=await Expense.find({ group: groupId });

    const balances={};

    for(const expense of expenses){
        const { paidBy, amount, participants, splitType }=expense;
        const payerId = paidBy?.toString();

        // For regular expenses, add the full amount to the payer's balance
        // For payment expenses, the balance is already calculated in participants
        if (splitType !== 'payment') {
            balances[payerId]=(balances[payerId] || 0) + Number(amount || 0);
        }

        participants.forEach(({ userId, balance: participantBalance })=>{
            const participantId = userId?.toString();
            // For payment expenses, use the pre-calculated balance field
            // For regular expenses, subtract the share amount
            if (splitType === 'payment') {
                const balance = Number(participantBalance) || 0;
                balances[participantId] = (balances[participantId] || 0) + balance;
            } else {
                const shareAmount = Number(participantBalance) || 0;
                balances[participantId] = (balances[participantId] || 0) + shareAmount;
            }
        });
    }
    return balances;
};