import { CalculateBalance } from "../services/balance.service.js";
import { simplifyDebts } from "../services/settlement.services.js";

export const getSettlement=async(req,res)=>{
    const{groupId}=req.params;
    const balances=await CalculateBalance(groupId);
    const settlements=simplifyDebts(balances);

    res.json(settlements);
}