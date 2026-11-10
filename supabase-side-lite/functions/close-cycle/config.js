// Report configuration names only; never include secret or connection values.
export function validateCloserConfig(databaseUrl, secret, caCertificate) {
  if (!databaseUrl) throw new Error('Missing SIDE_CLOSER_DATABASE_URL');
  if (!secret) throw new Error('Missing SIDE_CLOSER_SECRET');
  if (secret.length < 32 || secret.length > 512 || /\s/.test(secret)) {
    throw new Error('Invalid SIDE_CLOSER_SECRET');
  }
  if (typeof caCertificate !== 'string' || !caCertificate.includes('-----BEGIN CERTIFICATE-----') || !caCertificate.includes('-----END CERTIFICATE-----')) {
    throw new Error('Invalid SIDE_CLOSER_CA_CERT');
  }
}
