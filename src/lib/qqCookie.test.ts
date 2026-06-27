import { strict as assert } from 'node:assert';
import {
  createQQCookieHeaders,
  getQQCookieLoginState,
  normalizeQQCookie,
  QQ_COOKIE_HEADER,
} from './qqCookie';

assert.equal(
  normalizeQQCookie('  uin=o0012345; qm_keyst=abc;\nqqmusic_key=def;;  '),
  'uin=12345; qm_keyst=abc; qqmusic_key=def',
);

assert.equal(
  normalizeQQCookie('login_type=2; wxuin=000789; wxskey=wx-key'),
  'login_type=2; wxuin=000789; wxskey=wx-key; uin=789',
);

assert.deepEqual(getQQCookieLoginState('uin=o001; p_skey=basic'), {
  loggedIn: true,
  userId: '1',
  playbackKeyReady: false,
});

assert.deepEqual(getQQCookieLoginState('uin=42; qm_keyst=play'), {
  loggedIn: true,
  userId: '42',
  playbackKeyReady: true,
});

assert.deepEqual(createQQCookieHeaders(''), {});
assert.deepEqual(createQQCookieHeaders('uin=42; qm_keyst=play'), {
  [QQ_COOKIE_HEADER]: 'uin=42; qm_keyst=play',
});

console.log('qqCookie tests passed');
