# OpenViking Third-Party Binary

AgentWorld integrates OpenViking through a direct server binary.

Expected current-platform source install path:

```text
thirdparty/openviking/bin/openviking-server-${platform}-${arch}
```

Expected Linux packaging paths:

```text
thirdparty/openviking/bin/openviking-server-linux-x64
thirdparty/openviking/bin/openviking-server-linux-arm64
```

The binary is treated as a third-party artifact from OpenViking and is not part of AgentWorld source code. The upstream project is AGPL-3.0.

Operational rules:

- Prefer `OPENVIKING_SERVER_BIN` when the binary is installed outside the repository.
- Prefer `thirdparty/openviking/bin/openviking-server-${platform}-${arch}` for source installs.
- Build the Linux binary with `pnpm openviking:build-binary` on a matching Linux builder using `thirdparty/openviking/wheels`, or place an approved compatible binary at `thirdparty/openviking/bin/openviking-server-linux-${arch}`.
- Do not require a container runtime for production deployment.
