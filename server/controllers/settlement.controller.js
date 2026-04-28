import { CalculateBalance } from "../services/balance.service.js";
import { simplifyDebts } from "../services/settlement.services.js";
import Settlement from "../models/settlement.model.js";

export const getSettlement=async(req,res)=>{
    const{groupId}=req.params;
    const balances=await CalculateBalance(groupId);
    const settlements=simplifyDebts(balances);

    res.json(settlements);
};

export const recordSettlement = async (req, res) => {
  try {
    const { expenseId, to, amount, description } = req.body;
    const from = req.user?.id || req.body.userId;

    if (!expenseId || !to || !amount) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const settlement = await Settlement.create({
      expenseId,
      from,
      to,
      amount,
      description,
    });

    await settlement.populate('from', 'name email');
    await settlement.populate('to', 'name email');

    res.status(201).json(settlement);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

export const getSettlementHistory = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;

    const settlements = await Settlement.find({
      $or: [{ from: userId }, { to: userId }],
    })
      .sort({ settledAt: -1 })
      .populate('from', 'name email')
      .populate('to', 'name email')
      .populate('expenseId', 'description amount date');

    res.status(200).json(settlements);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};