function assertValidEnvName(name: string) {
  if (!/^[A-Z0-9_]+$/.test(name)) {
    throw new Error(`Invalid environment variable name: ${name}`);
  }
}

export function readOptionalSecretEnv(name: string) {
  assertValidEnvName(name);
  const value = process.env[name];
  return value || undefined;
}

export function readSecretEnvList(names: string[]) {
  return names.flatMap((name) => {
    const value = readOptionalSecretEnv(name);
    return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
  });
}
