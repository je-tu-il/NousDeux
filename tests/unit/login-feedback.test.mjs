import assert from 'node:assert/strict';
import test from 'node:test';
import { getLoginFeedback } from '../../src/lib/login-feedback.mjs';

for (const provider of ['google', 'apple']) {
  const label = provider === 'apple' ? 'Apple' : 'Google';
  test(`${label}: closed popups and native cancellations are silent`, () => {
    for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'SIGN_IN_CANCELLED', 'ERR_REQUEST_CANCELED', 'ERR_CANCELED']) {
      assert.equal(getLoginFeedback(provider, { code }), null);
    }
  });

  test(`${label}: blocked and timed-out popups identify the selected provider`, () => {
    assert.match(getLoginFeedback(provider, { code: 'auth/popup-blocked' }), new RegExp(label));
    assert.match(getLoginFeedback(provider, { name: 'auth-popup-timeout' }), new RegExp(label));
  });

  test(`${label}: recoverable errors give actionable feedback`, () => {
    assert.match(getLoginFeedback(provider, { code: 'auth/network-request-failed' }), /Internet/);
    assert.match(getLoginFeedback(provider, { code: 'auth/account-exists-with-different-credential' }), /méthode/);
    assert.match(getLoginFeedback(provider, { code: 'auth/too-many-requests' }), /Attends/);
  });

  test(`${label}: unexpected failures do not disclose provider diagnostics`, () => {
    assert.match(getLoginFeedback(provider, null), new RegExp(label));
    assert.doesNotMatch(getLoginFeedback(provider, new Error('internal request payload')), /payload/);
  });
}
