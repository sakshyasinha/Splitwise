import Expense from '../models/expense.model.js';

export const CalculateBalance=async(groupId)=>{
    const expenses=await Expense.find({ group: groupId });

    const balances={};

    for(const expense of expenses){
        const { paidBy, amount, participants }=expense;
        const payerId = paidBy?.toString();

        balances[payerId]=(balances[payerId] || 0) + Number(amount || 0);

        participants.forEach(({ userId, amount: shareAmount })=>{
            const participantId = userId?.toString();
            balances[participantId] = (balances[participantId] || 0) - Number(shareAmount || 0);
        });
    }
    return balances;
};