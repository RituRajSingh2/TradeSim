import { sign } from 'jsonwebtoken';
import { config } from 'dotenv';
import path from 'path';

// Load the root or API .env file
config({ path: path.join(__dirname, '../.env') });
config({ path: path.join(__dirname, '../apps/api/.env') });

const secret = process.env.JWT_SECRET || 'development_secret_key_123!';

const token = sign(
  {
    sub: 'load-tester-user-id',
    email: 'tester@tradesim.dev',
    role: 'USER',
  },
  secret,
  { expiresIn: '1h' }
);

console.log(token);
