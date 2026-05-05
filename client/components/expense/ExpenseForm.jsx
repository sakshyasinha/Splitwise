import { useMemo, useState, useEffect } from "react";
import useExpenses from "../../hooks/useExpenses.js";
import useToast from "../../hooks/useToast.js";
import useAuth from "../../hooks/useAuth.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import { isValidEmail } from "../../utils/validation.js";
import { getCategoryEmoji } from "../../utils/categoryUtils.js";
import { createSettlement } from "../../services/settlement.service.js";

const CATEGORIES = [
  { label: "Food" },
  { label: "Travel" },
  { label: "Events" },
  { label: "Utilities" },
  { label: "Shopping" },
];

export default function ExpenseForm({ onSuccess, editingExpense = null }) {
  const { addExpense, groups, expenses, loading, error, clearError, updateExpense, fetchExpenses } = useExpenses();
  const { user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState("expense"); // 'expense' or 'payment'

  const [form, setForm] = useState({
    description: "",
    amount: "",
    groupId: "",
    friendEmail: "",
  });

  const [selectedCategory, setSelectedCategory] = useState("");
  const [paidByEmail, setPaidByEmail] = useState("");
  const [participantInput, setParticipantInput] = useState("");
  const [participants, setParticipants] = useState([]);
  const [paymentFriends, setPaymentFriends] = useState([]); // For multiple friends in payment
  const [paymentPaidByEmail, setPaymentPaidByEmail] = useState("");
  const [paymentFriendInput, setPaymentFriendInput] = useState("");
  const [paymentSplitType, setPaymentSplitType] = useState("equal"); // Split type for payments
  const [paymentSplitDetails, setPaymentSplitDetails] = useState({}); // Store split details per friend
  const [expenseSplitType, setExpenseSplitType] = useState("equal"); // Split type for expenses
  const [expenseSplitDetails, setExpenseSplitDetails] = useState({}); // Store split details per participant
  const [items, setItems] = useState([]); // For itemized split
  const [adjustments, setAdjustments] = useState({}); // For adjustment split
  const [localError, setLocalError] = useState("");
  const [touched, setTouched] = useState({
    description: false,
    amount: false,
    groupId: false,
  });

  const currentUserEmail = user?.email?.toLowerCase();
  const isEditing = !!editingExpense;
  const isPayment = activeTab === "payment";

  useEffect(() => {
    if (!paidByEmail && currentUserEmail) {
      setPaidByEmail(currentUserEmail);
    }
  }, [currentUserEmail, paidByEmail]);

  useEffect(() => {
    if (!paymentPaidByEmail && currentUserEmail) {
      setPaymentPaidByEmail(currentUserEmail);
    }
  }, [currentUserEmail, paymentPaidByEmail]);

  // Validation functions
  const validateField = (name, value) => {
    switch (name) {
      case 'description':
        return value.trim().length >= 3 ? '' : 'Description must be at least 3 characters';
      case 'amount':
        const numValue = Number(value);
        if (!value || isNaN(numValue)) return 'Please enter a valid amount';
        if (numValue <= 0) return 'Amount must be greater than 0';
        if (numValue > 10000000) return 'Amount seems too large';
        return '';
      case 'groupId':
        return !value ? 'Please select a group' : '';
      default:
        return '';
    }
  };

  const getFieldError = (name) => {
    if (!touched[name]) return '';
    return validateField(name, form[name]);
  };

  const hasErrors = useMemo(() => {
    return Object.keys(touched).some(
      key => touched[key] && validateField(key, form[key])
    );
  }, [form, touched]);

  // Initialize form when editing
  useEffect(() => {
    if (editingExpense) {
      setForm({
        description: editingExpense.description || "",
        amount: String(editingExpense.amount || ""),
        groupId: editingExpense.group?._id || editingExpense.group || "",
        friendEmail: "",
      });
      setSelectedCategory(editingExpense.category || "");
      setParticipants(
        (editingExpense.participants || []).map((p) => p.userId?.email || p.userId || p)
      );
      setPaidByEmail(String(editingExpense.paidBy?.email || editingExpense.createdBy?.email || currentUserEmail || '').toLowerCase());
      // Default to expense tab when editing
      setActiveTab("expense");
    }
  }, [editingExpense, currentUserEmail]);

  const paymentRecipients = useMemo(
    () => paymentFriends.filter((email) => String(email).toLowerCase() !== String(paymentPaidByEmail).toLowerCase()),
    [paymentFriends, paymentPaidByEmail]
  );

  const paymentPayerOptions = useMemo(() => {
    const options = new Set();
    if (currentUserEmail) options.add(currentUserEmail);
    paymentFriends.forEach((email) => options.add(String(email).toLowerCase()));
    return Array.from(options);
  }, [currentUserEmail, paymentFriends]);

  const validatePaymentSplit = () => {
    const totalAmount = Number(form.amount) || 0;

    if (paymentRecipients.length === 0) {
      return false;
    }

    if (paymentSplitType === 'equal') {
      return true; // Equal split is always valid
    }

    if (paymentSplitType === 'exact') {
      const totalExact = paymentRecipients.reduce((sum, email) => {
        return sum + (Number(paymentSplitDetails[email]) || 0);
      }, 0);
      return Math.abs(totalExact - totalAmount) < 0.01;
    }

    if (paymentSplitType === 'percentage') {
      const totalPercentage = paymentRecipients.reduce((sum, email) => {
        return sum + (Number(paymentSplitDetails[email]) || 0);
      }, 0);
      return Math.abs(totalPercentage - 100) < 0.01;
    }

    if (paymentSplitType === 'ratio') {
      const totalRatio = paymentRecipients.reduce((sum, email) => {
        return sum + (Number(paymentSplitDetails[email]) || 0);
      }, 0);
      return totalRatio > 0;
    }

    return false;
  };

  const validateExpenseSplit = () => {
    const totalAmount = Number(form.amount) || 0;

    if (expenseSplitType === 'equal') {
      return true; // Equal split is always valid
    }

    if (expenseSplitType === 'exact') {
      const totalExact = participants.reduce((sum, email) => {
        return sum + (Number(expenseSplitDetails[email]) || 0);
      }, 0);
      return Math.abs(totalExact - totalAmount) < 0.01;
    }

    if (expenseSplitType === 'percentage') {
      const totalPercentage = participants.reduce((sum, email) => {
        return sum + (Number(expenseSplitDetails[email]) || 0);
      }, 0);
      return Math.abs(totalPercentage - 100) < 0.01;
    }

    if (expenseSplitType === 'ratio') {
      const totalRatio = participants.reduce((sum, email) => {
        return sum + (Number(expenseSplitDetails[email]) || 0);
      }, 0);
      return totalRatio > 0;
    }

    if (expenseSplitType === 'itemized') {
      const totalItems = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      return Math.abs(totalItems - totalAmount) < 0.01 && items.length > 0;
    }

    if (expenseSplitType === 'adjustment') {
      const totalAdjustments = Object.values(adjustments).reduce((sum, val) => sum + (Number(val) || 0), 0);
      return Math.abs(totalAdjustments - totalAmount) < 0.01;
    }

    return false;
  };

  const calculatePaymentAmounts = () => {
    const totalAmount = Number(form.amount) || 0;
    const amounts = {};

    if (paymentRecipients.length === 0) {
      return amounts;
    }

    if (paymentSplitType === 'equal') {
      const amountPerFriend = totalAmount / paymentRecipients.length;
      paymentRecipients.forEach(email => {
        amounts[email] = amountPerFriend;
      });
    } else if (paymentSplitType === 'exact') {
      paymentRecipients.forEach(email => {
        amounts[email] = Number(paymentSplitDetails[email]) || 0;
      });
    } else if (paymentSplitType === 'percentage') {
      paymentRecipients.forEach(email => {
        const percentage = Number(paymentSplitDetails[email]) || 0;
        amounts[email] = (totalAmount * percentage) / 100;
      });
    } else if (paymentSplitType === 'ratio') {
      const totalRatio = paymentRecipients.reduce((sum, email) => {
        return sum + (Number(paymentSplitDetails[email]) || 0);
      }, 0);
      paymentRecipients.forEach(email => {
        const ratio = Number(paymentSplitDetails[email]) || 0;
        amounts[email] = (totalAmount * ratio) / totalRatio;
      });
    }

    return amounts;
  };

  const calculateExpenseAmounts = () => {
    const totalAmount = Number(form.amount) || 0;
    const amounts = {};

    if (expenseSplitType === 'equal') {
      const amountPerPerson = totalAmount / participants.length;
      participants.forEach(email => {
        amounts[email] = amountPerPerson;
      });
    } else if (expenseSplitType === 'exact') {
      participants.forEach(email => {
        amounts[email] = Number(expenseSplitDetails[email]) || 0;
      });
    } else if (expenseSplitType === 'percentage') {
      participants.forEach(email => {
        const percentage = Number(expenseSplitDetails[email]) || 0;
        amounts[email] = (totalAmount * percentage) / 100;
      });
    } else if (expenseSplitType === 'ratio') {
      const totalRatio = participants.reduce((sum, email) => {
        return sum + (Number(expenseSplitDetails[email]) || 0);
      }, 0);
      participants.forEach(email => {
        const ratio = Number(expenseSplitDetails[email]) || 0;
        amounts[email] = (totalAmount * ratio) / totalRatio;
      });
    } else if (expenseSplitType === 'itemized') {
      // Initialize amounts for each participant
      participants.forEach(email => {
        amounts[email] = 0;
      });

      // Calculate each participant's share based on items
      items.forEach(item => {
        const itemAmount = Number(item.amount) || 0;
        const assignedTo = item.assignedTo || [];

        if (assignedTo.length === 0) {
          // If no one is assigned, split equally among all participants
          const share = itemAmount / participants.length;
          participants.forEach(email => {
            amounts[email] = (amounts[email] || 0) + share;
          });
        } else {
          // Split among assigned participants
          const share = itemAmount / assignedTo.length;
          assignedTo.forEach(email => {
            amounts[email] = (amounts[email] || 0) + share;
          });
        }
      });
    } else if (expenseSplitType === 'adjustment') {
      // For adjustment split, use the exact adjustments as amounts
      participants.forEach(email => {
        amounts[email] = Number(adjustments[email]) || 0;
      });
    }

    return amounts;
  };

  const canSubmit = useMemo(() => {
    if (isPayment) {
      // For payments: need description, amount, at least one friend, and valid split details
      const hasValidSplit = validatePaymentSplit();
      return (
        form.description.trim() &&
        Number(form.amount) > 0 &&
        paymentRecipients.length > 0 &&
        paymentPaidByEmail &&
        hasValidSplit &&
        !hasErrors
      );
    }

    // For expenses: need description, amount, groupId, participants, and valid split details
    const hasValidSplit = validateExpenseSplit();
    return (
      form.description.trim() &&
      Number(form.amount) > 0 &&
      form.groupId &&
      paidByEmail &&
      participants.length > 0 &&
      hasValidSplit &&
      !hasErrors
    );
  }, [form, participants, paymentFriends, paymentRecipients, paymentSplitType, paymentSplitDetails, expenseSplitType, expenseSplitDetails, hasErrors, isPayment, paidByEmail, paymentPaidByEmail]);

  const normalizeGroupName = (value) =>
    String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\s​-‍﻿]+/g, "");

  const groupOptions = useMemo(() => {
    const byName = new Map();

    for (const group of groups) {
      const key = normalizeGroupName(group.name) || String(group._id);
      const groupExpenses = expenses.filter((expense) => {
        const expenseGroupId = typeof expense.group === "object" ? expense.group?._id : expense.group;
        const expenseGroupName = typeof expense.group === "object" ? expense.group?.name : "";

        return String(expenseGroupId) === String(group._id) || normalizeGroupName(expenseGroupName) === key;
      });

      const score = groupExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const existing = byName.get(key);

      if (!existing || score > existing.score) {
        byName.set(key, { group, score });
      }
    }

    return Array.from(byName.values()).map(({ group }) => group);
  }, [groups, expenses]);

  const selectedGroup = useMemo(
    () => groupOptions.find((group) => String(group._id) === String(form.groupId)) || null,
    [groupOptions, form.groupId]
  );

  const selectedGroupMemberEmails = useMemo(() => {
    if (!selectedGroup) return new Set();

    const emails = [];
    for (const member of selectedGroup.members || []) {
      if (typeof member === 'string') continue;
      if (member?.email) emails.push(String(member.email).toLowerCase());
    }

    return new Set(emails);
  }, [selectedGroup]);

  const selectedGroupMembers = useMemo(() => {
    if (!selectedGroup) return [];

    const byEmail = new Map();
    for (const member of selectedGroup.members || []) {
      if (!member || typeof member === 'string' || !member.email) continue;

      const email = String(member.email).toLowerCase();
      byEmail.set(email, {
        email,
        label: member.name ? `${member.name} (${member.email})` : member.email,
      });
    }

    if (currentUserEmail && !byEmail.has(currentUserEmail)) {
      byEmail.set(currentUserEmail, {
        email: currentUserEmail,
        label: user?.name ? `${user.name} (${user.email})` : user?.email || currentUserEmail,
      });
    }

    return Array.from(byEmail.values());
  }, [selectedGroup, currentUserEmail, user?.name, user?.email]);

  useEffect(() => {
    if (!form.groupId || selectedGroupMemberEmails.size === 0) return;

    setParticipants((prev) => prev.filter((email) => selectedGroupMemberEmails.has(String(email).toLowerCase())));
    setExpenseSplitDetails((prev) => {
      const next = {};
      Object.entries(prev || {}).forEach(([email, value]) => {
        if (selectedGroupMemberEmails.has(String(email).toLowerCase())) {
          next[email] = value;
        }
      });
      return next;
    });
  }, [form.groupId, selectedGroupMemberEmails]);

  useEffect(() => {
    if (!form.groupId || selectedGroupMemberEmails.size === 0) return;

    if (!paidByEmail || !selectedGroupMemberEmails.has(String(paidByEmail).toLowerCase())) {
      if (currentUserEmail && selectedGroupMemberEmails.has(currentUserEmail)) {
        setPaidByEmail(currentUserEmail);
      } else {
        const [firstEmail] = Array.from(selectedGroupMemberEmails);
        setPaidByEmail(firstEmail || '');
      }
    }
  }, [form.groupId, selectedGroupMemberEmails, paidByEmail, currentUserEmail]);

  useEffect(() => {
    if (!paidByEmail) return;
    setParticipants((prev) => prev.filter((email) => String(email).toLowerCase() !== String(paidByEmail).toLowerCase()));
  }, [paidByEmail]);

  const onChange = (e) => {
    clearError();
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const onBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleAddParticipant = () => {
    const email = participantInput.trim().toLowerCase();

    if (!email) return;

    if (participants.includes(email)) {
      setLocalError("Already added");
      return;
    }

    if (email === String(paidByEmail).toLowerCase()) {
      setLocalError("Payer cannot also be a participant");
      return;
    }

    if (!form.groupId) {
      setLocalError("Select a group first");
      return;
    }

    if (selectedGroupMemberEmails.size > 0 && !selectedGroupMemberEmails.has(email)) {
      setLocalError("This user is not a member of the selected group");
      return;
    }

    setParticipants([...participants, email]);
    setParticipantInput("");
    setLocalError("");
  };

  const removeParticipant = (email) => {
    setParticipants((prev) => prev.filter((p) => p !== email));
    // Remove split details for this participant
    setExpenseSplitDetails((prev) => {
      const newDetails = { ...prev };
      delete newDetails[email];
      return newDetails;
    });
  };

  const handleAddPaymentFriend = () => {
    const email = paymentFriendInput.trim().toLowerCase();

    if (!email) return;

    if (paymentFriends.includes(email)) {
      setLocalError("Already added");
      return;
    }

    if (email === currentUserEmail) {
      setLocalError("You cannot pay yourself");
      return;
    }

    setPaymentFriends([...paymentFriends, email]);
    setPaymentFriendInput("");
    setLocalError("");
  };

  const removePaymentFriend = (email) => {
    setPaymentFriends((prev) => prev.filter((p) => p !== email));
    // Remove split details for this friend
    setPaymentSplitDetails((prev) => {
      const newDetails = { ...prev };
      delete newDetails[email];
      return newDetails;
    });
  };

  // Itemized split handlers
  const addItem = () => {
    const newItem = {
      id: Date.now(),
      name: '',
      amount: '',
      assignedTo: []
    };
    setItems([...items, newItem]);
  };

  const updateItem = (itemId, field, value) => {
    setItems(items.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (itemId) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const toggleItemAssignment = (itemId, email) => {
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      const assignedTo = item.assignedTo || [];
      const isAssigned = assignedTo.includes(email);
      return {
        ...item,
        assignedTo: isAssigned
          ? assignedTo.filter(e => e !== email)
          : [...assignedTo, email]
      };
    }));
  };

  // Adjustment split handlers
  const updateAdjustment = (email, value) => {
    setAdjustments(prev => ({
      ...prev,
      [email]: value
    }));
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    try {
      if (paymentFriends.length === 0) {
        toast.error("Please add at least one friend");
        return;
      }

      if (!validatePaymentSplit()) {
        toast.error("Invalid split details. Please check your amounts.");
        return;
      }

      // Calculate amounts based on split type
      const paymentAmounts = calculatePaymentAmounts();

      // Create settlements for each recipient with their calculated amount
      const paymentPromises = paymentRecipients.map(async (friendEmail) => {
        const amount = paymentAmounts[friendEmail];
        const paymentData = {
          description: `${form.description} (to ${friendEmail})`,
          amount: amount,
          toEmail: friendEmail,
          fromEmail: paymentPaidByEmail,
        };
        return createSettlement(paymentData);
      });

      await Promise.all(paymentPromises);
      toast.success(`Payment recorded successfully to ${paymentRecipients.length} participant(s)`);

      setForm({ description: "", amount: "", groupId: "", friendEmail: "" });
      setPaymentFriends([]);
      setPaymentPaidByEmail(currentUserEmail || "");
      setPaymentSplitDetails({});
      setPaymentSplitType("equal");
      setSelectedCategory("");

      // Refresh expenses list to show the new payments
      await fetchExpenses();

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Payment error:', err);
      const errorMessage = err?.response?.data?.message || err?.message || "Failed to record payment";

      // Show more specific error messages
      if (errorMessage.includes('not found')) {
        toast.error("One or more recipients not found. Check the email addresses.");
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    try {
      if (isEditing) {
        await updateExpense(editingExpense._id, {
          description: form.description,
          amount: Number(form.amount),
          groupId: form.groupId,
          participants,
          category: selectedCategory,
        });
        toast.success("Expense updated successfully");
      } else {
        // Calculate amounts based on split type
        const expenseAmounts = calculateExpenseAmounts();

        // Prepare split details based on split type
        let splitDetails = {};
        let backendSplitType = expenseSplitType;

        if (expenseSplitType === 'exact') {
          backendSplitType = 'custom';
          splitDetails = { customAmounts: expenseSplitDetails };
        } else if (expenseSplitType === 'percentage') {
          splitDetails = { percentages: expenseSplitDetails };
        } else if (expenseSplitType === 'ratio') {
          backendSplitType = 'shares';
          splitDetails = { shares: expenseSplitDetails };
        } else if (expenseSplitType === 'itemized') {
          splitDetails = { items: items.map(item => ({
            name: item.name,
            amount: Number(item.amount),
            assignedTo: item.assignedTo
          }))};
        } else if (expenseSplitType === 'adjustment') {
          splitDetails = { adjustments: adjustments };
        }

        await addExpense({
          description: form.description,
          amount: Number(form.amount),
          groupId: form.groupId,
          paidBy: paidByEmail,
          participants,
          category: selectedCategory,
          splitType: backendSplitType,
          splitDetails: splitDetails,
        });
        toast.success("Expense added successfully");
        setForm({ description: "", amount: "", groupId: "", friendEmail: "" });
        setPaidByEmail(currentUserEmail || "");
        setParticipants([]);
        setExpenseSplitDetails({});
        setExpenseSplitType("equal");
        setSelectedCategory("");
        setItems([]);
        setAdjustments({});
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save expense");
    }
  };

  const handleSubmit = isPayment ? handlePaymentSubmit : handleExpenseSubmit;

  return (
    <Card className="expense-form-card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>{isEditing ? "Edit Expense" : (isPayment ? "Record Payment" : "Add Expense")}</h2>
            <p>{isEditing ? "Update expense details" : (isPayment ? "Record payments to settle balances with multiple friends" : "Track shared spending instantly")}</p>
          </div>
        </div>
      </div>

      <div className="card-content">
        {/* Tab Switcher */}
        {!isEditing && (
          <div className="tabs" style={{ marginBottom: '20px' }}>
            <button
              type="button"
              className={`tab ${activeTab === 'expense' ? 'active' : ''}`}
              onClick={() => setActiveTab('expense')}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: activeTab === 'expense' ? '#007bff' : '#f0f0f0',
                color: activeTab === 'expense' ? 'white' : '#333',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px',
              }}
            >
              Expense
            </button>
            <button
              type="button"
              className={`tab ${activeTab === 'payment' ? 'active' : ''}`}
              onClick={() => setActiveTab('payment')}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: activeTab === 'payment' ? '#28a745' : '#f0f0f0',
                color: activeTab === 'payment' ? 'white' : '#333',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Payment
            </button>
          </div>
        )}

        <form className="stack-lg" onSubmit={handleSubmit}>
          {/* ── DESCRIPTION + AMOUNT ── */}
          <div className="form-row-grid">
            <div>
              <Input
                name="description"
                label={isPayment ? "What was this payment for?" : "What was this for?"}
                value={form.description}
                onChange={onChange}
                onBlur={onBlur}
                placeholder={isPayment ? "Settling dinner bill" : "Dinner at Bistro"}
                required
                aria-invalid={!!getFieldError('description')}
                aria-describedby={getFieldError('description') ? 'description-error' : undefined}
              />
              {getFieldError('description') && (
                <p id="description-error" className="banner error" style={{ marginTop: '4px', fontSize: '12px' }}>
                  {getFieldError('description')}
                </p>
              )}
            </div>
            <div>
              <Input
                name="amount"
                label="Amount (₹)"
                type="number"
                min="1"
                step="0.01"
                value={form.amount}
                onChange={onChange}
                onBlur={onBlur}
                placeholder="1600"
                required
                aria-invalid={!!getFieldError('amount')}
                aria-describedby={getFieldError('amount') ? 'amount-error' : undefined}
              />
              {getFieldError('amount') && (
                <p id="amount-error" className="banner error" style={{ marginTop: '4px', fontSize: '12px' }}>
                  {getFieldError('amount')}
                </p>
              )}
            </div>
          </div>

          {/* ── CATEGORY CHIPS (Only for Expense) ── */}
          {!isPayment && (
            <div className="input-block">
              <span className="input-label">Category</span>
              <div className="chips" style={{ marginTop: 6 }}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.label}
                    type="button"
                    className={`chip${selectedCategory === cat.label ? " primary" : ""}`}
                    onClick={() =>
                      setSelectedCategory((prev) =>
                        prev === cat.label ? "" : cat.label
                      )
                    }
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── GROUP SELECT (Only for Expense) ── */}
          {!isPayment && (
            <div className="input-block">
              <span className="input-label">Group</span>
              <select
                className="input"
                name="groupId"
                value={form.groupId}
                onChange={onChange}
                onBlur={onBlur}
                required
                disabled={isEditing}
                aria-invalid={!!getFieldError('groupId')}
                aria-describedby={getFieldError('groupId') ? 'group-error' : undefined}
              >
                <option value="">Choose group</option>
                {groupOptions.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.name}
                  </option>
                ))}
              </select>
              {isEditing && <p className="text-sm muted" style={{ marginTop: 4 }}>Cannot change group for existing expense</p>}
              {!isEditing && form.groupId && (
                <p className="text-sm muted" style={{ marginTop: 4 }}>
                  Only members of this group can be added as participants.
                </p>
              )}
              {getFieldError('groupId') && !isEditing && (
                <p id="group-error" className="banner error" style={{ marginTop: '4px', fontSize: '12px' }}>
                  {getFieldError('groupId')}
                </p>
              )}
            </div>
          )}

          {!isPayment && (
            <div className="input-block">
              <span className="input-label">Paid by</span>
              <select
                className="input"
                value={paidByEmail}
                onChange={(e) => {
                  setPaidByEmail(e.target.value);
                  setLocalError('');
                }}
                required
                disabled={!form.groupId}
              >
                <option value="">Select who paid</option>
                {selectedGroupMembers.map((member) => (
                  <option key={member.email} value={member.email}>
                    {member.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ── FRIEND EMAILS (Only for Payment) ── */}
          {isPayment && (
            <div className="input-block">
              <span className="input-label">Pay to</span>
              <div className="input-row" style={{ marginTop: 4 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="email"
                    className="input"
                    placeholder="friend@email.com"
                    list="payment-friends-datalist"
                    value={paymentFriendInput}
                    onChange={(e) => {
                      setPaymentFriendInput(e.target.value);
                      setLocalError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPaymentFriend();
                      }
                    }}
                    aria-label="Add friend email"
                    aria-invalid={!!localError}
                    aria-describedby={localError ? 'payment-friend-error' : undefined}
                  />
                  {selectedGroupMembers.length > 0 && (
                    <datalist id="payment-friends-datalist">
                      {selectedGroupMembers
                        .filter(member => member.email !== currentUserEmail)
                        .map((member) => (
                          <option key={member.email} value={member.email}>
                            {member.label}
                          </option>
                        ))}
                    </datalist>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleAddPaymentFriend}
                  disabled={!paymentFriendInput.trim() || !isValidEmail(paymentFriendInput)}
                  aria-label="Add friend"
                >
                  Add
                </Button>
              </div>

              {localError && (
                <p id="payment-friend-error" className="banner error" style={{ marginTop: 8 }}>
                  {localError}
                </p>
              )}

              {paymentFriends.length > 0 && (
                <div className="chips" style={{ marginTop: 10 }} role="list" aria-label="Added friends">
                  {paymentFriends.map((email) => (
                    <div key={email} className={`chip ${email === paymentPaidByEmail ? "" : "primary"}`} role="listitem">
                      {email}{email === paymentPaidByEmail ? ' (payer)' : ''}
                      <span
                        onClick={() => removePaymentFriend(email)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            removePaymentFriend(email);
                          }
                        }}
                        title="Remove friend"
                        style={{ cursor: 'pointer' }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Remove ${email}`}
                      >
                        ×
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {paymentPayerOptions.length > 0 && (
                <div className="input-block" style={{ marginTop: 12 }}>
                  <span className="input-label">Paid by</span>
                  <select
                    className="input"
                    value={paymentPaidByEmail}
                    onChange={(e) => setPaymentPaidByEmail(e.target.value)}
                    required
                  >
                    {paymentPayerOptions.map((email) => (
                      <option key={email} value={email}>
                        {email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── SPLIT TYPE SELECTOR (Only for Payment) ── */}
              {paymentRecipients.length > 0 && (
                <div className="input-block" style={{ marginTop: 15 }}>
                  <span className="input-label">Split Type</span>
                  <div className="chips" style={{ marginTop: 6 }}>
                    {[
                      { label: 'Equal', value: 'equal' },
                      { label: 'Exact', value: 'exact' },
                      { label: 'Percentage', value: 'percentage' },
                      { label: 'Ratio', value: 'ratio' }
                    ].map((split) => (
                      <button
                        key={split.value}
                        type="button"
                        className={`chip${paymentSplitType === split.value ? " primary" : ""}`}
                        onClick={() => {
                          setPaymentSplitType(split.value);
                          setPaymentSplitDetails({});
                        }}
                      >
                        {split.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── SPLIT DETAILS INPUT (Only for Payment) ── */}
              {paymentRecipients.length > 0 && paymentSplitType !== 'equal' && (
                <div className="input-block" style={{ marginTop: 15 }}>
                  <span className="input-label">
                    {paymentSplitType === 'exact' ? 'Amount per friend (₹)' :
                     paymentSplitType === 'percentage' ? 'Percentage per friend (%)' :
                     'Ratio per friend'}
                  </span>
                  <div style={{ marginTop: 8 }}>
                    {paymentRecipients.map((email) => (
                      <div key={email} className="input-row" style={{ marginBottom: 8 }}>
                        <span style={{
                          minWidth: 200,
                          fontSize: 14,
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {email}
                        </span>
                        <input
                          type="number"
                          className="input"
                          placeholder={
                            paymentSplitType === 'exact' ? '0.00' :
                            paymentSplitType === 'percentage' ? '0' :
                            '0'
                          }
                          min="0"
                          step={paymentSplitType === 'percentage' ? '1' : '0.01'}
                          value={paymentSplitDetails[email] || ''}
                          onChange={(e) => {
                            setPaymentSplitDetails(prev => ({
                              ...prev,
                              [email]: e.target.value
                            }));
                          }}
                          style={{ width: 120 }}
                          aria-label={`${paymentSplitType} for ${email}`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Validation feedback */}
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {(() => {
                      const totalAmount = Number(form.amount) || 0;

                      if (paymentSplitType === 'exact') {
                        const totalExact = paymentRecipients.reduce((sum, email) => {
                          return sum + (Number(paymentSplitDetails[email]) || 0);
                        }, 0);
                        const remaining = totalAmount - totalExact;
                        return (
                          <span style={{
                            color: Math.abs(remaining) < 0.01 ? 'var(--success)' : 'var(--danger)'
                          }}>
                            Total: ₹{totalExact.toFixed(2)} {Math.abs(remaining) < 0.01 ? '✓' : `(Remaining: ₹${remaining.toFixed(2)})`}
                          </span>
                        );
                      }

                      if (paymentSplitType === 'percentage') {
                        const totalPercentage = paymentRecipients.reduce((sum, email) => {
                          return sum + (Number(paymentSplitDetails[email]) || 0);
                        }, 0);
                        return (
                          <span style={{
                            color: Math.abs(totalPercentage - 100) < 0.01 ? 'var(--success)' : 'var(--danger)'
                          }}>
                            Total: {totalPercentage}% {Math.abs(totalPercentage - 100) < 0.01 ? '✓' : `(Need: ${100 - totalPercentage}%)`}
                          </span>
                        );
                      }

                      if (paymentSplitType === 'ratio') {
                        const totalRatio = paymentRecipients.reduce((sum, email) => {
                          return sum + (Number(paymentSplitDetails[email]) || 0);
                        }, 0);
                        const amounts = calculatePaymentAmounts();
                        return (
                          <span style={{ color: 'var(--text-muted)' }}>
                            Total ratio: {totalRatio} {totalRatio > 0 && '(Amounts calculated)'}
                          </span>
                        );
                      }

                      return null;
                    })()}
                  </div>
                </div>
              )}

              {paymentRecipients.length > 0 && (
                <p className="text-sm muted" style={{ marginTop: 6 }}>
                  {(() => {
                    const amounts = calculatePaymentAmounts();
                    const amountList = paymentRecipients.map(email => `₹${amounts[email].toFixed(2)}`).join(', ');

                    if (paymentSplitType === 'equal') {
                      return `${paymentPaidByEmail} pays ₹${form.amount || 0} split equally among ${paymentRecipients.length} ${paymentRecipients.length === 1 ? 'participant' : 'participants'} (₹${(Number(form.amount) / paymentRecipients.length).toFixed(2)} each)`;
                    } else if (paymentSplitType === 'exact') {
                      return `${paymentPaidByEmail} pays ₹${form.amount || 0} by exact amounts: ${amountList}`;
                    } else if (paymentSplitType === 'percentage') {
                      return `${paymentPaidByEmail} pays ₹${form.amount || 0} by percentage: ${paymentRecipients.map(email => `${paymentSplitDetails[email] || 0}%`).join(', ')}`;
                    } else if (paymentSplitType === 'ratio') {
                      return `${paymentPaidByEmail} pays ₹${form.amount || 0} by ratio: ${paymentRecipients.map(email => `${paymentSplitDetails[email] || 0}:₹${amounts[email].toFixed(2)}`).join(', ')}`;
                    }
                    return `${paymentPaidByEmail} pays ₹${form.amount || 0} among ${paymentRecipients.length} ${paymentRecipients.length === 1 ? 'participant' : 'participants'}`;
                  })()}
                </p>
              )}
            </div>
          )}

          {/* ── PARTICIPANTS (Only for Expense) ── */}
          {!isPayment && (
            <div className="input-block">
              <span className="input-label">Split with</span>
              <div className="input-row" style={{ marginTop: 4 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="email"
                    className="input"
                    placeholder="participant@email.com"
                    list="participants-datalist"
                    value={participantInput}
                    onChange={(e) => {
                      setParticipantInput(e.target.value);
                      setLocalError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddParticipant();
                      }
                    }}
                    aria-label="Add participant email"
                    aria-invalid={!!localError}
                    aria-describedby={localError ? 'participant-error' : undefined}
                  />
                  {selectedGroupMembers.length > 0 && (
                    <datalist id="participants-datalist">
                      {selectedGroupMembers
                        .filter(member => member.email !== String(paidByEmail).toLowerCase())
                        .map((member) => (
                          <option key={member.email} value={member.email}>
                            {member.label}
                          </option>
                        ))}
                    </datalist>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleAddParticipant}
                  disabled={!participantInput.trim() || !isValidEmail(participantInput)}
                  aria-label="Add participant"
                >
                  Add
                </Button>
              </div>

              {localError && (
                <p id="participant-error" className="banner error" style={{ marginTop: 8 }}>
                  {localError}
                </p>
              )}

              {participants.length > 0 && (
                <div className="chips" style={{ marginTop: 10 }} role="list" aria-label="Added participants">
                  {participants.map((email) => (
                    <div key={email} className="chip primary" role="listitem">
                      {email}
                      <span
                        onClick={() => removeParticipant(email)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            removeParticipant(email);
                          }
                        }}
                        title="Remove participant"
                        style={{ cursor: 'pointer' }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Remove ${email}`}
                      >
                        ×
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {participants.length > 0 && (
                <div className="input-block" style={{ marginTop: 15 }}>
                  <span className="input-label">Split Type</span>
                  <div className="chips" style={{ marginTop: 6 }}>
                    {[
                      { label: 'Equal', value: 'equal' },
                      { label: 'Exact', value: 'exact' },
                      { label: 'Percentage', value: 'percentage' },
                      { label: 'Ratio', value: 'ratio' },
                      { label: 'Itemized', value: 'itemized' },
                      { label: 'Adjustment', value: 'adjustment' }
                    ].map((split) => (
                      <button
                        key={split.value}
                        type="button"
                        className={`chip${expenseSplitType === split.value ? " primary" : ""}`}
                        onClick={() => {
                          setExpenseSplitType(split.value);
                          setExpenseSplitDetails({});
                          if (split.value === 'itemized') {
                            setItems([]);
                          } else if (split.value === 'adjustment') {
                            setAdjustments({});
                          }
                        }}
                      >
                        {split.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {participants.length > 0 && expenseSplitType !== 'equal' && expenseSplitType !== 'itemized' && expenseSplitType !== 'adjustment' && (
                <div className="input-block" style={{ marginTop: 15 }}>
                  <span className="input-label">
                    {expenseSplitType === 'exact' ? 'Split by exact amounts' :
                     expenseSplitType === 'percentage' ? 'Split by percentage' :
                     'Split by ratio'}
                  </span>

                  <div style={{ marginTop: 8 }}>
                    {participants.map((email) => (
                      <div
                        key={email}
                        className="input-row"
                        style={{ marginBottom: 10, alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <span style={{
                          minWidth: 200,
                          fontSize: 14,
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {email}
                        </span>
                        <input
                          type="number"
                          className="input"
                          placeholder={
                            expenseSplitType === 'exact' ? '0.00' :
                            expenseSplitType === 'percentage' ? '0' :
                            '0'
                          }
                          min="0"
                          step={expenseSplitType === 'percentage' ? '1' : '0.01'}
                          value={expenseSplitDetails[email] || ''}
                          onChange={(e) => {
                            setExpenseSplitDetails(prev => ({
                              ...prev,
                              [email]: e.target.value
                            }));
                          }}
                          style={{ width: 120 }}
                          aria-label={`${expenseSplitType} for ${email}`}
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {(() => {
                      const totalAmount = Number(form.amount) || 0;

                      if (expenseSplitType === 'exact') {
                        const totalExact = participants.reduce((sum, email) => {
                          return sum + (Number(expenseSplitDetails[email]) || 0);
                        }, 0);
                        const remaining = totalAmount - totalExact;

                        return (
                          <span style={{
                            color: Math.abs(remaining) < 0.01 ? 'var(--success)' : 'var(--danger)'
                          }}>
                            TOTAL: ₹{totalExact.toFixed(2)} {Math.abs(remaining) < 0.01 ? '✓' : ` (₹${remaining.toFixed(2)} left)`}
                          </span>
                        );
                      }

                      if (expenseSplitType === 'percentage') {
                        const totalPercentage = participants.reduce((sum, email) => {
                          return sum + (Number(expenseSplitDetails[email]) || 0);
                        }, 0);

                        return (
                          <span style={{
                            color: Math.abs(totalPercentage - 100) < 0.01 ? 'var(--success)' : 'var(--danger)'
                          }}>
                            TOTAL: {totalPercentage}% {Math.abs(totalPercentage - 100) < 0.01 ? '✓' : ` (${(100 - totalPercentage).toFixed(2)}% left)`}
                          </span>
                        );
                      }

                      if (expenseSplitType === 'ratio') {
                        const totalRatio = participants.reduce((sum, email) => {
                          return sum + (Number(expenseSplitDetails[email]) || 0);
                        }, 0);

                        return (
                          <span style={{ color: 'var(--text-muted)' }}>
                            TOTAL RATIO: {totalRatio} {totalRatio > 0 && '(Amounts auto-calculated)'}
                          </span>
                        );
                      }

                      return null;
                    })()}
                  </div>
                </div>
              )}

              {/* ── ITEMIZED SPLIT UI ── */}
              {participants.length > 0 && expenseSplitType === 'itemized' && (
                <div className="input-block" style={{ marginTop: 15 }}>
                  <span className="input-label">Split by Items</span>
                  <p className="text-sm muted" style={{ marginTop: 4 }}>
                    Add items and assign them to participants who ordered them
                  </p>

                  <div style={{ marginTop: 10 }}>
                    {items.map((item, index) => (
                      <div key={item.id} className="card" style={{ marginBottom: 10, padding: 12, border: '1px solid #e0e0e0', borderRadius: 4 }}>
                        <div className="input-row" style={{ marginBottom: 8 }}>
                          <input
                            type="text"
                            className="input"
                            placeholder="Item name (e.g., Pizza)"
                            value={item.name}
                            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                            style={{ flex: 1, marginRight: 8 }}
                          />
                          <input
                            type="number"
                            className="input"
                            placeholder="Amount"
                            value={item.amount}
                            onChange={(e) => updateItem(item.id, 'amount', e.target.value)}
                            style={{ width: 100, marginRight: 8 }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeItem(item.id)}
                            style={{ padding: '4px 8px' }}
                          >
                            ×
                          </Button>
                        </div>

                        <div>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Split between:</span>
                          <div className="chips" style={{ marginTop: 4 }}>
                            {participants.map(email => (
                              <button
                                key={email}
                                type="button"
                                className={`chip${(item.assignedTo || []).includes(email) ? " primary" : ""}`}
                                onClick={() => toggleItemAssignment(item.id, email)}
                                style={{ fontSize: 12 }}
                              >
                                {email.split('@')[0]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={addItem}
                      style={{ width: '100%', marginTop: 8 }}
                    >
                      + Add Item
                    </Button>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {(() => {
                      const totalItems = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
                      const totalAmount = Number(form.amount) || 0;
                      const remaining = totalAmount - totalItems;

                      return (
                        <span style={{
                          color: Math.abs(remaining) < 0.01 ? 'var(--success)' : 'var(--danger)'
                        }}>
                          Items Total: ₹{totalItems.toFixed(2)} {Math.abs(remaining) < 0.01 ? '✓' : ` (₹${remaining.toFixed(2)} remaining)`}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ── ADJUSTMENT SPLIT UI ── */}
              {participants.length > 0 && expenseSplitType === 'adjustment' && (
                <div className="input-block" style={{ marginTop: 15 }}>
                  <span className="input-label">Split by Adjustments</span>
                  <p className="text-sm muted" style={{ marginTop: 4 }}>
                    Enter exact amounts for each participant (useful for tips, taxes, or custom splits)
                  </p>

                  <div style={{ marginTop: 10 }}>
                    {participants.map((email) => (
                      <div
                        key={email}
                        className="input-row"
                        style={{ marginBottom: 10, alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <span style={{
                          minWidth: 200,
                          fontSize: 14,
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {email}
                        </span>
                        <input
                          type="number"
                          className="input"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          value={adjustments[email] || ''}
                          onChange={(e) => updateAdjustment(email, e.target.value)}
                          style={{ width: 120 }}
                          aria-label={`Adjustment for ${email}`}
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {(() => {
                      const totalAdjustments = Object.values(adjustments).reduce((sum, val) => sum + (Number(val) || 0), 0);
                      const totalAmount = Number(form.amount) || 0;
                      const remaining = totalAmount - totalAdjustments;

                      return (
                        <span style={{
                          color: Math.abs(remaining) < 0.01 ? 'var(--success)' : 'var(--danger)'
                        }}>
                          Adjustments Total: ₹{totalAdjustments.toFixed(2)} {Math.abs(remaining) < 0.01 ? '✓' : ` (₹${remaining.toFixed(2)} remaining)`}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}

              {participants.length > 0 && (
                <p className="text-sm muted" style={{ marginTop: 6 }}>
                  {(() => {
                    const amounts = calculateExpenseAmounts();

                    if (expenseSplitType === 'equal') {
                      const totalPeople = participants.length + 1; // +1 for the payer
                      const amountPerPerson = Number(form.amount) / totalPeople;
                      return `Splitting ₹${form.amount || 0} equally among ${totalPeople} ${totalPeople === 1 ? 'person' : 'people'} (₹${amountPerPerson.toFixed(2)} each)`;
                    }

                    if (expenseSplitType === 'exact') {
                      return `Split by exact amounts: ${participants.map(email => `₹${(Number(expenseSplitDetails[email]) || 0).toFixed(2)}`).join(', ')}`;
                    }

                    if (expenseSplitType === 'percentage') {
                      return `Split by percentage: ${participants.map(email => `${expenseSplitDetails[email] || 0}% (₹${(amounts[email] || 0).toFixed(2)})`).join(', ')}`;
                    }

                    if (expenseSplitType === 'ratio') {
                      return `Split by ratio: ${participants.map(email => `${expenseSplitDetails[email] || 0}:₹${(amounts[email] || 0).toFixed(2)}`).join(', ')}`;
                    }

                    if (expenseSplitType === 'itemized') {
                      const itemSummary = items.map(item => `${item.name || 'Item'} (₹${Number(item.amount).toFixed(2)})`).join(', ');
                      return `Split by items: ${itemSummary || 'No items added'}`;
                    }

                    if (expenseSplitType === 'adjustment') {
                      return `Split by adjustments: ${participants.map(email => `₹${(Number(adjustments[email]) || 0).toFixed(2)}`).join(', ')}`;
                    }

                    return `Split among ${participants.length} ${participants.length === 1 ? 'person' : 'people'}`;
                  })()}
                </p>
              )}
            </div>
          )}

          {/* ── STATUS ── */}
          {error && <p className="banner error" role="alert">{error}</p>}

          {/* ── SUBMIT ── */}
          <Button
            type="submit"
            disabled={loading || !canSubmit}
            style={{ width: "100%", opacity: !canSubmit ? 0.45 : 1 }}
            aria-busy={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                {isEditing ? "Updating…" : (isPayment ? "Recording…" : "Saving…")}
              </span>
            ) : (
              isEditing ? "Update Expense" : (isPayment ? `Record Payment${paymentFriends.length > 1 ? ` (${paymentFriends.length} friends)` : ''}` : "Save Expense")
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
}