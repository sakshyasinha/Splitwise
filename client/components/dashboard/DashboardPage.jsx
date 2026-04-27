                                                                                                                                           
  import useAuth from '../../hooks/useAuth.js';                                                                                                
  import useExpenses from '../../hooks/useExpenses.js';
  import Button from '../ui/Button.jsx';
  import Card from '../ui/Card.jsx';
  import GroupForm from '../group/GroupForm.jsx';
  import ExpenseForm from '../expense/ExpenseForm.jsx';
  import ExpenseList from '../expense/ExpenseList.jsx';
  import AIChatPanel from '../chat/AIChatPanel.jsx';
  import { useEffect, useMemo, useState } from 'react'

  // Define the currency function
  const currency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getMemberLabel = (member, index) => {
    if (member && typeof member === 'object') {
      return member.name || member.email || `Member ${index + 1}`;
    }

    return `Member ${index + 1}`;
  };

  const DashboardPage = () => {
    const { logout } = useAuth();
    const { expenses, groups, myDues, totalOwed, fetchExpenses, fetchMyDues, fetchGroups } = useExpenses();
    const [selectedGroupId, setSelectedGroupId] = useState(null);

    useEffect(() => {
      fetchExpenses();
      fetchMyDues();
      fetchGroups();
    }, []);


    const totals = {
      groupCount: groups.length,
      expenseCount: expenses.length,
      totalSpend: expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    };

    const getDueGroupId = (due) => due.group?._id || due.group?.id || null;
    const getExpenseGroupId = (expense) => (typeof expense.group === 'object' ? expense.group?._id : expense.group);

    const groupSummaries = groups.length > 0 ? groups.map((group) => {
      const groupExpenses = expenses.filter((expense) => String(getExpenseGroupId(expense)) === String(group._id));

      const totalSpend = groupExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const dues = myDues.filter((due) => String(getDueGroupId(due)) === String(group._id));
      const myTotalDue = dues.reduce((sum, due) => sum + Number(due.amount || 0), 0);
      const totalDue = groupExpenses.reduce(
        (sum, expense) =>
          sum +
          (expense.participants || []).reduce(
            (pendingSum, participant) =>
              participant?.status === 'pending'
                ? pendingSum + Number(participant.amount || 0)
                : pendingSum,
            0
          ),
        0
      );
      const memberDues = dues.map((due) => ({ name: due.paidTo?.name || due.paidTo?.email, amount: due.amount }));

      return {
        ...group,
        totalSpend,
        totalDue,
        myTotalDue,
        memberDues,
      };
    }) : [];

    const selectedGroup = useMemo(
      () => groupSummaries.find((group) => String(group._id) === String(selectedGroupId)) || groupSummaries[0] || null,
      [groupSummaries, selectedGroupId]
    );

    const selectedGroupExpenses = selectedGroup
      ? expenses.filter((expense) => {
          const expenseGroupId = typeof expense.group === "object" ? expense.group._id : expense.group;
          return String(expenseGroupId) === String(selectedGroup._id);
        })
      : [];

    return (
      <main className="dashboard-layout">
        {/* Header */}
        <header className="topbar">
          <div className="topbar-brand">
            <div className="topbar-logo">SS</div>
            <div>
              <div className="topbar-title">SplitSense</div>
              <div className="topbar-sub">Money clarity for your group life</div>
            </div>
          </div>
          <Button variant="ghost" onClick={logout}>
            Sign out →
          </Button>
        </header>

        {/* Hero Strip */}
        <section className="hero-strip">
          <div>
            <h1>Your shared finances,&nbsp;at a glance.</h1>
            <p>Shared money is less stressful when everyone sees the same truth.</p>
          </div>
          <span className="due-pill">
            {myDues.length === 0 ? '✓ All dues settled' : `${myDues.length} pending due${myDues.length !== 1 ? 's' : ''}`}
          </span>
        </section>

        {/* Stat Cards */}
        <section className="stats-grid">
          <Card className="stat-violet">
            <div className="card-content">
              <div className="metric-icon">👥</div>
              <div className="metric-label">Groups</div>
              <div className="metric">{totals.groupCount}</div>
              <div className="metric-sub">Active shared circles</div>
            </div>
          </Card>
          <Card className="stat-green">
            <div className="card-content">
              <div className="metric-icon">🧾</div>
              <div className="metric-label">Expenses</div>
              <div className="metric">{totals.expenseCount}</div>
              <div className="metric-sub">Items this session</div>
            </div>
          </Card>
          <Card className="stat-red">
            <div className="card-content">
              <div className="metric-icon">⬆</div>
              <div className="metric-label">You Owe</div>
              <div className="metric">{currency(totalOwed)}</div>
              <div className="metric-sub">Pending dues</div>
            </div>
          </Card>
          <Card className="stat-amber">
            <div className="card-content">
              <div className="metric-icon">⬇</div>
              <div className="metric-label">Total Spend</div>
              <div className="metric">{currency(totals.totalSpend)}</div>
              <div className="metric-sub">Across all groups</div>
            </div>
          </Card>
        </section>

        {/* Main Content */}
        <section className="content-grid">
          <div className="left-column stack-lg">
            <GroupForm />
            <Card>
              <div className="card-header">
                <h2>Groups</h2>
                <p>Your active shared circles</p>
              </div>
              <div className="card-content">
                {groups.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">👥</div>
                    No groups yet. Create one to start splitting.
                  </div>
                ) : (
                  <div className="stack">
                    {groupSummaries.map((group) => (
                      <button
                        key={group._id}
                        type="button"
                        className="group-card"
                        onClick={() => setSelectedGroupId(group._id)}
                        style={{
                          flexDirection: "column",
                          alignItems: "flex-start",
                          width: "100%",
                          cursor: "pointer",
                          border: String(selectedGroup?._id) === String(group._id) ? '1px solid var(--primary)' : undefined,
                          boxShadow: String(selectedGroup?._id) === String(group._id) ? '0 0 0 3px rgba(74, 144, 226, 0.12)' : undefined,
                        }}
                      >
                        {/* Top Row */}
                        <div className="flex items-center gap-3 justify-between" style={{ width: "100%" }}>
                          <div className="flex items-center gap-3">
                            <div className="group-emoji">
                              {group.name?.[0]?.toUpperCase() || 'G'}
                            </div>
                            <div>
                              <div className="group-name">{group.name}</div>
                              <div className="group-meta">
                                {group.members?.length || 1} member{group.members?.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                          {/* Total Due */}
                          <div className="text-sm font-syne">
                            {group.myTotalDue > 0 ? (
                              <span style={{ color: 'var(--danger)' }}>
                                You owe {currency(group.myTotalDue)}
                              </span>
                            ) : group.totalDue > 0 ? (
                              <span style={{ color: 'var(--danger)' }}>
                                Outstanding {currency(group.totalDue)}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--success)' }}>
                                Settled
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Spend Info */}
                        <div className="mt-2 text-sm muted">
                          Total Spend: {currency(group.totalSpend)}
                        </div>
                        {/* Member Breakdown */}
                        {group.memberDues.length > 0 && (
                          <div className="mt-2 stack">
                            {group.memberDues.map((person, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span>{person.name}</span>
                                <span style={{ color: 'var(--danger)' }}>
                                  {currency(person.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
            <ExpenseForm />
            <ExpenseList />
          </div>
          <div className="right-column">
            <Card>
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <div>
                    <h2>Group Details</h2>
                    <p>{selectedGroup ? selectedGroup.name : 'Pick a group to inspect'}</p>
                  </div>
                  {selectedGroup && (
                    <span className={`badge ${selectedGroup.totalDue > 0 ? 'badge-red' : 'badge-green'}`}>
                      {selectedGroup.totalDue > 0 ? 'Pending' : 'Settled'}
                    </span>
                  )}
                </div>
              </div>
              <div className="card-content">
                {!selectedGroup ? (
                  <div className="empty-state">
                    <div className="empty-icon">👆</div>
                    Click a group on the left to view the breakdown.
                  </div>
                ) : (
                  <div className="stack-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="metric-label">Members</div>
                        <div className="metric">{selectedGroup.members?.length || 1}</div>
                      </div>
                      <div>
                        <div className="metric-label">Spend</div>
                        <div className="metric">{currency(selectedGroup.totalSpend)}</div>
                      </div>
                    </div>

                    <div>
                      <div className="metric-label" style={{ marginBottom: 8 }}>Member names</div>
                      <div className="stack">
                        {(selectedGroup.members || []).length === 0 ? (
                          <div className="text-sm muted">No members found for this group.</div>
                        ) : (
                          (selectedGroup.members || []).map((member, index) => (
                            <div key={member?._id || member?.id || String(member) || index} className="text-sm">
                              {getMemberLabel(member, index)}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="metric-label" style={{ marginBottom: 8 }}>Outstanding</div>
                      <div className="metric" style={{ color: selectedGroup.totalDue > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {selectedGroup.totalDue > 0 ? currency(selectedGroup.totalDue) : 'Settled'}
                      </div>
                    </div>

                    <div>
                      <div className="metric-label" style={{ marginBottom: 8 }}>Recent expenses</div>
                      {selectedGroupExpenses.length === 0 ? (
                        <div className="empty-state" style={{ marginTop: 8 }}>
                          <div className="empty-icon">🧾</div>
                          No expenses in this group yet.
                        </div>
                      ) : (
                        <div className="stack">
                          {selectedGroupExpenses.slice(0, 5).map((expense) => (
                            <div key={expense._id} className="flex items-center justify-between text-sm">
                              <span>{expense.description}</span>
                              <span>{currency(expense.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
            {/* MY DUES */}
            <Card>
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <div>
                    <h2>My Dues</h2>
                    <p>What you need to pay</p>
                  </div>
                  <span className={`badge ${myDues.length === 0 ? 'badge-green' : 'badge-red'}`}>
                    {myDues.length === 0 ? 'Settled' : `${myDues.length} pending`}
                  </span>
                </div>
              </div>
              <div className="card-content">
                {myDues.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">✅</div>
                    You're all clear — no pending dues.
                  </div>
                ) : (
                  <ul className="expense-list">
                    {myDues.map((due) => (
                      <li key={due.expenseId} className="expense-item">
                        <div className="due-avatar" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>
                          {(due.paidTo?.name || due.paidTo?.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="expense-info">
                          <div className="expense-title">{due.description}</div>
                          <div className="expense-meta">
                            Pay → {due.paidTo?.name || due.paidTo?.email}
                            {due.group?.name ? ` · ${due.group.name}` : ''}
                          </div>
                        </div>
                        <div>
                          <div className="expense-amount debit">{currency(due.amount)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
            {/* AI ASSISTANT */}
            <AIChatPanel />
          </div>
        </section>
      </main>
    );
  };

  export default DashboardPage;
  