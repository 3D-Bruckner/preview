// The UI's words in English, the reference every other language is typed against (conventions: code/language). Components take their
// words from here through copyFor(lang) or useCopy(), never text of their own. The brand an instance shows (its name in the header and
// the title) is a setting, not a word here (backend/config.ts).

export const en = {
  app: {
    description: "View-only 3D previews of models.",
  },
  language: {
    label: "Language",
    names: { en: "English", de: "Deutsch" },
  },
  home: {
    title: "Customers",
    empty: "No customers yet.",
  },
  signIn: {
    title: "Sign in",
    intro: "Only the people this instance allows can sign in.",
    email: "Email address",
    sendCode: "Send me a code",
    sending: "Sending…",
    sent: (email: string) => `We sent a sign-in code to ${email}. Enter it here.`,
    code: "Code",
    checkCode: "Sign in with the code",
    otherAddress: "Use another address",
    viaProvider: (label: string) => `Sign in with ${label}`,
    or: "or",
    failedSend: "The code couldn't be sent. Please try again in a moment.",
    mailNotSent: "The mail with the code couldn't be sent. Please try again later.",
    wrongCode: "That code is wrong or has expired. Request a new one.",
    providerFailed: (label: string) => `Signing in with ${label} didn't start. Please try again.`,
    refused: {
      email_not_allowed: "This address may not sign in here.",
      email_not_verified: "The provider didn't confirm this address, so it can't be used to sign in.",
      link: "This sign-in link has expired or was used already. Request a new code.",
      other: "Signing in didn't work. Please try again.",
      byProvider: (label: string) => `${label} refused the sign-in.`,
    },
  },
  consent: {
    title: "Allow access?",
    unknownClient: "An app this instance doesn't know",
    asks: (client: string, email: string) => `${client} wants to act as ${email}.`,
    recorded: "What it does is recorded in your name, with its name.",
    allow: "Allow",
    deny: "Deny",
    failed: "That didn't work. Start again from the app that sent you here.",
  },
  // The sign-in mail (next-app-kit's texts), in the language the page was in when the code was asked for.
  mail: {
    subject: (code: string) => `${code} is your sign-in code`,
    body: (code: string, link: string | undefined) =>
      [
        `Your sign-in code: ${code}`,
        ...(link ? ["", "Or sign in with this link:", link] : []),
        "",
        "The code and the link are valid for a few minutes. If you didn't ask for them, ignore this mail.",
      ].join("\n"),
  },
  common: {
    cancel: "Cancel",
    failed: "That didn't work. Please try again.",
    signedOut: "You were signed out. Please reload the page and sign in.",
  },
  nav: {
    label: "Main",
    customers: "Customers",
    settings: "Settings",
  },
  settings: {
    title: "Settings",
    signOut: "Sign out",
    tokens: {
      heading: "API tokens",
      intro: "For scripts, such as a workshop's upload. A token is shown once, right after it is created.",
      name: "Token name",
      scope: "Rights",
      scopes: { read: "Read only", "read+write": "Read and write" },
      expiry: "Valid for",
      expiries: { "30": "30 days", "90": "90 days", "365": "a year", never: "No expiry" },
      create: "Create token",
      created: "New token",
      copyHint: "Copy it now: it is not shown again.",
      list: "Your API tokens",
      none: "No API tokens.",
      lastUsed: (when: string | null) => (when ? `Last used ${when}` : "Never used"),
      expires: (when: string | null) => (when ? `Valid until ${when}` : "No expiry"),
      revoke: (name: string) => `Revoke ${name}`,
      revokeConfirm: (name: string) => `Revoke the token “${name}”? Whatever uses it is refused from then on.`,
      revokeShort: "Revoke",
      revoked: "Token revoked",
    },
  },
  footer: {
    label: "Legal",
    imprint: "Imprint",
    privacy: "Privacy",
  },
  notFound: {
    title: "Not found",
    text: "There is nothing at this address.",
    back: "To the start page",
  },
};

export type Copy = typeof en;
