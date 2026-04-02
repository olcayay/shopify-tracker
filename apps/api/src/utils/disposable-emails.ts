/**
 * Common disposable/temporary email domains.
 * Block these at registration to prevent abuse.
 */
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com", "guerrillamail.com", "guerrillamail.de", "guerrillamail.net",
  "tempmail.com", "temp-mail.org", "throwaway.email", "mailinator.com",
  "yopmail.com", "yopmail.fr", "sharklasers.com", "guerrillamailblock.com",
  "grr.la", "dispostable.com", "trashmail.com", "trashmail.me", "trashmail.net",
  "mailnesia.com", "maildrop.cc", "discard.email", "mailcatch.com",
  "fakeinbox.com", "tempail.com", "tempr.email", "burnermail.io",
  "mailforspam.com", "spam4.me", "mytemp.email", "mohmal.com",
  "getnada.com", "emailondeck.com", "33mail.com", "mailtothis.com",
  "harakirimail.com", "mintemail.com", "mailnator.com", "binkmail.com",
  "tempinbox.com", "jetable.org", "mailexpire.com", "mailmoat.com",
  "mailnull.com", "spamgourmet.com", "tempomail.fr", "receiveee.com",
  "tmail.ws", "mt2015.com", "thankyou2010.com", "trash-mail.com",
  "temporaryemail.net", "crazymailing.com", "fakemailgenerator.com",
  "armyspy.com", "cuvox.de", "dayrep.com", "einrot.com", "fleckens.hu",
  "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com", "teleworm.us",
]);

/**
 * Check if an email domain is a known disposable email provider.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}
