import assert from 'node:assert/strict';
import { buildNormalizedUserLedger, summarizeUserLedgerRows } from '../services/expense.service.js';

describe('Normalized ledger integrity', () => {
  const expense = {
    _id: 'exp-1',
    description: 'Shared dinner',
    amount: 1000,
    splitType: 'equal',
    paidBy: 'user-a',
    createdBy: 'user-a',
    group: { _id: 'group-1', name: 'Trip' },
    participants: [
      { userId: 'user-a', paidAmount: 1000, shareAmount: 500, balance: 500, status: 'settled' },
      { userId: 'user-b', paidAmount: 0, shareAmount: 500, balance: -500, status: 'pending' },
    ],
    isDeleted: false,
  };

  const settlement = {
    _id: 'exp-2',
    description: 'Debt settlement',
    amount: 500,
    splitType: 'payment',
    paidBy: 'user-b',
    createdBy: 'user-b',
    group: null,
    participants: [
      { userId: 'user-b', paidAmount: 500, shareAmount: 0, balance: 500, status: 'settled' },
      { userId: 'user-a', paidAmount: 0, shareAmount: 500, balance: -500, status: 'pending' },
    ],
    isDeleted: false,
  };

  const settledExpense = {
    _id: 'exp-3',
    description: 'Settled lunch',
    amount: 300,
    splitType: 'equal',
    paidBy: 'user-a',
    createdBy: 'user-a',
    group: { _id: 'group-1', name: 'Trip' },
    participants: [
      { userId: 'user-a', paidAmount: 300, shareAmount: 150, balance: 150, status: 'settled' },
      { userId: 'user-b', paidAmount: 0, shareAmount: 150, balance: -150, status: 'settled' },
    ],
    isSettled: true,
    isDeleted: false,
  };

  it('excludes settlement and settled rows from the normalized ledger', () => {
    const rows = buildNormalizedUserLedger([expense, settlement, settledExpense], 'user-b');

    assert.equal(rows.length, 1);
    assert.equal(rows[0].transactionId, 'exp-1');
    assert.equal(rows[0].direction, 'liability');
    assert.equal(rows[0].amount, 500);
  });

  it('keeps dashboard totals in sync with detailed rows', () => {
    const rows = buildNormalizedUserLedger([expense], 'user-b');
    const summary = summarizeUserLedgerRows(rows);

    assert.equal(summary.totalOwed, 500);
    assert.equal(summary.totalToReceive, 0);
    assert.equal(summary.totalBalance, -500);
  });

  it('mirrors balances across both sides of the same expense', () => {
    const userARows = buildNormalizedUserLedger([expense], 'user-a');
    const userBRows = buildNormalizedUserLedger([expense], 'user-b');

    const userASummary = summarizeUserLedgerRows(userARows);
    const userBSummary = summarizeUserLedgerRows(userBRows);

    assert.equal(userASummary.totalBalance + userBSummary.totalBalance, 0);
    assert.equal(userASummary.totalToReceive, userBSummary.totalOwed);
    assert.equal(userASummary.totalOwed, userBSummary.totalToReceive);
  });

  it('treats the payer as creditor and the other participant as debtor', () => {
    const userARows = buildNormalizedUserLedger([expense], 'user-a');
    const userBRows = buildNormalizedUserLedger([expense], 'user-b');

    const userASummary = summarizeUserLedgerRows(userARows);
    const userBSummary = summarizeUserLedgerRows(userBRows);

    assert.equal(userASummary.totalOwed, 0);
    assert.equal(userASummary.totalToReceive, 500);
    assert.equal(userBSummary.totalOwed, 500);
    assert.equal(userBSummary.totalToReceive, 0);
    assert.equal(userBSummary.totalBalance, -500);
  });
});
