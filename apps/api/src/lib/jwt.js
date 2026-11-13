import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en .env');
}

export function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
