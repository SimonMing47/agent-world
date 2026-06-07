import { isIP } from "node:net";

function ipv4Parts(address: string) {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts as [number, number, number, number];
}

export function isKnowledgeImportProxyReservedIpv4(address: string) {
  const parts = ipv4Parts(address);
  if (!parts) return false;
  const [first, second] = parts;
  return first === 198 && (second === 18 || second === 19);
}

export function isKnowledgeImportPrivateIpv4(address: string) {
  const parts = ipv4Parts(address);
  if (!parts) return true;
  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    isKnowledgeImportProxyReservedIpv4(address) ||
    first >= 224
  );
}

export function isKnowledgeImportPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) {
    const mappedIpv4 = normalized.slice("::ffff:".length);
    return isIP(mappedIpv4) === 4 ? isKnowledgeImportPrivateIpv4(mappedIpv4) : true;
  }
  return (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  );
}

export function isKnowledgeImportPrivateAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isKnowledgeImportPrivateIpv4(address);
  if (family === 6) return isKnowledgeImportPrivateIpv6(address);
  return true;
}

export function isKnowledgeImportBlockedResolvedAddress(address: string) {
  return isKnowledgeImportPrivateAddress(address) && !isKnowledgeImportProxyReservedIpv4(address);
}
