export const FOUNDER_TIER = 'founder';

export function isFounderTier(tier) {
  return tier === FOUNDER_TIER;
}

export function isFounderUser(user) {
  return isFounderTier(user?.subscription?.tier);
}

export function normalizeFounderState(user) {
  if (!user) return user;

  const founder = isFounderUser(user);

  if (founder) {
    if (user.subscription) {
      user.subscription.status = 'lifetime';
      user.subscription.expiresAt = null;
    }

    user.isFounder = true;
    user.role = 'founder';
    return user;
  }

  if (user.isFounder === true) {
    user.isFounder = false;
  }

  if (user.role === 'founder') {
    user.role = 'user';
  }

  return user;
}

export function founderIntegrityIssues(user) {
  if (!user) return [];

  const issues = [];
  const founder = isFounderUser(user);

  if (founder) {
    if (user?.subscription?.status !== 'lifetime') {
      issues.push('founder_subscription_status_not_lifetime');
    }

    if (user?.subscription?.expiresAt != null) {
      issues.push('founder_subscription_has_expiry');
    }

    if (user?.isFounder !== true) {
      issues.push('founder_flag_missing');
    }

    if (user?.role !== 'founder') {
      issues.push('founder_role_missing');
    }

    return issues;
  }

  if (user?.isFounder === true) {
    issues.push('legacy_founder_flag_without_founder_tier');
  }

  if (user?.role === 'founder') {
    issues.push('legacy_founder_role_without_founder_tier');
  }

  return issues;
}
