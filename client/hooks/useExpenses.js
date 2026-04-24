import useExpenseStore from '../store/expense.store.js';

export default function useExpenses() {
	const expenses = useExpenseStore((state) => state.expenses);
	const groups = useExpenseStore((state) => state.groups);
	const myDues = useExpenseStore((state) => state.myDues);
	const totalOwed = useExpenseStore((state) => state.totalOwed);
	const loading = useExpenseStore((state) => state.loading);
	const error = useExpenseStore((state) => state.error);
	const addExpense = useExpenseStore((state) => state.addExpense);
	const createGroup = useExpenseStore((state) => state.createGroup);
	const fetchMyDues = useExpenseStore((state) => state.fetchMyDues);
	const clearError = useExpenseStore((state) => state.clearError);

	return {
		expenses,
		groups,
		myDues,
		totalOwed,
		loading,
		error,
		addExpense,
		createGroup,
		fetchMyDues,
		clearError
	};
}
