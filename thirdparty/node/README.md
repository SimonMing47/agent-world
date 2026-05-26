# Node.js Runtime Archives

Linux release packaging is offline by default. Approved internal Node.js Linux archives should be stored here before running `pnpm package:linux`.

Expected default paths:

```text
thirdparty/node/node-v${nodeVersion}-linux-x64.tar.xz
thirdparty/node/node-v${nodeVersion}-linux-arm64.tar.xz
```

Set `AGENTWORLD_NODE_RUNTIME_TARBALL` when the archive lives outside the repository.
Set `AGENTWORLD_BUNDLE_ARCH=x64` or `AGENTWORLD_BUNDLE_ARCH=arm64` to choose the Linux target architecture.
