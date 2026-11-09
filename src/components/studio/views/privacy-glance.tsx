import { memo } from 'react';
import { translate } from '@/lib/i18n/messages/onboarding';

/** Privacy-at-a-glance panel (#1064) linking the threat model. */
export const PrivacyGlance = memo(function PrivacyGlance() {
  return (
    <section aria-label={translate('onboarding.privacyTitle')} className="rounded-lg border border-border p-4">
      <h2 className="font-serif text-h3">{translate('onboarding.privacyTitle')}</h2>
      <p className="mt-1 text-body text-ink-mute">{translate('onboarding.privacyBody')}</p>
    </section>
  );
});
