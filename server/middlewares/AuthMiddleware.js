const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization']; // Standard header access

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1]; // Extract token after "Bearer"

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id || decoded._id || decoded.user?._id || decoded.user?.id;

        if (!userId) {
            return res.status(400).json({ message: 'Invalid token payload: missing user ID' });
        }

        req.user = { id: userId };
        next();

    } catch (error) {
        console.error('JWT Error:', error.message);
        res.status(400).json({ message: 'Invalid token.' });
    }
};

module.exports = { authMiddleware };
