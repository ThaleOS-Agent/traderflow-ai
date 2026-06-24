import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { founderIntegrityIssues, normalizeFounderState } from '../utils/founderAccess.js';

const envDir = join(dirname(fileURLToPath(import.meta.url)), '../../../');
dotenv.config({ path: join(envDir, '.env.local') });
dotenv.config({ path: join(envDir, '.env'), override: false });

const LEGACY_FOUNDER_EMAIL = 'founder@tradeflow.ai';

async function rotateFounderSeedAccount() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tradeflow');
  logger.info('Connected to MongoDB for founder seed rotation');

  const founder = await User.findOne({ email: LEGACY_FOUNDER_EMAIL.toLowerCase() });
  let rotated = false;

  if (founder) {
    founder.password = crypto.randomBytes(48).toString('hex');
    founder.updatedAt = new Date();
    normalizeFounderState(founder);
    await founder.save();
    rotated = true;
  }

  const candidates = await User.find({
    $or: [
      { 'subscription.tier': 'founder' },
      { isFounder: true },
      { role: 'founder' }
    ]
  });

  let repaired = 0;
  for (const user of candidates) {
    const hadIssues = founderIntegrityIssues(user).length > 0;
    normalizeFounderState(user);

    if (hadIssues) {
      user.updatedAt = new Date();
      await user.save();
      repaired += 1;
    }
  }

  if (rotated) {
    console.log(`Rotated password for legacy founder seed account ${LEGACY_FOUNDER_EMAIL}.`);
  } else {
    console.log(`No legacy founder seed account found for ${LEGACY_FOUNDER_EMAIL}.`);
  }

  console.log(`Normalized founder integrity for ${repaired} user record(s).`);
  console.log('Founder access remains governed by the founder tier on the database account.');

  await mongoose.disconnect();
  process.exit(0);
}

rotateFounderSeedAccount().catch(err => {
  console.error('Founder seed rotation failed:', err.message);
  process.exit(1);
});
