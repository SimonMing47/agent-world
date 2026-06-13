import assert from "node:assert/strict";
import { test } from "node:test";
import { readPluginPackageManifestFromBuffer } from "@/server/extension-core";

function createStoredZip(fileName: string, content: string) {
  const name = Buffer.from(fileName);
  const data = Buffer.from(content);
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt32LE(0, 10);
  localHeader.writeUInt32LE(0, 14);
  localHeader.writeUInt32LE(data.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(name.length, 26);
  localHeader.writeUInt16LE(0, 28);
  const centralDirectoryOffset = localHeader.length + name.length + data.length;
  const centralDirectory = Buffer.alloc(46);
  centralDirectory.writeUInt32LE(0x02014b50, 0);
  centralDirectory.writeUInt16LE(20, 4);
  centralDirectory.writeUInt16LE(20, 6);
  centralDirectory.writeUInt16LE(0, 8);
  centralDirectory.writeUInt16LE(0, 10);
  centralDirectory.writeUInt32LE(0, 12);
  centralDirectory.writeUInt32LE(0, 16);
  centralDirectory.writeUInt32LE(data.length, 20);
  centralDirectory.writeUInt32LE(data.length, 24);
  centralDirectory.writeUInt16LE(name.length, 28);
  centralDirectory.writeUInt16LE(0, 30);
  centralDirectory.writeUInt16LE(0, 32);
  centralDirectory.writeUInt16LE(0, 34);
  centralDirectory.writeUInt16LE(0, 36);
  centralDirectory.writeUInt32LE(0, 38);
  centralDirectory.writeUInt32LE(0, 42);
  const centralDirectorySize = centralDirectory.length + name.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralDirectorySize, 12);
  end.writeUInt32LE(centralDirectoryOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([localHeader, name, data, centralDirectory, name, end]);
}

const ssoManifest = {
  apiVersion: "agentworld.io/plugin/v1alpha1",
  kind: "AgentWorldPlugin",
  metadata: {
    id: "company.sso",
    name: "Company SSO",
    version: "1.0.0",
  },
  spec: {
    runtime: {
      type: "declarative",
      entry: "agentworld.plugin.json",
    },
    permissions: {
      requested: ["auth.oidc.exchange", "secret.use"],
    },
    contributions: {
      authAdapters: [
        {
          id: "company.sso",
          protocol: "oidc",
          mode: "redirect",
        },
      ],
    },
  },
};

test("plugin package manifest reader accepts AgentWorld plugin JSON", () => {
  const manifest = readPluginPackageManifestFromBuffer(
    "agentworld.plugin.json",
    Buffer.from(JSON.stringify(ssoManifest)),
  );

  assert.equal(manifest.metadata?.id, "company.sso");
  assert.equal(manifest.spec?.contributions?.authAdapters?.[0]?.id, "company.sso");
});

test("plugin package manifest reader accepts zip awp packages", () => {
  const manifest = readPluginPackageManifestFromBuffer(
    "company-sso.awp",
    createStoredZip("agentworld.plugin.json", JSON.stringify(ssoManifest)),
  );

  assert.equal(manifest.metadata?.id, "company.sso");
  assert.equal(manifest.spec?.contributions?.authAdapters?.[0]?.id, "company.sso");
});
