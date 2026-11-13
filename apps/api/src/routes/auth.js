import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { signToken } from '../lib/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(100)
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (existing) return res.status(409).json({ error: 'El correo ya está registrado' });

    const passwordHash = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase
      .from('users')
      .insert({ email: email.toLowerCase(), password_hash: passwordHash })
      .select('id, email, created_at')
      .single();
    if (error) throw error;

    res.status(201).json({ token: signToken(user.id), user });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0].message });
    }
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (error) throw error;

    const valid = user?.password_hash && (await bcrypt.compare(password, user.password_hash));
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    res.json({
      token: signToken(user.id),
      user: { id: user.id, email: user.email }
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0].message });
    }
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, created_at')
      .eq('id', req.userId)
      .single();
    if (error) throw error;
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
