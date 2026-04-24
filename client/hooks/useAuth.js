import useAuthStore from '../store/auth.store.js';

export default function useAuth() {
	const token = useAuthStore((state) => state.token);
	const user = useAuthStore((state) => state.user);
	const loading = useAuthStore((state) => state.loading);
	const error = useAuthStore((state) => state.error);
	const login = useAuthStore((state) => state.login);
	const register = useAuthStore((state) => state.register);
	const logout = useAuthStore((state) => state.logout);
	const clearError = useAuthStore((state) => state.clearError);

	return {
		token,
		user,
		loading,
		error,
		login,
		register,
		logout,
		clearError
	};
}
