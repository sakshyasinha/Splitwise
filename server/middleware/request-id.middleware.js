import { v4 as uuidv4 } from 'uuid';

export const requestIdMiddleware = (req, res, next) => {
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.id = requestId;
    res.setHeader('x-request-id', requestId);
    next();
};

export default requestIdMiddleware;
