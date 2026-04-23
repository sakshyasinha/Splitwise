export const splitEqual=(amount, participants)=>{
    const share = amount / participants.length;
    return participants.map(participant=>({
        userId:participant,
        amount:share,
    }));
};