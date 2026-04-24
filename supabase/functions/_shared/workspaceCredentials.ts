const WORKSPACE_LOGIN_MAX_LENGTH = 40
const WORKSPACE_LOGIN_SUFFIX_LENGTH = 8
const WORKSPACE_PASSWORD_LENGTH = 16
const PBKDF2_ITERATIONS = 120_000
const PBKDF2_HASH_BYTES = 32
const PBKDF2_SALT_BYTES = 16
const WORKSPACE_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%*'

const textEncoder = new TextEncoder()

const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...Array.from(bytes)))

const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0))

const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length))

const stripToAscii = (value: string) => value.normalize('NFKD').replace(/[^\x00-\x7F]/g, '')

export const normalizeWorkspaceJoinLogin = (value: string) => value.trim().toLowerCase()

const normalizeWorkspaceLoginBase = (value: string) => {
  const normalizedValue = stripToAscii(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalizedValue || 'workspace'
}

const derivePasswordHashBytes = async (password: string, salt: Uint8Array, iterations: number) => {
  const passwordKey = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    passwordKey,
    PBKDF2_HASH_BYTES * 8
  )

  return new Uint8Array(derivedBits)
}

const timingSafeEqual = (left: Uint8Array, right: Uint8Array) => {
  if (left.length !== right.length) {
    return false
  }

  let result = 0

  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index]
  }

  return result === 0
}

/**
 * Generates a stable, copyable workspace login from the workspace identity.
 *
 * @param {{ workspaceName: string, workspaceId: string }} input
 * @returns {string}
 *
 * @example
 * const login = createWorkspaceJoinLogin({ workspaceName: 'Aurora Studio', workspaceId: 'a0f2...' })
 */
export const createWorkspaceJoinLogin = ({
  workspaceName,
  workspaceId
}: {
  workspaceName: string
  workspaceId: string
}) => {
  const normalizedWorkspaceId = workspaceId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || bytesToBase64(randomBytes(6))
  const suffix = normalizedWorkspaceId.slice(-WORKSPACE_LOGIN_SUFFIX_LENGTH)
  const maxBaseLength = WORKSPACE_LOGIN_MAX_LENGTH - suffix.length - 1
  const base = normalizeWorkspaceLoginBase(workspaceName).slice(0, maxBaseLength)

  return `${base}-${suffix}`
}

/**
 * Generates a high-entropy workspace join password suitable for manual copy.
 *
 * @returns {string}
 *
 * @example
 * const password = createWorkspaceJoinPassword()
 */
export const createWorkspaceJoinPassword = () => {
  const passwordCharacters: string[] = []
  const passwordEntropy = randomBytes(WORKSPACE_PASSWORD_LENGTH)

  for (const randomValue of passwordEntropy) {
    const characterIndex = randomValue % WORKSPACE_PASSWORD_ALPHABET.length
    passwordCharacters.push(WORKSPACE_PASSWORD_ALPHABET[characterIndex])
  }

  return passwordCharacters.join('')
}

/**
 * Hashes a workspace join password using PBKDF2-SHA256.
 *
 * @param {string} password
 * @returns {Promise<string>}
 *
 * @example
 * const passwordHash = await hashWorkspaceJoinPassword('Secret123!')
 */
export const hashWorkspaceJoinPassword = async (password: string) => {
  const salt = randomBytes(PBKDF2_SALT_BYTES)
  const derivedHash = await derivePasswordHashBytes(password, salt, PBKDF2_ITERATIONS)

  return ['pbkdf2_sha256', String(PBKDF2_ITERATIONS), bytesToBase64(salt), bytesToBase64(derivedHash)].join('$')
}

/**
 * Verifies a raw workspace join password against a stored PBKDF2 hash.
 *
 * @param {{ password: string, passwordHash: string }} input
 * @returns {Promise<boolean>}
 *
 * @example
 * const isValid = await verifyWorkspaceJoinPassword({ password: 'Secret123!', passwordHash })
 */
export const verifyWorkspaceJoinPassword = async ({
  password,
  passwordHash
}: {
  password: string
  passwordHash: string
}) => {
  const [algorithm, iterationsValue, saltBase64, storedHashBase64] = passwordHash.split('$')

  if (algorithm !== 'pbkdf2_sha256' || !iterationsValue || !saltBase64 || !storedHashBase64) {
    throw new Error('The workspace password hash format is invalid.')
  }

  const iterations = Number(iterationsValue)

  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new Error('The workspace password hash iterations are invalid.')
  }

  const salt = base64ToBytes(saltBase64)
  const storedHash = base64ToBytes(storedHashBase64)
  const providedHash = await derivePasswordHashBytes(password, salt, iterations)

  return timingSafeEqual(storedHash, providedHash)
}
