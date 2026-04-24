export const simplifyDebts=(balances)=>{
    const creditors=[];
    const debtors=[];

    for(const user in balances){
        const amount=balances[user];

        if (amount>0){
            creditors.push({user,amount});
        }
        else if(amount<0){
            debtors.push({user,amount:-amount});
        }
    }
    const transactions=[];

    let i=0,j=0;

    while(i<creditors.length && j<debtors.length){
        const creditor=creditors[i];
        const debtor=debtors[j];

        const settledAmount=Math.min(creditor.amount,debtor.amount);

        transactions.push({
            from:debtor.user,
            to:creditor.user,
            amount:settledAmount,
        });
        creditor.amount-=settledAmount;
        debtor.amount-=settledAmount;
        if(creditor.amount===0){
            i++;
        }
        if(debtor.amount===0){
            j++;
        }
    }
    return transactions;
}