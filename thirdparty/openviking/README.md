# OpenViking Third-Party Binary

AgentWorld integrates OpenViking through a direct server binary.

Expected deployment path:

```text
thirdparty/openviking/bin/openviking-server
```

The binary is treated as a third-party artifact from OpenViking and is not part of AgentWorld source code. The upstream project is AGPL-3.0.

Operational rules:

- Prefer `OPENVIKING_SERVER_BIN` when the binary is installed outside the repository.
- Prefer `thirdparty/openviking/bin/openviking-server` when shipping a self-contained AgentWorld release.
- Build the Linux binary with `pnpm openviking:build-binary` on a Linux builder using an internal wheelhouse, or place an approved compatible binary here.
- Do not require a container runtime for production deployment.
