# Node.js Runtime Archive

Linux release packaging is offline by default. Place the approved internal Node.js Linux x64 archive here before running `pnpm package:linux`.

Expected default path:

```text
thirdparty/node/node-v${nodeVersion}-linux-x64.tar.xz
```

Set `AGENTWORLD_NODE_RUNTIME_TARBALL` when the archive lives outside the repository.
