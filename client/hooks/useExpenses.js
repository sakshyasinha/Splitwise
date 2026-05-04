import useExpenseStore from '../store/expense.store.js';

export default function useExpenses() {
	const expenses = useExpenseStore((state) => state.expenses);
	const groups = useExpenseStore((state) => state.groups);
	const myDues = useExpenseStore((state) => state.myDues);
	const myLents = useExpenseStore((state) => state.myLents);
	const totalOwed = useExpenseStore((state) => state.totalOwed);
	const totalLent = useExpenseStore((state) => state.totalLent);
	const loading = useExpenseStore((state) => state.loading);
	const error = useExpenseStore((state) => state.error);
	const breakdown = useExpenseStore((state) => state.breakdown);
	const friends = useExpenseStore((state) => state.friends);
	const fetchExpenses = useExpenseStore((state) => state.fetchExpenses);
	const addExpense = useExpenseStore((state) => state.addExpense);
	const updateExpense = useExpenseStore((state) => state.updateExpense);
	const deleteExpense = useExpenseStore((state) => state.deleteExpense);
	const settleDue = useExpenseStore((state) => state.settleDue);
	const createGroup = useExpenseStore((state) => state.createGroup);
	const fetchMyDues = useExpenseStore((state) => state.fetchMyDues);
	const fetchMyLents = useExpenseStore((state) => state.fetchMyLents);
	const clearError = useExpenseStore((state) => state.clearError);
	const fetchGroups = useExpenseStore((state) => state.fetchGroups);
	const updateGroup = useExpenseStore((state) => state.updateGroup);
	const deleteGroup = useExpenseStore((state) => state.deleteGroup);
	const addGroupMember = useExpenseStore((state) => state.addGroupMember);
	const removeGroupMember = useExpenseStore((state) => state.removeGroupMember);
	const fetchExpenseBreakdown = useExpenseStore((state) => state.fetchExpenseBreakdown);
	const fetchFriendsList = useExpenseStore((state) => state.fetchFriendsList);

	return {
		expenses,
		groups,
		myDues,
		myLents,
		totalOwed,
		totalLent,
		loading,
		error,
		breakdown,
		friends,
		fetchExpenses,
		addExpense,
		updateExpense,
		deleteExpense,
		settleDue,
		createGroup,
		fetchMyDues,
		fetchMyLents,
		clearError,
		fetchGroups,
		updateGroup,
		deleteGroup,
		addGroupMember,
		removeGroupMember,
		fetchExpenseBreakdown,
		fetchFriendsList
	};
}
