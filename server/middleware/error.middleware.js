import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
	logger.error(err instanceof Error ? err.stack || err.message : JSON.stringify(err));

	const status = err?.status || 500;
	const payload = {
		message: err?.message || 'Internal Server Error',
	};

	if (process.env.NODE_ENV !== 'production') {
		payload.stack = err?.stack;
	}

	res.status(status).json(payload);
};

export default errorHandler;
