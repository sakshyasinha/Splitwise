import { useEffect } from "react";
import useExpenses from "../../hooks/useExpenses.js";
import Card from "../ui/Card.jsx";

function formatAmount(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value || 0));
}

export default function ExpenseList() {
  const { expenses = [], loading, error, fetchExpenses } = useExpenses();

  // Fetch on mount (IMPORTANT)
  useEffect(() => {
    fetchExpenses();
    console.log("fetchExpenses:", fetchExpenses);
  }, [fetchExpenses]);

  return (
    <Card title="Recent Expenses" subtitle="Latest activity in this session">
      {loading && <p className="muted">Loading expenses...</p>}

      {error && <p className="error">{error}</p>}

      {!loading && expenses.length === 0 && (
        <p className="muted">No expenses yet. Add your first one above.</p>
      )}

      {!loading && expenses.length > 0 && (
        <ul className="expense-list">
          {expenses.map((expense) => (
            <li key={expense._id} className="expense-item">
              <div>
                <p className="expense-title">
                  {expense.description || "Untitled expense"}
                </p>
                <p className="muted">
                  Group:{" "}
                  {expense.group?.name ||
                    expense.groupId ||
                    "n/a"}
                </p>
              </div>
              <p className="expense-amount">
                {formatAmount(expense.amount)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}